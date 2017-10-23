const Promise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const tryRequire = require('try-require');

const dseDriver = tryRequire('dse-driver');
const cql = Promise.promisifyAll(dseDriver || require('cassandra-driver'));

const ORM = Promise.promisifyAll(require('./orm/apollo'));
const readdirpAsync = Promise.promisify(require('readdirp'));
const debug = require('debug')('express-cassandra');

const exporter = require('./utils/exporter');
const importer = require('./utils/importer');

const CassandraClient = function f(options) {
  this.modelInstance = {};
  this.orm = new ORM(options.clientOptions, options.ormOptions);
  this.orm = Promise.promisifyAll(this.orm);
};

CassandraClient.createClient = (options) => (new CassandraClient(options));

CassandraClient.setDirectory = (directory) => {
  CassandraClient.directory = directory;
  return CassandraClient;
};

CassandraClient.syncModelFileToDB = (file, callback) => {
  if (!file.name.includes('Model')) {
    callback();
    return;
  }

  const modelName = CassandraClient._translateFileNameToModelName(file.name);

  if (modelName) {
    const fileLocation = path.join(CassandraClient.directory, file.path);
    // eslint-disable-next-line import/no-dynamic-require
    const modelSchema = require(fileLocation);
    CassandraClient.modelInstance[modelName] = CassandraClient.orm.addModel(modelName.toLowerCase(), modelSchema);
    CassandraClient.modelInstance[modelName].syncDB(callback);
    CassandraClient.modelInstance[modelName] = Promise.promisifyAll(CassandraClient.modelInstance[modelName]);
    return;
  }

  callback();
};

CassandraClient.bind = (options, cb) => {
  CassandraClient.modelInstance = {};
  CassandraClient.orm = new ORM(options.clientOptions, options.ormOptions);
  CassandraClient.orm = Promise.promisifyAll(CassandraClient.orm);
  CassandraClient.orm.initAsync()
    .then(() => readdirpAsync({
      root: CassandraClient.directory,
      fileFilter: [
        '*.js', '*.javascript', '*.jsx', '*.coffee', '*.coffeescript', '*.iced',
        '*.script', '*.ts', '*.tsx', '*.typescript', '*.cjsx', '*.co', '*.json',
        '*.json5', '*.litcoffee', '*.liticed', '*.ls', '*.node', '*.toml', '*.wisp',
      ],
    }))
    .then((fileList) => {
      const syncModelTasks = [];
      const syncModelFileToDBAsync = Promise.promisify(CassandraClient.syncModelFileToDB);
      fileList = fileList.files;
      fileList.forEach((file) => {
        syncModelTasks.push(syncModelFileToDBAsync(file));
      });
      return Promise.all(syncModelTasks);
    })
    .then(() => {
      if (cb) cb();
    })
    .catch((err) => {
      if (cb && _.isArray(err) && err.length > 0) cb(err[0]);
      else if (cb) cb(err);
    });
};

CassandraClient.bindAsync = Promise.promisify(CassandraClient.bind);

CassandraClient.prototype.init = function f(callback) {
  this.orm.init(callback);
};

CassandraClient.prototype.initAsync = Promise.promisify(CassandraClient.prototype.init);

CassandraClient.getTableList = function f(callback) {
  const systemClient = this.orm.get_system_client();
  const keyspace = this.orm.get_keyspace_name();
  const tables = [];

  systemClient.connect()
    .then(() => {
      const systemQuery = 'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?';
      debug(`Finding tables in keyspace: ${keyspace}`);
      return systemClient.execute(systemQuery, [keyspace]);
    })
    .then((result) => {
      for (let i = 0; i < result.rows.length; i++) {
        tables.push(result.rows[i].table_name);
      }
    })
    .then(() => systemClient.shutdown())
    .then(() => {
      callback(null, tables);
    })
    .catch((err) => {
      callback(err);
    });
};

CassandraClient.getTableListAsync = Promise.promisify(CassandraClient.getTableList);

CassandraClient.export = function f(fixtureDirectory, callback) {
  const systemClient = this.orm.get_system_client();
  const keyspace = this.orm.get_keyspace_name();

  systemClient.connect()
    .then(() => this.getTableListAsync())
    .then((tables) => Promise.each(tables, (table) => exporter.processTableExport(
      systemClient, fixtureDirectory, keyspace, table,
    )))
    .then(() => systemClient.shutdown())
    .then(() => {
      debug('==================================================');
      debug(`Completed exporting all tables from keyspace: ${keyspace}`);
      callback();
    })
    .catch((err) => {
      debug(err);
      callback(err);
    });
};

CassandraClient.exportAsync = Promise.promisify(CassandraClient.export);

CassandraClient.import = function f(fixtureDirectory, callback) {
  const systemClient = this.orm.get_system_client();
  const keyspace = this.orm.get_keyspace_name();

  systemClient.connect()
    .then(() => this.getTableListAsync())
    .then((tables) => Promise.each(tables, (table) => importer.processTableImport(
      systemClient, fixtureDirectory, keyspace, table,
    )))
    .then(() => systemClient.shutdown())
    .then(() => {
      debug('==================================================');
      debug(`Completed importing to keyspace: ${keyspace}`);
      callback();
    })
    .catch((err) => {
      debug(err);
      callback(err);
    });
};

