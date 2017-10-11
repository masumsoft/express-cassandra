const util = require('util');
const _ = require('lodash');

const debug = require('debug')('express-cassandra');

const UdfBuilder = function f(client) {
  this._client = client;
};

UdfBuilder.prototype = {
  validate_definition(functionName, functionDefinition) {
    if (!functionDefinition.returnType) {
      throw (new Error(
        util.format('No returnType defined for user defined function: %s', functionName),
      ));
    }
    if (!functionDefinition.language) {
      throw (new Error(
        util.format('No language defined for user defined function: %s', functionName),
      ));
    }
    if (!functionDefinition.code) {
      throw (new Error(
        util.format('No code defined for user defined function: %s', functionName),
      ));
    }
    if (functionDefinition.inputs && !_.isPlainObject(functionDefinition.inputs)) {
      throw (new Error(
        util.format('inputs must be an object for user defined function: %s', functionName),
      ));
    }
    if (_.isArray(functionDefinition.inputs)) {
      throw (new Error(
        util.format('inputs must be an object, not an array for user defined function: %s', functionName),
      ));
    }
  },

  create_udf(functionName, functionDefinition, callback) {
    const udfInputs = [];
    if (functionDefinition.inputs) {
      Object.keys(functionDefinition.inputs).forEach((input) => {
        udfInputs.push(util.format(
          '%s %s',
          input,
          functionDefinition.inputs[input],
        ));
      });
    }
    const query = util.format(
      "CREATE OR REPLACE FUNCTION %s (%s) CALLED ON NULL INPUT RETURNS %s LANGUAGE %s AS '%s';",
      functionName,
      udfInputs.toString(),
      functionDefinition.returnType,
      functionDefinition.language,
      functionDefinition.code,
    );
    debug('executing query: %s', query);
    this._client.execute(query, (err) => {
      callback(err);
    });
  },

  get_udf(functionName, keyspaceName, callback) {
    const query = util.format(
      "SELECT * FROM system_schema.functions WHERE keyspace_name = '%s' AND function_name = '%s';",
      keyspaceName,
      functionName.toLowerCase(),
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

module.exports = UdfBuilder;
