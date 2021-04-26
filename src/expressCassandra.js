const semver = require('semver');

if (!semver.satisfies(process.version, '>=6.0.0')) {
  require('babel-polyfill');
}

const Promise = require('bluebird');
const _ = require('lodash');
const path = require('path');

let dseDriver;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
  dseDriver = require('dse-driver');
} catch (e) {
  dseDriver = null;
}

const cql = Promise.promisifyAll(dseDriver || require('cassandra-driver'));

const ORM = Promise.promisifyAll(require('./orm/apollo'));
const readdirpAsync = Promise.promisify(require('readdirp'));
const debug = require('debug')('express-cassandra');

const exporter = require('./utils/exporter');
const importer = require('./utils/importer');

function _translateFileNameToModelName(fileName) {
  return fileName.slice(0, fileName.lastIndexOf('.')).replace('Model', '');
}

function syncModelFileToDB(file, callback) {
  if (!file.name.includes('Model')) {
    callback();
    return;
  }

  const modelName = this._translateFileNameToModelName(file.name);

  if (modelName) {
    const fileLocation = path.join(this.directory, file.path);
    // eslint-disable-next-line import/no-dynamic-require
    const modelSchema = require(fileLocation);
    this.modelInstance[modelName] = this.orm.addModel(modelName.toLowerCase(), modelSchema);
    this.modelInstance[modelName].syncDB(callback);
    this.modelInstance[modelName] = Promise.promisifyAll(this.modelInstance[modelName]);
    return;
  }

  callback();
}

function setDirectory(directory) {
  this.directory = directory;
  return this;
}

const CassandraClient = function f(options) {
  this.modelInstance = {};
  this.orm = new ORM(options.clientOptions, options.ormOptions);
  this.orm = Promise.promisifyAll(this.orm);
  this.directory = null;
  this.setDirectory = setDirectory.bind(this);
  this.syncModelFileToDB = syncModelFileToDB.bind(this);
  this._translateFileNameToModelName = _translateFileNameToModelName.bind(this);
  Object.defineProperties(this, {
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
};

CassandraClient.setDirectory = setDirectory;
CassandraClient.syncModelFileToDB = syncModelFileToDB;
CassandraClient._translateFileNameToModelName = _translateFileNameToModelName;

CassandraClient.createClient = (options) => (new CassandraClient(options));

CassandraClient.bind = (options, cb) => {
  const instance = CassandraClient.createClient(options);
  instance.setDirectory(CassandraClient.directory);
  instance.orm.initAsync()
    .then(() => readdirpAsync({
      root: instance.directory,
      fileFilter: [
        '*.js', '*.javascript', '*.jsx', '*.coffee', '*.coffeescript', '*.iced',
        '*.script', '*.ts', '*.tsx', '*.typescript', '*.cjsx', '*.co', '*.json',
        '*.json5', '*.litcoffee', '*.liticed', '*.ls', '*.node', '*.toml', '*.wisp',
      ],
    }))
    .then((fileList) => {
      const syncModelTasks = [];
      const syncModelFileToDBAsync = Promise.promisify(instance.syncModelFileToDB);
      fileList = fileList.files;
      fileList.forEach((file) => {
        syncModelTasks.push(syncModelFileToDBAsync(file));
      });
      CassandraClient.modelInstance = instance.modelInstance;
      CassandraClient.orm = instance.orm;
      return Promise.all(syncModelTasks);
    })
    .then(() => {
      if (cb) cb(null, instance);
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
    .then((tables) =>
      Promise.each(tables, (table) =>
        exporter.processTableExport(systemClient, fixtureDirectory, keyspace, table)))
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

CassandraClient.import = function f(fixtureDirectory, options, callback) {
  if (arguments.length === 2) {
    callback = options;
    options = {};
  }

  const defaults = {
    batchSize: 1,
  };

  options = _.defaultsDeep(options, defaults);

  const systemClient = this.orm.get_system_client();
  const keyspace = this.orm.get_keyspace_name();

  systemClient.connect()
    .then(() => this.getTableListAsync())
    .then((tables) =>
      Promise.each(tables, (table) =>
        importer.processTableImport(systemClient, fixtureDirectory, keyspace, table, options.batchSize)))
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
  const beforeHooks = [];

  let batchResult;
  Promise.all(beforeHooks)
    .then(() => {
      if (queries.length > 1) {
        return randomModel.execute_batchAsync(queries, options);
      }
      if (queries.length > 0) {
        debug('single query provided for batch request, applying as non batch query');
        return randomModel.execute_queryAsync(queries[0].query, queries[0].params, options);
      }
      debug('no queries provided for batch request, empty array found, doing nothing');
      return {};
    })
    .then((response) => {
      batchResult = response;
      for (let i = 0; i < queries.length; i++) {
        const afterHookResponse = queries[i].after_hook();
        if (afterHookResponse !== true) {
          callback(afterHookResponse);
          return;
        }
      }
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
