const util = require('util');
const _ = require('lodash');

const debug = require('debug')('express-cassandra');

const UdaBuilder = function f(client) {
  this._client = client;
};

UdaBuilder.prototype = {
  validate_definition(aggregateName, aggregateDefinition) {
    if (!aggregateDefinition.input_types) {
      throw (new Error(util.format('No input_types defined for user defined function: %s', aggregateName)));
    }
    if (!_.isArray(aggregateDefinition.input_types)) {
      throw (new Error(util.format('input_types must be an array for user defined function: %s', aggregateName)));
    }
    if (aggregateDefinition.input_types.length < 1) {
      throw (new Error(util.format('input_types array cannot be blank for user defined function: %s', aggregateName)));
    }
    if (!aggregateDefinition.sfunc) {
      throw (new Error(util.format('No sfunc defined for user defined aggregate: %s', aggregateName)));
    }
    if (!aggregateDefinition.stype) {
      throw (new Error(util.format('No stype defined for user defined aggregate: %s', aggregateName)));
    }
  },

  create_uda(aggregateName, aggregateDefinition, callback) {
    let query = util.format(
      'CREATE OR REPLACE AGGREGATE %s (%s) SFUNC %s STYPE %s',
      aggregateName,
      aggregateDefinition.input_types.toString(),
      aggregateDefinition.sfunc,
      aggregateDefinition.stype,
    );
    if (aggregateDefinition.finalfunc) query += util.format(' FINALFUNC %s', aggregateDefinition.finalfunc);
    query += util.format(' INITCOND %s;', aggregateDefinition.initcond);

    debug('executing query: %s', query);
    this._client.execute(query, (err) => {
      callback(err);
    });
  },

  get_uda(aggregateName, keyspaceName, callback) {
    const query = util.format(
      "SELECT * FROM system_schema.aggregates WHERE keyspace_name = '%s' AND aggregate_name = '%s';",
      keyspaceName,
      aggregateName.toLowerCase(),
    );
    debug('executing query: %s', query);
    this._client.execute(query, (err, result) => {
      if (err) {
        callback(err);
        return;
      }

      if (result.rows && result.rows.length > 0) {
        callback(null, result.rows);
        return;
      }

      callback();
    });
  },
};

module.exports = UdaBuilder;
