const util = require('util');

const debug = require('debug')('express-cassandra');

const UdtBuilder = function f(client) {
  this._client = client;
};

UdtBuilder.prototype = {
  create_udt(typeName, typeDef, callback) {
    const udtFields = [];
    Object.keys(typeDef).forEach((field) => {
      udtFields.push(util.format(
        '"%s" %s',
        field,
        typeDef[field],
      ));
    });
    const query = util.format(
      'CREATE TYPE IF NOT EXISTS "%s" (%s);',
      typeName,
      udtFields.toString(),
    );
    debug('executing query: %s', query);
    this._client.execute(query, (err) => {
      callback(err);
    });
  },

  get_udt(typeName, keyspaceName, callback) {
    const query = util.format(
      "SELECT * FROM system_schema.types WHERE keyspace_name = '%s' AND type_name = '%s';",
      keyspaceName,
      typeName,
    );
    debug('executing query: %s', query);
    this._client.execute(query, (err, result) => {
      if (err) {
        callback(err);
        return;
      }

      if (result.rows && result.rows.length > 0) {
        callback(null, result.rows[0]);
        return;
      }

      callback();
    });
  },
};

module.exports = UdtBuilder;
