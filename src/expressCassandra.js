const Promise = require('bluebird');

const fs = require('fs');
const util = require('util');
const async = require('async');
const _ = require('lodash');

const cql = Promise.promisifyAll(require('dse-driver'));
const ORM = Promise.promisifyAll(require('./orm/apollo'));
const debug = require('debug')('express-cassandra');

const CassandraClient = function f(options) {
  const self = this;
  self.modelInstance = {};
  self.orm = new ORM(options.clientOptions, options.ormOptions);
};

CassandraClient.createClient = (options) => (new CassandraClient(options));

CassandraClient.setDirectory = (directory) => {
  CassandraClient.directory = directory;
  return CassandraClient;
};

CassandraClient.bind = (options, cb) => {
  const self = CassandraClient;
  self.modelInstance = {};
  self.orm = new ORM(options.clientOptions, options.ormOptions);
  self.orm.connect((err) => {
    if (err) {
      if (cb) cb(err);
      return;
    }

    fs.readdir(self.directory, (err1, list) => {
      if (err1) {
        if (cb) cb(err1);
        return;
      }

      async.each(list, (file, callback) => {
        const fileName = util.format('%s/%s', self.directory, file);
        const validFileExtensions = [
          'js', 'javascript', 'jsx', 'coffee', 'coffeescript', 'iced',
          'script', 'ts', 'tsx', 'typescript', 'cjsx', 'co', 'json',
          'json5', 'litcoffee', 'liticed', 'ls', 'node', 'toml', 'wisp',
        ];
        const fileExtension = _.last(fileName.split('.')).toLowerCase();

        if (fileName.indexOf('Model') === -1 || validFileExtensions.indexOf(fileExtension) === -1) {
          callback();
          return;
        }

        const modelName = self._translateFileNameToModelName(file);

        if (modelName) {
          const modelSchema = require(fileName);
          self.modelInstance[modelName] = self.orm.add_model(
            modelName.toLowerCase(),
            modelSchema,
            (err2) => {
              if (err2) callback(err2);
              else callback();
            }
          );
          self.modelInstance[modelName] = Promise.promisifyAll(self.modelInstance[modelName]);
        } else {
          callback();
        }
      }, (err3) => {
        if (err3 && cb) {
          cb(err3);
        } else if (cb) {
          cb();
        }
      });
    });
  });
};

CassandraClient.bindAsync = Promise.promisify(CassandraClient.bind);

CassandraClient.prototype.connect = function f(callback) {
  const self = this;
  self.orm.connect(callback);
};

CassandraClient.prototype.connectAsync = Promise.promisify(CassandraClient.prototype.connect);

CassandraClient.prototype.loadSchema = function f(modelName, modelSchema, callback) {
  const self = this;
  const cb = function cb(err) {
    if (typeof callback === 'function') {
      if (err) callback(err);
      else callback(null, self.modelInstance[modelName]);
    }
  };
  self.modelInstance[modelName] = self.orm.add_model(modelName, modelSchema, cb);
  self.modelInstance[modelName] = Promise.promisifyAll(self.modelInstance[modelName]);
  return self.modelInstance[modelName];
};

CassandraClient.prototype.loadSchemaAsync = function f(modelName, modelSchema) {
  return new Promise((resolve, reject) => {
    this.loadSchema(modelName, modelSchema, (err, Model) => {
      if (err) reject(err);
      else resolve(Model);
    });
  });
};

CassandraClient.uuid = () => (cql.types.Uuid.random());

CassandraClient.uuidFromString = (str) => (cql.types.Uuid.fromString(str));

CassandraClient.timeuuid = () => (cql.types.TimeUuid.now());

CassandraClient.timeuuidFromDate = (date) => (cql.types.TimeUuid.fromDate(date));

CassandraClient.timeuuidFromString = (str) => (cql.types.TimeUuid.fromString(str));

CassandraClient.maxTimeuuid = (date) => (cql.types.TimeUuid.max(date));

CassandraClient.minTimeuuid = (date) => (cql.types.TimeUuid.min(date));

CassandraClient.prototype.doBatch = function f(queries, options, callback) {
  const randomModel = this.modelInstance[Object.keys(this.modelInstance)[0]];
  const builtQueries = [];
  for (let i = 0; i < queries.length; i++) {
    builtQueries.push({
      query: queries[i].query,
      params: queries[i].params,
    });
  }
  if (builtQueries.length > 1) {
    randomModel.execute_batch(builtQueries, options, (err) => {
      if (err) callback(err);
      else callback();
    });
    return;
  }
  if (builtQueries.length > 0) {
    debug('single query provided for batch request, applying as non batch query');
    randomModel.execute_query(builtQueries[0].query, builtQueries[0].params, options, (err) => {
      if (err) callback(err);
      else callback();
    });
    return;
  }
  debug('no queries provided for batch request, empty array found, doing nothing');
  callback();
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
CassandraClient.prototype.timeuuid = CassandraClient.timeuuid;
CassandraClient.prototype.timeuuidFromDate = CassandraClient.timeuuidFromDate;
CassandraClient.prototype.timeuuidFromString = CassandraClient.timeuuidFromString;
CassandraClient.prototype.maxTimeuuid = CassandraClient.maxTimeuuid;
CassandraClient.prototype.minTimeuuid = CassandraClient.minTimeuuid;

CassandraClient.prototype._translateFileNameToModelName = CassandraClient._translateFileNameToModelName;

module.exports = CassandraClient;
