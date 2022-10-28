const Promise = require('bluebird');
const util = require('util');
const _ = require('lodash');

let elasticsearch;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
  elasticsearch = require('elasticsearch');
} catch (e) {
  elasticsearch = null;
}

let gremlin;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
  gremlin = require('gremlin');
} catch (e) {
  gremlin = null;
}

let dseDriver;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
  dseDriver = require('dse-driver');
} catch (e) {
  dseDriver = null;
}

const cql = Promise.promisifyAll(dseDriver || require('cassandra-driver'));

const BaseModel = require('./base_model');
const schemer = require('../validators/schema');
const normalizer = require('../utils/normalizer');
const buildError = require('./apollo_error');

const KeyspaceBuilder = require('../builders/keyspace');
const UdtBuilder = require('../builders/udt');
const UdfBuilder = require('../builders/udf');
const UdaBuilder = require('../builders/uda');
const ElassandraBuilder = require('../builders/elassandra');
const JanusGraphBuilder = require('../builders/janusgraph');

const DEFAULT_REPLICATION_FACTOR = 1;

const noop = () => {};

const Apollo = function f(connection, options) {
  if (!connection) {
    throw (buildError('model.validator.invalidconfig', 'Cassandra connection configuration undefined'));
  }

  options = options || {};

  if (!options.defaultReplicationStrategy) {
    options.defaultReplicationStrategy = {
      class: 'SimpleStrategy',
      replication_factor: DEFAULT_REPLICATION_FACTOR,
    };
  }

  this._options = options;
  this._models = {};
  this._keyspace = connection.keyspace;
  this._connection = connection;
  this._client = null;
  this._esclient = null;
  this._gremlin_client = null;
};

