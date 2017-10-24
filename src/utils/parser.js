const Promise = require('bluebird');
const _ = require('lodash');
const util = require('util');
const tryRequire = require('try-require');

const dseDriver = tryRequire('dse-driver');
const cql = Promise.promisifyAll(dseDriver || require('cassandra-driver'));

const buildError = require('../orm/apollo_error.js');
const datatypes = require('../validators/datatypes');
const schemer = require('../validators/schema');

const parser = {};

parser.callback_or_throw = function f(err, callback) {
  if (typeof callback === 'function') {
    callback(err);
    return;
  }
  throw (err);
};

parser.extract_type = function f(val) {
  // decompose composite types
  const decomposed = val ? val.replace(/[\s]/g, '').split(/[<,>]/g) : [''];

  for (let d = 0; d < decomposed.length; d++) {
    if (_.has(datatypes, decomposed[d])) {
      return decomposed[d];
    }
  }

  return val;
};

parser.extract_typeDef = function f(val) {
  // decompose composite types
  let decomposed = val ? val.replace(/[\s]/g, '') : '';
  decomposed = decomposed.substr(decomposed.indexOf('<'), decomposed.length - decomposed.indexOf('<'));

  return decomposed;
};

parser.extract_altered_type = function f(normalizedModelSchema, diff) {
  const fieldName = diff.path[0];
  let type = '';
  if (diff.path.length > 1) {
    if (diff.path[1] === 'type') {
      type = diff.rhs;
      if (normalizedModelSchema.fields[fieldName].typeDef) {
        type += normalizedModelSchema.fields[fieldName].typeDef;
      }
    } else {
      type = normalizedModelSchema.fields[fieldName].type;
      type += diff.rhs;
    }
  } else {
    type = diff.rhs.type;
    if (diff.rhs.typeDef) type += diff.rhs.typeDef;
  }
  return type;
};

parser.build_db_value_expression = function f(schema, fieldName, fieldValue) {
  if (fieldValue == null || fieldValue === cql.types.unset) {
    return { query_segment: '?', parameter: fieldValue };
  }

  if (_.isPlainObject(fieldValue) && fieldValue.$db_function) {
    return fieldValue.$db_function;
  }

  const fieldType = schemer.get_field_type(schema, fieldName);
  const validators = schemer.get_validators(schema, fieldName);

  if (_.isArray(fieldValue) && fieldType !== 'list' && fieldType !== 'set' && fieldType !== 'frozen') {
    const val = fieldValue.map((v) => {
      const dbVal = parser.build_db_value_expression(schema, fieldName, v);

      if (_.isPlainObject(dbVal) && dbVal.query_segment) return dbVal.parameter;
      return dbVal;
    });

    return { query_segment: '?', parameter: val };
  }

  const validationMessage = schemer.get_validation_message(validators, fieldValue);
  if (typeof validationMessage === 'function') {
    throw (buildError('model.validator.invalidvalue', validationMessage(fieldValue, fieldName, fieldType)));
  }

  if (fieldType === 'counter') {
    let counterQuerySegment = util.format('"%s"', fieldName);
    if (fieldValue >= 0) counterQuerySegment += ' + ?';
    else counterQuerySegment += ' - ?';
    fieldValue = Math.abs(fieldValue);
    return { query_segment: counterQuerySegment, parameter: fieldValue };
  }

  return { query_segment: '?', parameter: fieldValue };
};

parser.unset_not_allowed = function f(operation, schema, fieldName, callback) {
  if (schemer.is_primary_key_field(schema, fieldName)) {
    parser.callback_or_throw(buildError(`model.${operation}.unsetkey`, fieldName), callback);
    return true;
  }
  if (schemer.is_required_field(schema, fieldName)) {
    parser.callback_or_throw(buildError(`model.${operation}.unsetrequired`, fieldName), callback);
    return true;
  }
  return false;
};

