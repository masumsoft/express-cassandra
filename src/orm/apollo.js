const async = require('async');
const util = require('util');
const _ = require('lodash');
const cql = require('cassandra-driver');

const BaseModel = require('./base_model');
const schemer = require('./apollo_schemer');

const types = cql.types;
const DEFAULT_REPLICATION_FACTOR = 1;

const noop = () => {};

const Apollo = function f(connection, options) {
  if (!connection) throw (new Error('Data connection configuration undefined'));

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
};

Apollo.prototype = {

  _generate_model(properties, callback) {
    const Model = function f(...args) {
      BaseModel.apply(this, Array.prototype.slice.call(args));
    };

    util.inherits(Model, BaseModel);

    Object.keys(BaseModel).forEach((key) => {
      Model[key] = BaseModel[key];
    });

    Model._set_properties(properties);
    Model.syncDefinition((err, result) => {
      if (typeof callback === 'function') {
        if (err) callback(err);
        else callback(null, result);
      }
    });

    return Model;
  },

  _get_system_client() {
    const connection = _.cloneDeep(this._connection);
    delete connection.keyspace;

    return new cql.Client(connection);
  },

  _generate_replication_text(replicationOption) {
    if (typeof replicationOption === 'string') {
      return replicationOption;
    }

    const properties = [];
    Object.keys(replicationOption).forEach((k) => {
      properties.push(util.format("'%s': '%s'", k, replicationOption[k]));
    });

    return util.format('{%s}', properties.join(','));
  },

  _assert_keyspace(callback) {
    const self = this;
    const client = this._get_system_client();
    const keyspaceName = this._connection.keyspace;
    let replicationText = '';
    const options = this._options;

    let query = util.format(
      "SELECT * FROM system_schema.keyspaces WHERE keyspace_name = '%s';",
      keyspaceName
    );
    client.execute(query, (err, result) => {
      if (err) {
        callback(err);
        return;
      }

      const createKeyspace = () => {
        replicationText = self._generate_replication_text(options.defaultReplicationStrategy);

        query = util.format(
          'CREATE KEYSPACE IF NOT EXISTS "%s" WITH REPLICATION = %s;',
          keyspaceName,
          replicationText
        );
        client.execute(query, (err1, result1) => {
          client.shutdown(() => {
            callback(err1, result1);
          });
        });
      };

      const alterKeyspace = () => {
        replicationText = self._generate_replication_text(options.defaultReplicationStrategy);

        query = util.format(
          'ALTER KEYSPACE "%s" WITH REPLICATION = %s;',
          keyspaceName,
          replicationText
        );
        client.execute(query, (err1, result1) => {
          client.shutdown(() => {
            // eslint-disable-next-line no-console
            console.warn('WARN: KEYSPACE ALTERED! Run the `nodetool repair` command on each affected node.');
            callback(err1, result1);
          });
        });
      };

      if (result.rows && result.rows.length > 0) {
        const dbReplication = result.rows[0].replication;

        Object.keys(dbReplication).forEach((key) => {
          if (key === 'class') dbReplication[key] = dbReplication[key].replace('org.apache.cassandra.locator.', '');
          else dbReplication[key] = parseInt(dbReplication[key], 10);
        });

        const ormReplication = options.defaultReplicationStrategy;
        Object.keys(ormReplication).forEach((key) => {
          if (key === 'class') ormReplication[key] = ormReplication[key].replace('org.apache.cassandra.locator.', '');
          else ormReplication[key] = parseInt(ormReplication[key], 10);
        });

        if (_.isEqual(dbReplication, ormReplication)) {
          callback();
        } else {
          alterKeyspace();
        }
      } else {
        createKeyspace();
      }
    });
  },

  _assert_user_defined_types(callback) {
    const client = this._define_connection;
    const options = this._options;
    const keyspace = this._keyspace;

    if (options.udts) {
      async.eachSeries(Object.keys(options.udts), (udtKey, udtCallback) => {
        let query = util.format(
          "SELECT * FROM system_schema.types WHERE keyspace_name = '%s' AND type_name = '%s';",
          keyspace,
          udtKey.toLowerCase()
        );
        client.execute(query, (err, result) => {
          if (err) {
            udtCallback(err);
            return;
          }

          const createUDT = () => {
            const udtFields = [];
            Object.keys(options.udts[udtKey]).forEach((field) => {
              udtFields.push(util.format(
                '"%s" %s',
                field,
                options.udts[udtKey][field]
              ));
            });
            query = util.format(
              'CREATE TYPE IF NOT EXISTS %s (%s);',
              udtKey,
              udtFields.toString()
            );
            client.execute(query, (err1) => {
              udtCallback(err1);
            });
          };

          if (result.rows && result.rows.length > 0) {
            const udtKeys = Object.keys(options.udts[udtKey]);
            const udtValues = _.values(options.udts[udtKey]);
            for (let i = 0; i < udtValues.length; i++) {
              udtValues[i] = udtValues[i].replace(/[\s]/g, '');
              if (udtValues[i].indexOf('<') > -1 && udtValues[i].indexOf('frozen<') !== 0) {
                udtValues[i] = util.format('frozen<%s>', udtValues[i]);
              }
            }

            const fieldNames = result.rows[0].field_names;
            const fieldTypes = result.rows[0].field_types;
            for (let i = 0; i < fieldTypes.length; i++) {
              fieldTypes[i] = fieldTypes[i].replace(/[\s]/g, '');
              if (fieldTypes[i].indexOf('<') > -1 && fieldTypes[i].indexOf('frozen<') !== 0) {
                fieldTypes[i] = util.format('frozen<%s>', fieldTypes[i]);
              }
            }

            if (_.isEqual(udtKeys, fieldNames) && _.isEqual(udtValues, fieldTypes)) {
              udtCallback();
            } else {
              throw (new Error(
                util.format(
                  'User defined type "%s" already exists but does not match the udt definition. ' +
                  'Consider altering or droping the type.',
                  udtKey
                )
              ));
            }
          } else {
            createUDT();
          }
        });
      }, (err) => {
        callback(err);
      });
    } else {
      callback();
    }
  },

  _assert_user_defined_functions(callback) {
    const client = this._define_connection;
    const options = this._options;
    const keyspace = this._keyspace;

    if (options.udfs) {
      async.eachSeries(Object.keys(options.udfs), (udfKey, udfCallback) => {
        if (!options.udfs[udfKey].returnType) {
          throw (new Error(
            util.format('No returnType defined for user defined function: %s', udfKey)
          ));
        }
        if (!options.udfs[udfKey].language) {
          throw (new Error(
            util.format('No language defined for user defined function: %s', udfKey)
          ));
        }
        if (!options.udfs[udfKey].code) {
          throw (new Error(
            util.format('No code defined for user defined function: %s', udfKey)
          ));
        }
        if (options.udfs[udfKey].inputs && typeof options.udfs[udfKey].inputs !== 'object') {
          throw (new Error(
            util.format('inputs must be an object for user defined function: %s', udfKey)
          ));
        }
        if (options.udfs[udfKey].inputs instanceof Array) {
          throw (new Error(
            util.format('inputs must be an object, not an array for user defined function: %s', udfKey)
          ));
        }

        let query = util.format(
          "SELECT * FROM system_schema.functions WHERE keyspace_name = '%s' AND function_name = '%s';",
          keyspace,
          udfKey.toLowerCase()
        );
        client.execute(query, (err, result) => {
          if (err) {
            udfCallback(err);
            return;
          }

          const createUDF = () => {
            const udfInputs = [];
            if (options.udfs[udfKey].inputs) {
              Object.keys(options.udfs[udfKey].inputs).forEach((input) => {
                udfInputs.push(util.format(
                  '%s %s',
                  input,
                  options.udfs[udfKey].inputs[input]
                ));
              });
            }
            query = util.format(
              "CREATE OR REPLACE FUNCTION %s (%s) CALLED ON NULL INPUT RETURNS %s LANGUAGE %s AS '%s';",
              udfKey,
              udfInputs.toString(),
              options.udfs[udfKey].returnType,
              options.udfs[udfKey].language,
              options.udfs[udfKey].code
            );
            client.execute(query, (err1) => {
              udfCallback(err1);
            });
          };

          if (result.rows && result.rows.length > 0) {
            const udfLanguage = options.udfs[udfKey].language;
            const resultLanguage = result.rows[0].language;

            const udfCode = options.udfs[udfKey].code;
            const resultCode = result.rows[0].body;

            let udfReturnType = options.udfs[udfKey].returnType;
            udfReturnType = udfReturnType.replace(/[\s]/g, '');
            if (udfReturnType.indexOf('<') > -1 && udfReturnType.indexOf('frozen<') !== 0) {
              udfReturnType = util.format('frozen<%s>', udfReturnType);
            }
            let resultReturnType = result.rows[0].return_type;
            resultReturnType = resultReturnType.replace(/[\s]/g, '');
            if (resultReturnType.indexOf('<') > -1 && resultReturnType.indexOf('frozen<') !== 0) {
              resultReturnType = util.format('frozen<%s>', resultReturnType);
            }

            const udfInputs = options.udfs[udfKey].inputs ? options.udfs[udfKey].inputs : {};
            const udfInputKeys = Object.keys(udfInputs);
            const udfInputValues = _.values(udfInputs);
            for (let i = 0; i < udfInputValues.length; i++) {
              udfInputValues[i] = udfInputValues[i].replace(/[\s]/g, '');
              if (udfInputValues[i].indexOf('<') > -1 && udfInputValues[i].indexOf('frozen<') !== 0) {
                udfInputValues[i] = util.format('frozen<%s>', udfInputValues[i]);
              }
            }
            const resultArgumentNames = result.rows[0].argument_names;
            const resultArgumentTypes = result.rows[0].argument_types;
            for (let i = 0; i < resultArgumentTypes.length; i++) {
              resultArgumentTypes[i] = resultArgumentTypes[i].replace(/[\s]/g, '');
              if (resultArgumentTypes[i].indexOf('<') > -1 && resultArgumentTypes[i].indexOf('frozen<') !== 0) {
                resultArgumentTypes[i] = util.format('frozen<%s>', resultArgumentTypes[i]);
              }
            }

            if (udfLanguage === resultLanguage &&
              udfCode === resultCode &&
              udfReturnType === resultReturnType &&
              _.isEqual(udfInputKeys, resultArgumentNames) &&
              _.isEqual(udfInputValues, resultArgumentTypes)) {
              udfCallback();
            } else {
              createUDF();
            }
          } else {
            createUDF();
          }
        });
      }, (err) => {
        callback(err);
      });
    } else {
      callback();
    }
  },

  _assert_user_defined_aggregates(callback) {
    const client = this._define_connection;
    const options = this._options;
    const keyspace = this._keyspace;

    if (options.udas) {
      async.eachSeries(Object.keys(options.udas), (udaKey, udaCallback) => {
        if (!options.udas[udaKey].input_types) {
          throw (new Error(
            util.format('No input_types defined for user defined function: %s', udaKey)
          ));
        }
        if (!(options.udas[udaKey].input_types instanceof Array)) {
          throw (new Error(
            util.format('input_types must be an array for user defined function: %s', udaKey)
          ));
        }
        if (options.udas[udaKey].input_types.length < 1) {
          throw (new Error(
            util.format('input_types array cannot be blank for user defined function: %s', udaKey)
          ));
        }
        if (!options.udas[udaKey].sfunc) {
          throw (new Error(
            util.format('No sfunc defined for user defined aggregate: %s', udaKey)
          ));
        }
        if (!options.udas[udaKey].stype) {
          throw (new Error(
            util.format('No stype defined for user defined aggregate: %s', udaKey)
          ));
        }
        if (!options.udas[udaKey].initcond) {
          options.udas[udaKey].initcond = null;
        }

        let query = util.format(
          "SELECT * FROM system_schema.aggregates WHERE keyspace_name = '%s' AND aggregate_name = '%s';",
          keyspace,
          udaKey.toLowerCase()
        );
        client.execute(query, (err, result) => {
          if (err) {
            udaCallback(err);
            return;
          }

          const createUDA = () => {
            query = util.format(
              'CREATE OR REPLACE AGGREGATE %s (%s) SFUNC %s STYPE %s',
              udaKey,
              options.udas[udaKey].input_types.toString(),
              options.udas[udaKey].sfunc,
              options.udas[udaKey].stype
            );
            if (options.udas[udaKey].finalfunc) query += util.format(' FINALFUNC %s', options.udas[udaKey].finalfunc);
            query += util.format(' INITCOND %s;', options.udas[udaKey].initcond);

            client.execute(query, (err1) => {
              udaCallback(err1);
            });
          };

          if (result.rows && result.rows.length > 0) {
            const inputTypes = options.udas[udaKey].input_types;
            for (let i = 0; i < inputTypes.length; i++) {
              inputTypes[i] = inputTypes[i].replace(/[\s]/g, '');
              if (inputTypes[i].indexOf('<') > -1 && inputTypes[i].indexOf('frozen<') !== 0) {
                inputTypes[i] = util.format('frozen<%s>', inputTypes[i]);
              }
            }
            const sfunc = options.udas[udaKey].sfunc.toLowerCase();
            let stype = options.udas[udaKey].stype;
            stype = stype.replace(/[\s]/g, '');
            if (stype.indexOf('<') > -1 && stype.indexOf('frozen<') !== 0) {
              stype = util.format('frozen<%s>', stype);
            }
            let finalfunc = options.udas[udaKey].finalfunc;
            if (finalfunc) finalfunc = finalfunc.toLowerCase();
            else finalfunc = null;
            let initcond = options.udas[udaKey].initcond;
            if (initcond) initcond = initcond.replace(/[\s]/g, '');

            for (let i = 0; i < result.rows.length; i++) {
              const resultArgumentTypes = result.rows[i].argument_types;
              for (let j = 0; j < resultArgumentTypes.length; j++) {
                resultArgumentTypes[j] = resultArgumentTypes[j].replace(/[\s]/g, '');
                if (resultArgumentTypes[j].indexOf('<') > -1 && resultArgumentTypes[j].indexOf('frozen<') !== 0) {
                  resultArgumentTypes[j] = util.format('frozen<%s>', resultArgumentTypes[j]);
                }
              }

              const resultStateFunc = result.rows[i].state_func;
              let resultStateType = result.rows[i].state_type;
              resultStateType = resultStateType.replace(/[\s]/g, '');
              if (resultStateType.indexOf('<') > -1 && resultStateType.indexOf('frozen<') !== 0) {
                resultStateType = util.format('frozen<%s>', resultStateType);
              }

              const resultFinalFunc = result.rows[i].final_func;

              let resultInitcond = result.rows[i].initcond;
              if (resultInitcond) resultInitcond = resultInitcond.replace(/[\s]/g, '');

              if (sfunc === resultStateFunc &&
                stype === resultStateType &&
                finalfunc === resultFinalFunc &&
                initcond === resultInitcond &&
                _.isEqual(inputTypes, resultArgumentTypes)) {
                udaCallback();
                return;
              }
            }

            createUDA();
          } else {
            createUDA();
          }
        });
      }, (err) => {
        callback(err);
      });
    } else {
      callback();
    }
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

  uuid() {
    const uuid = types.Uuid.random();
    return uuid.toString();
  },

  timeuuid() {
    const timeuuid = types.TimeUuid.now();
    return timeuuid.toString();
  },

  connect(callback) {
    const onUserDefinedAggregates = (err) => {
      if (err) {
        callback(err);
        return;
      }
      callback(err, this);
    };

    const onUserDefinedFunctions = function f(err) {
      if (err) {
        callback(err);
        return;
      }
      this._assert_user_defined_aggregates(onUserDefinedAggregates.bind(this));
    };

    const onUserDefinedTypes = function f(err) {
      if (err) {
        callback(err);
        return;
      }
      this._assert_user_defined_functions(onUserDefinedFunctions.bind(this));
    };

    const onKeyspace = function f(err) {
      if (err) {
        callback(err);
        return;
      }
      this._set_client(new cql.Client(this._connection));
      this._assert_user_defined_types(onUserDefinedTypes.bind(this));
    };

    if (this._keyspace && this._options.createKeyspace) {
      this._assert_keyspace(onKeyspace.bind(this));
    } else {
      onKeyspace.call(this);
    }
  },

  add_model(modelName, modelSchema, callback) {
    if (!modelName || typeof (modelName) !== 'string') {
      throw (new Error('Model name must be a valid string'));
    }

    schemer.validate_model_schema(modelSchema);

    const baseProperties = {
      name: modelName,
      schema: modelSchema,
      keyspace: this._keyspace,
      define_connection: this._define_connection,
      cql: this._client,
      get_constructor: this.get_model.bind(this, modelName),
      connect: this.connect.bind(this),
      dropTableOnSchemaChange: this._options.dropTableOnSchemaChange,
      migration: this._options.migration,
    };

    return (this._models[modelName] = this._generate_model(baseProperties, callback));
  },

  get_model(modelName) {
    return this._models[modelName] || null;
  },

  close(callback) {
    callback = callback || noop;

    if (!this._client) {
      callback();
      return;
    }
    this._client.shutdown((err) => {
      if (!this._define_connection) {
        callback(err);
        return;
      }
      this._define_connection.shutdown((derr) => {
        callback(err || derr);
      });
    });
  },
};

module.exports = Apollo;
