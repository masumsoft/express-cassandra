const fs = require('fs');
const util = require('util');
const async = require('async');
const cql = require('cassandra-driver');
const ORM = require('./orm/apollo');

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
        if (fileName.indexOf('Model') === -1) {
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

CassandraClient.prototype.connect = function f(callback) {
  const self = this;
  self.orm.connect(callback);
};

CassandraClient.prototype.loadSchema = function f(modelName, modelSchema, callback) {
  const self = this;
  self.modelInstance[modelName] = self.orm.add_model(
    modelName,
    modelSchema,
    callback
  );
  return self.modelInstance[modelName];
};

CassandraClient.timeuuid = (date, maxOrMin) => {
  let timeuuid;
  if (date) {
    if (date instanceof Date) {
      timeuuid = cql.types.TimeUuid.fromDate(date);
    } else if (date instanceof String) {
      timeuuid = cql.types.TimeUuid.fromString(date);
    } else {
      throw (new Error('Invalid date provided to timeuuid'));
    }
  } else {
    timeuuid = cql.types.TimeUuid.now();
  }

  if (maxOrMin) {
    switch (maxOrMin.toLowerCase) {
      case 'min':
        timeuuid = timeuuid.min();
        break;
      default:
        timeuuid = timeuuid.max();
    }
  }

  return timeuuid;
};

CassandraClient.uuid = () => (cql.types.Uuid.random());

CassandraClient.uuidFromString = (string) => (cql.types.Uuid.fromString(string));

CassandraClient.prototype.doBatch = function f(queries, options, callback) {
  const randomModel = this.modelInstance[Object.keys(this.modelInstance)[0]];
  const builtQueries = [];
  for (let i = 0; i < queries.length; i++) {
    builtQueries.push({
      query: queries[i].query,
      params: queries[i].params,
    });
  }
  randomModel.execute_batch(builtQueries, options, (err) => {
    if (err) callback(err);
    else callback();
  });
};

CassandraClient.doBatch = function f(queries, options, callback) {
  if (arguments.length === 2) {
    callback = options;
    options = { prepare: true };
  }
  CassandraClient.prototype.doBatch.call(CassandraClient, queries, options, callback);
};

CassandraClient.maxTimeuuid = (date) => (CassandraClient.timeuuid(date, 'max'));

CassandraClient.minTimeuuid = (date) => (CassandraClient.timeuuid(date, 'min'));

CassandraClient.prototype.maxTimeuuid = function f(date) {
  return this.timeuuid(date, 'max');
};

CassandraClient.prototype.minTimeuuid = function f(date) {
  return this.timeuuid(date, 'min');
};


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
});


CassandraClient.prototype.uuid = CassandraClient.uuid;
CassandraClient.prototype.uuidFromString = CassandraClient.uuidFromString;
CassandraClient.prototype.timeuuid = CassandraClient.timeuuid;
CassandraClient.prototype._translateFileNameToModelName = CassandraClient._translateFileNameToModelName;

module.exports = CassandraClient;