parser.build_inplace_update_expression = function f(schema, fieldName, fieldValue, updateClauses, queryParams) {
  const $add = (_.isPlainObject(fieldValue) && fieldValue.$add) || false;
  const $append = (_.isPlainObject(fieldValue) && fieldValue.$append) || false;
  const $prepend = (_.isPlainObject(fieldValue) && fieldValue.$prepend) || false;
  const $replace = (_.isPlainObject(fieldValue) && fieldValue.$replace) || false;
  const $remove = (_.isPlainObject(fieldValue) && fieldValue.$remove) || false;

  fieldValue = $add || $append || $prepend || $replace || $remove || fieldValue;

  const dbVal = parser.build_db_value_expression(schema, fieldName, fieldValue);

  if (!_.isPlainObject(dbVal) || !dbVal.query_segment) {
    updateClauses.push(util.format('"%s"=%s', fieldName, dbVal));
    return;
  }

  const fieldType = schemer.get_field_type(schema, fieldName);

  if (['map', 'list', 'set'].includes(fieldType)) {
    if ($add || $append) {
      dbVal.query_segment = util.format('"%s" + %s', fieldName, dbVal.query_segment);
    } else if ($prepend) {
      if (fieldType === 'list') {
        dbVal.query_segment = util.format('%s + "%s"', dbVal.query_segment, fieldName);
      } else {
        throw (buildError(
          'model.update.invalidprependop',
          util.format('%s datatypes does not support $prepend, use $add instead', fieldType),
        ));
      }
    } else if ($remove) {
      dbVal.query_segment = util.format('"%s" - %s', fieldName, dbVal.query_segment);
      if (fieldType === 'map') dbVal.parameter = Object.keys(dbVal.parameter);
    }
  }

  if ($replace) {
    if (fieldType === 'map') {
      updateClauses.push(util.format('"%s"[?]=%s', fieldName, dbVal.query_segment));
      const replaceKeys = Object.keys(dbVal.parameter);
      const replaceValues = _.values(dbVal.parameter);
      if (replaceKeys.length === 1) {
        queryParams.push(replaceKeys[0]);
        queryParams.push(replaceValues[0]);
      } else {
        throw (
          buildError('model.update.invalidreplaceop', '$replace in map does not support more than one item')
        );
      }
    } else if (fieldType === 'list') {
      updateClauses.push(util.format('"%s"[?]=%s', fieldName, dbVal.query_segment));
      if (dbVal.parameter.length === 2) {
        queryParams.push(dbVal.parameter[0]);
        queryParams.push(dbVal.parameter[1]);
      } else {
        throw (buildError(
          'model.update.invalidreplaceop',
          '$replace in list should have exactly 2 items, first one as the index and the second one as the value',
        ));
      }
    } else {
      throw (buildError(
        'model.update.invalidreplaceop',
        util.format('%s datatypes does not support $replace', fieldType),
      ));
    }
  } else {
    updateClauses.push(util.format('"%s"=%s', fieldName, dbVal.query_segment));
    queryParams.push(dbVal.parameter);
  }
};

parser.build_update_value_expression = function f(instance, schema, updateValues, callback) {
  const updateClauses = [];
  const queryParams = [];

  if (schema.options && schema.options.timestamps) {
    if (!updateValues[schema.options.timestamps.updatedAt]) {
      updateValues[schema.options.timestamps.updatedAt] = { $db_function: 'toTimestamp(now())' };
    }
  }

  if (schema.options && schema.options.versions) {
    if (!updateValues[schema.options.versions.key]) {
      updateValues[schema.options.versions.key] = { $db_function: 'now()' };
    }
  }

  const errorHappened = Object.keys(updateValues).some((fieldName) => {
    if (schema.fields[fieldName] === undefined || schema.fields[fieldName].virtual) return false;

    const fieldType = schemer.get_field_type(schema, fieldName);
    let fieldValue = updateValues[fieldName];

    if (fieldValue === undefined) {
      fieldValue = instance._get_default_value(fieldName);
      if (fieldValue === undefined) {
        return parser.unset_not_allowed('update', schema, fieldName, callback);
      } else if (!schema.fields[fieldName].rule || !schema.fields[fieldName].rule.ignore_default) {
        // did set a default value, ignore default is not set
        if (instance.validate(fieldName, fieldValue) !== true) {
          parser.callback_or_throw(buildError('model.update.invaliddefaultvalue', fieldValue, fieldName, fieldType), callback);
          return true;
        }
      }
    }

    if (fieldValue === null || fieldValue === cql.types.unset) {
      if (parser.unset_not_allowed('update', schema, fieldName, callback)) {
        return true;
      }
    }

    try {
      parser.build_inplace_update_expression(schema, fieldName, fieldValue, updateClauses, queryParams);
    } catch (e) {
      parser.callback_or_throw(e, callback);
      return true;
    }
    return false;
  });

  return { updateClauses, queryParams, errorHappened };
};

parser.build_save_value_expression = function fn(instance, schema, callback) {
  const identifiers = [];
  const values = [];
  const queryParams = [];

  if (schema.options && schema.options.timestamps) {
    if (instance[schema.options.timestamps.updatedAt]) {
      instance[schema.options.timestamps.updatedAt] = { $db_function: 'toTimestamp(now())' };
    }
  }

  if (schema.options && schema.options.versions) {
    if (instance[schema.options.versions.key]) {
      instance[schema.options.versions.key] = { $db_function: 'now()' };
    }
  }

  const errorHappened = Object.keys(schema.fields).some((fieldName) => {
    if (schema.fields[fieldName].virtual) return false;

    // check field value
    const fieldType = schemer.get_field_type(schema, fieldName);
    let fieldValue = instance[fieldName];

    if (fieldValue === undefined) {
      fieldValue = instance._get_default_value(fieldName);
      if (fieldValue === undefined) {
        return parser.unset_not_allowed('save', schema, fieldName, callback);
      } else if (!schema.fields[fieldName].rule || !schema.fields[fieldName].rule.ignore_default) {
        // did set a default value, ignore default is not set
        if (instance.validate(fieldName, fieldValue) !== true) {
          parser.callback_or_throw(buildError('model.save.invaliddefaultvalue', fieldValue, fieldName, fieldType), callback);
          return true;
        }
      }
    }

    if (fieldValue === null || fieldValue === cql.types.unset) {
      if (parser.unset_not_allowed('save', schema, fieldName, callback)) {
        return true;
      }
    }

    identifiers.push(util.format('"%s"', fieldName));

    try {
      const dbVal = parser.build_db_value_expression(schema, fieldName, fieldValue);
      if (_.isPlainObject(dbVal) && dbVal.query_segment) {
        values.push(dbVal.query_segment);
        queryParams.push(dbVal.parameter);
      } else {
        values.push(dbVal);
      }
    } catch (e) {
      parser.callback_or_throw(e, callback);
      return true;
    }
    return false;
  });

  return {
    identifiers,
    values,
    queryParams,
    errorHappened,
  };
};