CassandraClient.importAsync = Promise.promisify(CassandraClient.import);

CassandraClient.prototype.loadSchema = function f(modelName, modelSchema) {
  this.modelInstance[modelName] = this.orm.addModel(modelName, modelSchema);
  this.modelInstance[modelName] = Promise.promisifyAll(this.modelInstance[modelName]);
  return this.modelInstance[modelName];
};

CassandraClient.uuid = () => (cql.types.Uuid.random());

CassandraClient.uuidFromString = (str) => (cql.types.Uuid.fromString(str));

CassandraClient.uuidFromBuffer = (buf) => (new cql.types.Uuid(buf));

CassandraClient.timeuuid = () => (cql.types.TimeUuid.now());

CassandraClient.timeuuidFromDate = (date) => (cql.types.TimeUuid.fromDate(date));

CassandraClient.timeuuidFromString = (str) => (cql.types.TimeUuid.fromString(str));

CassandraClient.timeuuidFromBuffer = (buf) => (new cql.types.TimeUuid(buf));

CassandraClient.maxTimeuuid = (date) => (cql.types.TimeUuid.max(date));

CassandraClient.minTimeuuid = (date) => (cql.types.TimeUuid.min(date));

CassandraClient.prototype.doBatch = function f(queries, options, callback) {
  if (arguments.length === 2) {
    callback = options;
    options = {};
  }

  const defaults = {
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  const randomModel = this.modelInstance[Object.keys(this.modelInstance)[0]];
  const builtQueries = [];
  const beforeHooks = [];
  for (let i = 0; i < queries.length; i++) {
    builtQueries.push({
      query: queries[i].query,
      params: queries[i].params,
    });
  }

  let batchResult;
  Promise.all(beforeHooks)
    .then(() => {
      if (builtQueries.length > 1) {
        return randomModel.execute_batchAsync(builtQueries, options);
      }
      if (builtQueries.length > 0) {
        debug('single query provided for batch request, applying as non batch query');
        return randomModel.execute_queryAsync(builtQueries[0].query, builtQueries[0].params, options);
      }
      debug('no queries provided for batch request, empty array found, doing nothing');
      return {};
    })
    .then((response) => {
      batchResult = response;
      const afterHooks = [];
      for (let i = 0; i < queries.length; i++) {
        const afterHookAsync = Promise.promisify(queries[i].after_hook);
        afterHooks.push(afterHookAsync());
      }
      return Promise.all(afterHooks);
    })
    .then(() => {
      callback(null, batchResult);
    })
    .catch((err) => {
      callback(err);
    });
};

CassandraClient.prototype.doBatchAsync = Promise.promisify(CassandraClient.prototype.doBatch);

CassandraClient.doBatch = function f(queries, options, callback) {
  if (arguments.length === 2) {
    callback = options;
    options = {};
  }

  const defaults = {
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  CassandraClient.prototype.doBatch.call(CassandraClient, queries, options, callback);
};

CassandraClient.doBatchAsync = Promise.promisify(CassandraClient.doBatch);

CassandraClient._translateFileNameToModelName = (fileName) => (
  fileName.slice(0, fileName.lastIndexOf('.')).replace('Model', '')
);

Object.defineProperties(CassandraClient, {
  consistencies: {
    get() {
      return cql.types.consistencies;
    },
  },
  datatypes: {
    get() {
      return cql.types;
    },
  },
  driver: {
    get() {
      return cql;
    },
  },
  instance: {
    get() {
      return CassandraClient.modelInstance;
    },
  },
  close: {
    get() {
      return CassandraClient.orm.close;
    },
  },
  closeAsync: {
    get() {
      return Promise.promisify(CassandraClient.orm.close);
    },
  },
});


Object.defineProperties(CassandraClient.prototype, {
  consistencies: {
    get() {
      return cql.types.consistencies;
    },
  },
  datatypes: {
    get() {
      return cql.types;
    },
  },
  driver: {
    get() {
      return cql;
    },
  },
  instance: {
    get() {
      return this.modelInstance;
    },
  },
  close: {
    get() {
      return this.orm.close;
    },
  },
  closeAsync: {
    get() {
      return Promise.promisify(this.orm.close);
    },
  },
});

CassandraClient.prototype.uuid = CassandraClient.uuid;
CassandraClient.prototype.uuidFromString = CassandraClient.uuidFromString;
CassandraClient.prototype.uuidFromBuffer = CassandraClient.uuidFromBuffer;
CassandraClient.prototype.timeuuid = CassandraClient.timeuuid;
CassandraClient.prototype.timeuuidFromDate = CassandraClient.timeuuidFromDate;
CassandraClient.prototype.timeuuidFromString = CassandraClient.timeuuidFromString;
CassandraClient.prototype.timeuuidFromBuffer = CassandraClient.timeuuidFromBuffer;
CassandraClient.prototype.maxTimeuuid = CassandraClient.maxTimeuuid;
CassandraClient.prototype.minTimeuuid = CassandraClient.minTimeuuid;

CassandraClient.prototype._translateFileNameToModelName = CassandraClient._translateFileNameToModelName;

module.exports = CassandraClient;
