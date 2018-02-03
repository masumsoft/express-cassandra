const debug = require('debug')('express-cassandra');

const ElassandraBuilder = function f(client) {
  this._client = client;
};

ElassandraBuilder.prototype = {
  create_index(keyspaceName, indexName, callback) {
    debug('creating elassandra index: %s', indexName);
    this._client.indices.create({
      index: indexName,
      body: {
        settings: {
          keyspace: keyspaceName,
        },
      },
    }, (err) => {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  },

  check_index_exist(indexName, callback) {
    debug('check for elassandra index: %s', indexName);
    this._client.indices.exists({ index: indexName }, (err, res) => {
      if (err) {
        callback(err);
        return;
      }

      callback(null, res);
    });
  },

  assert_index(keyspaceName, indexName, callback) {
    this.check_index_exist(indexName, (err, exist) => {
      if (err) {
        callback(err);
        return;
      }

      if (!exist) {
        this.create_index(keyspaceName, indexName, callback);
        return;
      }

      callback();
    });
  },

  delete_index(indexName, callback) {
    debug('removing elassandra index: %s', indexName);
    this._client.indices.delete({
      index: indexName,
    }, (err) => {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  },

  put_mapping(indexName, mappingName, mappingBody, callback) {
    debug('syncing elassandra mapping: %s', mappingName);
    this._client.indices.putMapping({
      index: indexName,
      type: mappingName,
      body: mappingBody,
    }, (err) => {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  },
};

module.exports = ElassandraBuilder;