parser.extract_query_relations = function f(fieldName, relationKey, relationValue, schema, validOperators) {
  const queryRelations = [];
  const queryParams = [];

  if (!_.has(validOperators, relationKey.toLowerCase())) {
    throw (buildError('model.find.invalidop', relationKey));
  }

  relationKey = relationKey.toLowerCase();
  if (relationKey === '$in' && !_.isArray(relationValue)) {
    throw (buildError('model.find.invalidinop'));
  }
  if (relationKey === '$token' && !(relationValue instanceof Object)) {
    throw (buildError('model.find.invalidtoken'));
  }

  let operator = validOperators[relationKey];
  let whereTemplate = '"%s" %s %s';

  const buildQueryRelations = (fieldNameLocal, relationValueLocal) => {
    const dbVal = parser.build_db_value_expression(schema, fieldNameLocal, relationValueLocal);
    if (_.isPlainObject(dbVal) && dbVal.query_segment) {
      queryRelations.push(util.format(
        whereTemplate,
        fieldNameLocal, operator, dbVal.query_segment,
      ));
      queryParams.push(dbVal.parameter);
    } else {
      queryRelations.push(util.format(
        whereTemplate,
        fieldNameLocal, operator, dbVal,
      ));
    }
  };

  const buildTokenQueryRelations = (tokenRelationKey, tokenRelationValue) => {
    tokenRelationKey = tokenRelationKey.toLowerCase();
    if (_.has(validOperators, tokenRelationKey) && tokenRelationKey !== '$token' && tokenRelationKey !== '$in') {
      operator = validOperators[tokenRelationKey];
    } else {
      throw (buildError('model.find.invalidtokenop', tokenRelationKey));
    }

    if (_.isArray(tokenRelationValue)) {
      const tokenKeys = fieldName.split(',');
      for (let tokenIndex = 0; tokenIndex < tokenRelationValue.length; tokenIndex++) {
        tokenKeys[tokenIndex] = tokenKeys[tokenIndex].trim();
        const dbVal = parser.build_db_value_expression(schema, tokenKeys[tokenIndex], tokenRelationValue[tokenIndex]);
        if (_.isPlainObject(dbVal) && dbVal.query_segment) {
          tokenRelationValue[tokenIndex] = dbVal.query_segment;
          queryParams.push(dbVal.parameter);
        } else {
          tokenRelationValue[tokenIndex] = dbVal;
        }
      }
      queryRelations.push(util.format(
        whereTemplate,
        tokenKeys.join('","'), operator, tokenRelationValue.toString(),
      ));
    } else {
      buildQueryRelations(fieldName, tokenRelationValue);
    }
  };

  if (relationKey === '$token') {
    whereTemplate = 'token("%s") %s token(%s)';

    const tokenRelationKeys = Object.keys(relationValue);
    for (let tokenRK = 0; tokenRK < tokenRelationKeys.length; tokenRK++) {
      const tokenRelationKey = tokenRelationKeys[tokenRK];
      const tokenRelationValue = relationValue[tokenRelationKey];
      buildTokenQueryRelations(tokenRelationKey, tokenRelationValue);
    }
  } else if (relationKey === '$contains') {
    const fieldType1 = schemer.get_field_type(schema, fieldName);
    if (['map', 'list', 'set', 'frozen'].includes(fieldType1)) {
      if (fieldType1 === 'map' && _.isPlainObject(relationValue) && Object.keys(relationValue).length === 1) {
        queryRelations.push(util.format(
          '"%s"[%s] %s %s',
          fieldName, '?', '=', '?',
        ));
        queryParams.push(Object.keys(relationValue)[0]);
        queryParams.push(relationValue[Object.keys(relationValue)[0]]);
      } else {
        queryRelations.push(util.format(
          whereTemplate,
          fieldName, operator, '?',
        ));
        queryParams.push(relationValue);
      }
    } else {
      throw (buildError('model.find.invalidcontainsop'));
    }
  } else if (relationKey === '$contains_key') {
    const fieldType2 = schemer.get_field_type(schema, fieldName);
    if (fieldType2 !== 'map') {
      throw (buildError('model.find.invalidcontainskeyop'));
    }
    queryRelations.push(util.format(
      whereTemplate,
      fieldName, operator, '?',
    ));
    queryParams.push(relationValue);
  } else {
    buildQueryRelations(fieldName, relationValue);
  }
  return { queryRelations, queryParams };
};

module.exports = parser;
