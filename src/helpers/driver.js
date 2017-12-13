const _ = require('lodash');

const debug = require('debug')('express-cassandra');

const Driver = function f(properties) {
  this._properties = properties;
};

Driver.prototype = {
  ensure_init(callback) {
    if (!this._properties.cql) {
      this._properties.init(callback);
    } else {
      callback();
    }
  },

  execute_definition_query(query, callback) {
    this.ensure_init((err) => {
      if (err) {
        callback(err);
        return;
      }
      debug('executing definition query: %s', query);
      const properties = this._properties;
      const conn = properties.define_connection;
      conn.execute(query, [], { prepare: false, fetchSize: 0 }, callback);
    });
  },

  execute_query(query, params, options, callback) {
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }

    const defaults = {
      prepare: true,
    };

    options = _.defaultsDeep(options, defaults);

    this.ensure_init((err) => {
      if (err) {
        callback(err);
        return;
      }
      debug('executing query: %s with params: %j', query, params);
      this._properties.cql.execute(query, params, options, (err1, result) => {
        if (err1 && err1.code === 8704) {
          this.execute_definition_query(query, callback);
        } else {
          callback(err1, result);
        }
      });
    });
  },

  execute_batch(queries, options, callback) {
    if (arguments.length === 2) {
      callback = options;
      options = {};
    }

    const defaults = {
      prepare: true,
    };

    options = _.defaultsDeep(options, defaults);

    this.ensure_init((err) => {
      if (err) {
        callback(err);
        return;
      }
      debug('executing batch queries: %j', queries);
      this._properties.cql.batch(queries, options, callback);
    });
  },

  execute_eachRow(query, params, options, onReadable, callback) {
    this.ensure_init((err) => {
      if (err) {
        callback(err);
        return;
      }
      debug('executing eachRow query: %s with params: %j', query, params);
      this._properties.cql.eachRow(query, params, options, onReadable, callback);
    });
  },

  execute_stream(query, params, options, onReadable, callback) {
    this.ensure_init((err) => {
      if (err) {
        callback(err);
        return;
      }
      debug('executing stream query: %s with params: %j', query, params);
      this._properties.cql.stream(query, params, options).on('readable', onReadable).on('end', callback);
    });
  },
};

module.exports = Driver;