Apollo.prototype = {

  _generate_model(properties) {
    const Model = function f(...args) {
      BaseModel.apply(this, Array.prototype.slice.call(args));
    };

    util.inherits(Model, BaseModel);

    Object.keys(BaseModel).forEach((key) => {
      Model[key] = BaseModel[key];
    });

    Model._set_properties(properties);

    return Model;
  },

  create_es_client() {
    if (!elasticsearch) {
      throw (new Error('Configured to use elassandra, but elasticsearch module was not found, try npm install elasticsearch'));
    }

    const contactPoints = this._connection.contactPoints;
    const defaultHosts = [];
    contactPoints.forEach((host) => {
      defaultHosts.push({ host });
    });

    const esClientConfig = _.defaults({}, this._connection.elasticsearch, {
      hosts: defaultHosts,
      sniffOnStart: true,
    });
    this._esclient = new elasticsearch.Client(esClientConfig);
    return this._esclient;
  },

  _assert_es_index(callback) {
    const esClient = this.create_es_client();
    const indexName = this._keyspace;

    const elassandraBuilder = new ElassandraBuilder(esClient);
    elassandraBuilder.assert_index(indexName, indexName, callback);
  },

  create_gremlin_client() {
    if (!gremlin) {
      throw (new Error('Configured to use janus graph server, but gremlin module was not found, try npm install gremlin'));
    }

    const defaultHosts = this._connection.contactPoints;

    const gremlinConfig = _.defaults({}, this._connection.gremlin, {
      host: defaultHosts[0],
      port: 8182,
      storage: {
        backend: 'cassandrathrift',
        hostname: defaultHosts[0],
        port: 9160,
      },
      index: {
        search: {
          backend: 'elasticsearch',
          hostname: defaultHosts[0],
          port: 9200,
        },
      },
      options: {},
    });
    this._gremlin_client = gremlin.createClient(gremlinConfig.port, gremlinConfig.host, gremlinConfig.options);
    this._gremlin_config = gremlinConfig;
    return this._gremlin_client;
  },

  _assert_gremlin_graph(callback) {
    const gremlinClient = this.create_gremlin_client();
    const gremlinConfig = this._gremlin_config;
    const keyspaceName = this._keyspace;
    const graphName = `${keyspaceName}_graph`;

    const graphBuilder = new JanusGraphBuilder(gremlinClient, gremlinConfig);
    graphBuilder.assert_graph(graphName, callback);
  },

  get_system_client() {
    const connection = _.cloneDeep(this._connection);
    delete connection.keyspace;

    return new cql.Client(connection);
  },

  get_keyspace_name() {
    return this._keyspace;
  },

  _assert_keyspace(callback) {
    const client = this.get_system_client();
    const keyspaceName = this._keyspace;
    const options = this._options;

    const keyspaceBuilder = new KeyspaceBuilder(client);

    keyspaceBuilder.get_keyspace(keyspaceName, (err, keyspaceObject) => {
      if (err) {
        callback(err);
        return;
      }

      if (!keyspaceObject) {
        keyspaceBuilder.create_keyspace(keyspaceName, options.defaultReplicationStrategy, callback);
        return;
      }

      const dbReplication = normalizer.normalize_replication_option(keyspaceObject.replication);
      const ormReplication = normalizer.normalize_replication_option(options.defaultReplicationStrategy);

      if (!_.isEqual(dbReplication, ormReplication)) {
        keyspaceBuilder.alter_keyspace(keyspaceName, options.defaultReplicationStrategy, callback);
        return;
      }

      client.shutdown(() => {
        callback();
      });
    });
  },

  _assert_user_defined_types(callback) {
    const client = this._define_connection;
    const options = this._options;
    const keyspace = this._keyspace;

    if (!options.udts) {
      callback();
      return;
    }

    const udtBuilder = new UdtBuilder(client);

    Promise.mapSeries(Object.keys(options.udts), (udtKey) => new Promise((resolve, reject) => {
      const udtCallback = (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      };
      udtBuilder.get_udt(udtKey, keyspace, (err, udtObject) => {
        if (err) {
          udtCallback(err);
          return;
        }

        if (!udtObject) {
          udtBuilder.create_udt(udtKey, options.udts[udtKey], udtCallback);
          return;
        }

        const udtKeys = Object.keys(options.udts[udtKey]);
        const udtValues = _.map(_.values(options.udts[udtKey]), normalizer.normalize_user_defined_type);
        const fieldNames = udtObject.field_names;
        const fieldTypes = _.map(udtObject.field_types, normalizer.normalize_user_defined_type);

        if (_.difference(udtKeys, fieldNames).length === 0 && _.difference(udtValues, fieldTypes).length === 0) {
          udtCallback();
          return;
        }

        throw (new Error(util.format(
          'User defined type "%s" already exists but does not match the udt definition. '
          + 'Consider altering or droping the type.',
          udtKey,
        )));
      });
    }))
      .then(() => {
        callback();
      })
      .catch((err) => {
        callback(err);
      });
  },

  _assert_user_defined_functions(callback) {
    const client = this._define_connection;
    const options = this._options;
    const keyspace = this._keyspace;

    if (!options.udfs) {
      callback();
      return;
    }

    const udfBuilder = new UdfBuilder(client);

    Promise.mapSeries(Object.keys(options.udfs), (udfKey) => new Promise((resolve, reject) => {
      const udfCallback = (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      };

      udfBuilder.validate_definition(udfKey, options.udfs[udfKey]);

      udfBuilder.get_udf(udfKey, keyspace, (err, udfObject) => {
        if (err) {
          udfCallback(err);
          return;
        }

        if (!udfObject) {
          udfBuilder.create_udf(udfKey, options.udfs[udfKey], udfCallback);
          return;
        }

        const udfLanguage = options.udfs[udfKey].language;
        const resultLanguage = udfObject.language;

        const udfCode = options.udfs[udfKey].code;
        const resultCode = udfObject.body;

        const udfReturnType = normalizer.normalize_user_defined_type(options.udfs[udfKey].returnType);
        const resultReturnType = normalizer.normalize_user_defined_type(udfObject.return_type);

        const udfInputs = options.udfs[udfKey].inputs ? options.udfs[udfKey].inputs : {};
        const udfInputKeys = Object.keys(udfInputs);
        const udfInputValues = _.map(_.values(udfInputs), normalizer.normalize_user_defined_type);
        const resultArgumentNames = udfObject.argument_names;
        const resultArgumentTypes = _.map(udfObject.argument_types, normalizer.normalize_user_defined_type);

        if (udfLanguage === resultLanguage
          && udfCode === resultCode
          && udfReturnType === resultReturnType
          && _.isEqual(udfInputKeys, resultArgumentNames)
          && _.isEqual(udfInputValues, resultArgumentTypes)) {
          udfCallback();
          return;
        }

        udfBuilder.create_udf(udfKey, options.udfs[udfKey], udfCallback);
      });
    }))
      .then(() => {
        callback();
      })
      .catch((err) => {
        callback(err);
      });
  },

  _assert_user_defined_aggregates(callback) {
    const client = this._define_connection;
    const options = this._options;
    const keyspace = this._keyspace;

    if (!options.udas) {
      callback();
      return;
    }

    const udaBuilder = new UdaBuilder(client);

    Promise.mapSeries(Object.keys(options.udas), (udaKey) => new Promise((resolve, reject) => {
      const udaCallback = (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      };

      udaBuilder.validate_definition(udaKey, options.udas[udaKey]);

      if (!options.udas[udaKey].initcond) {
        options.udas[udaKey].initcond = null;
      }

      udaBuilder.get_uda(udaKey, keyspace, (err, udaObjects) => {
        if (err) {
          udaCallback(err);
          return;
        }

        if (!udaObjects) {
          udaBuilder.create_uda(udaKey, options.udas[udaKey], udaCallback);
          return;
        }

        const inputTypes = _.map(options.udas[udaKey].input_types, normalizer.normalize_user_defined_type);
        const sfunc = options.udas[udaKey].sfunc.toLowerCase();
        const stype = normalizer.normalize_user_defined_type(options.udas[udaKey].stype);
        const finalfunc = options.udas[udaKey].finalfunc ? options.udas[udaKey].finalfunc.toLowerCase() : null;
        const initcond = options.udas[udaKey].initcond ? options.udas[udaKey].initcond.replace(/[\s]/g, '') : null;

        for (let i = 0; i < udaObjects.length; i++) {
          const resultArgumentTypes = _.map(udaObjects[i].argument_types, normalizer.normalize_user_defined_type);

          const resultStateFunc = udaObjects[i].state_func;
          const resultStateType = normalizer.normalize_user_defined_type(udaObjects[i].state_type);
          const resultFinalFunc = udaObjects[i].final_func;
          const resultInitcond = udaObjects[i].initcond ? udaObjects[i].initcond.replace(/[\s]/g, '') : null;

          if (sfunc === resultStateFunc
            && stype === resultStateType
            && finalfunc === resultFinalFunc
            && initcond === resultInitcond
            && _.isEqual(inputTypes, resultArgumentTypes)) {
            udaCallback();
            return;
          }
        }
        udaBuilder.create_uda(udaKey, options.udas[udaKey], udaCallback);
      });
    }))
      .then(() => {
        callback();
      })
      .catch((err) => {
        callback(err);
      });
  },

  _set_client(client) {
    const defineConnectionOptions = _.cloneDeep(this._connection);

    this._client = client;
    this._define_connection = new cql.Client(defineConnectionOptions);

    // Reset connections on all models
    Object.keys(this._models).forEach((i) => {
      this._models[i]._properties.cql = this._client;
      this._models[i]._properties.define_connection = this._define_connection;
    });
  },

  init(callback) {
    const onUserDefinedAggregates = (err) => {
      if (err) {
        callback(err);
        return;
      }

      const managementTasks = [];
      if (this._keyspace && this._options.manageESIndex) {
        this.assertESIndexAsync = Promise.promisify(this._assert_es_index);
        managementTasks.push(this.assertESIndexAsync());
      }
      if (this._keyspace && this._options.manageGraphs) {
        this.assertGremlinGraphAsync = Promise.promisify(this._assert_gremlin_graph);
        managementTasks.push(this.assertGremlinGraphAsync());
      }
      Promise.all(managementTasks)
        .then(() => {
          callback(null, this);
        })
        .catch((err1) => {
          callback(err1);
        });
    };

    const onUserDefinedFunctions = function f(err) {
      if (err) {
        callback(err);
        return;
      }
      try {
        this._assert_user_defined_aggregates(onUserDefinedAggregates.bind(this));
      } catch (e) {
        throw (buildError('model.validator.invaliduda', e.message));
      }
    };

    const onUserDefinedTypes = function f(err) {
      if (err) {
        callback(err);
        return;
      }
      try {
        this._assert_user_defined_functions(onUserDefinedFunctions.bind(this));
      } catch (e) {
        throw (buildError('model.validator.invalidudf', e.message));
      }
    };

    const onKeyspace = function f(err) {
      if (err) {
        callback(err);
        return;
      }
      this._set_client(new cql.Client(this._connection));
      try {
        this._assert_user_defined_types(onUserDefinedTypes.bind(this));
      } catch (e) {
        throw (buildError('model.validator.invalidudt', e.message));
      }
    };

    if (this._keyspace && this._options.createKeyspace !== false) {
      this._assert_keyspace(onKeyspace.bind(this));
    } else {
      onKeyspace.call(this);
    }
  },

  addModel(modelName, modelSchema) {
    if (!modelName || typeof (modelName) !== 'string') {
      throw (buildError('model.validator.invalidschema', 'Model name must be a valid string'));
    }

    try {
      schemer.validate_model_schema(modelSchema);
    } catch (e) {
      throw (buildError('model.validator.invalidschema', e.message));
    }

    if (modelSchema.options && modelSchema.options.timestamps) {
      const timestampOptions = {
        createdAt: modelSchema.options.timestamps.createdAt || 'createdAt',
        updatedAt: modelSchema.options.timestamps.updatedAt || 'updatedAt',
      };
      modelSchema.options.timestamps = timestampOptions;

      modelSchema.fields[modelSchema.options.timestamps.createdAt] = {
        type: 'timestamp',
        default: {
          $db_function: 'toTimestamp(now())',
        },
      };
      modelSchema.fields[modelSchema.options.timestamps.updatedAt] = {
        type: 'timestamp',
        default: {
          $db_function: 'toTimestamp(now())',
        },
      };
    }

    if (modelSchema.options && modelSchema.options.versions) {
      const versionOptions = {
        key: modelSchema.options.versions.key || '__v',
      };
      modelSchema.options.versions = versionOptions;

      modelSchema.fields[modelSchema.options.versions.key] = {
        type: 'timeuuid',
        default: {
          $db_function: 'now()',
        },
      };
    }

    const baseProperties = {
      name: modelName,
      schema: modelSchema,
      keyspace: this._keyspace,
      define_connection: this._define_connection,
      cql: this._client,
      esclient: this._esclient,
      gremlin_client: this._gremlin_client,
      get_constructor: this.getModel.bind(this, modelName),
      init: this.init.bind(this),
      dropTableOnSchemaChange: this._options.dropTableOnSchemaChange,
      createTable: this._options.createTable,
      migration: this._options.migration,
      disableTTYConfirmation: this._options.disableTTYConfirmation,
    };

    this._models[modelName] = this._generate_model(baseProperties);
    return this._models[modelName];
  },

  getModel(modelName) {
    return this._models[modelName] || null;
  },

  close(callback) {
    callback = callback || noop;

    if (this.orm._esclient) {
      this.orm._esclient.close();
    }

    if (this.orm._gremlin_client && this.orm._gremlin_client.connection && this.orm._gremlin_client.connection.ws) {
      this.orm._gremlin_client.connection.ws.close();
    }

    const clientsToShutdown = [];
    if (this.orm._client) {
      clientsToShutdown.push(this.orm._client.shutdown());
    }
    if (this.orm._define_connection) {
      clientsToShutdown.push(this.orm._define_connection.shutdown());
    }

    Promise.all(clientsToShutdown)
      .then(() => {
        callback();
      })
      .catch((err) => {
        callback(err);
      });
  },
};

module.exports = Apollo;
