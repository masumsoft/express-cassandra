const util = require('util');

const AERROR_TYPES = {
  unspecified: {
    msg: 'Unspecified error ->',
  },
  'model.tablecreation.invalidname': {
    msg: 'Table names only allow alphanumeric and _ and must start with a letter, got %s',
  },
  'model.tablecreation.dbschemaquery': {
    msg: 'Error while retrieveing Schema of DB Table "%s"',
  },
  'model.tablecreation.schemamismatch': {
    msg: 'Given Schema does not match existing DB Table "%s"',
  },
  'model.tablecreation.dbdrop': {
    msg: 'Error during drop of DB Table -> %s',
  },
  'model.tablecreation.dbcreate': {
    msg: 'Error during creation of DB Table -> %s',
  },
  'model.tablecreation.dbalter': {
    msg: 'Error during altering of DB Table -> %s',
  },
  'model.tablecreation.dbindex': {
    msg: 'Error during creation of index on DB Table -> %s',
  },
  'model.tablecreation.matview': {
    msg: 'Error during creation of materialized view on DB Table -> %s',
  },
  'model.value.invalidvalue': {
    msg: 'Invalid Value: "%s" for Field: %s (Type: %s)',
  },
  'model.find.invalidrelob': {
    msg: 'Invalid field relation object: key -> "%s" with value -> "%s"',
  },
  'model.find.multiop': {
    msg: 'Invalid field relation: only one operator allowed',
  },
  'model.find.invalidop': {
    msg: 'Invalid field relation: unknown operator: "%s"',
  },
  'model.find.invalidexpr': {
    msg: 'Index expression must be an object containing the index name and query.',
  },
  'model.find.multiorder': {
    msg: 'Invalid order by: only one clause per object',
  },
  'model.find.invalidordertype': {
    msg: 'Invalid order. Allowed :$asc, $desc. Got "%s"',
  },
  'model.find.invalidorder': {
    msg: 'Invalid order. Must be an object',
  },
  'model.find.limittype': {
    msg: 'Invalid limit value',
  },
  'model.find.invalidinop': {
    msg: 'Invalid IN query operator. Must be an array',
  },
  'model.find.invalidtoken': {
    msg: 'Invalid token. Must be an object with operator values',
  },
  'model.find.dberror': {
    msg: 'Error during find query on DB -> %s',
  },
  'model.save.unsetkey': {
    msg: 'Key Field: %s must have a value',
  },
  'model.save.unsetrequired': {
    msg: 'Required Field: %s must have a value',
  },
  'model.save.invalidvalue': {
    msg: 'Invalid Value: "%s" for Field: %s (Type: %s)',
  },
  'model.save.invaliddefaultvalue': {
    msg: 'Invalid Default value: "%s" for Field: %s (Type: %s)',
  },
  'model.save.dberror': {
    msg: 'Error during save query on DB -> %s',
  },
  'model.save.before.error': {
    msg: 'Error in before_save lifecycle function -> %s',
  },
  'model.save.after.error': {
    msg: 'Error in after_save lifecycle function -> %s',
  },
  'model.update.unsetkey': {
    msg: 'Key Field: %s must have a value',
  },
  'model.update.unsetrequired': {
    msg: 'Required Field: %s must have a value',
  },
  'model.update.invalidvalue': {
    msg: 'Invalid Value: "%s" for Field: %s',
  },
  'model.update.invaliddefaultvalue': {
    msg: 'Invalid Default value: "%s" for Field: %s (Type: %s)',
  },
  'model.update.dberror': {
    msg: 'Error during update query on DB -> %s',
  },
  'model.update.before.error': {
    msg: 'Error in before_update lifecycle function -> %s',
  },
  'model.update.after.error': {
    msg: 'Error in after_update lifecycle function -> %s',
  },
  'model.delete.invalidvalue': {
    msg: 'Invalid Value: "%s" for Field: %s (Type: %s)',
  },
  'model.delete.dberror': {
    msg: 'Error during delete query on DB -> %s',
  },
  'model.delete.before.error': {
    msg: 'Error in before_delete lifecycle function -> %s',
  },
  'model.delete.after.error': {
    msg: 'Error in after_delete lifecycle function -> %s',
  },
};

const ERR_NAME_PREFIX = 'apollo';

const buildError = function f(...args) {
  const argsarray = args;
  const name = argsarray.length ? argsarray.shift() : '_none_given_';

  const errorTemplate = AERROR_TYPES[name] || AERROR_TYPES.unspecified;
  const errorMsg = argsarray.length ?
    util.format.apply(this, [errorTemplate.msg].concat(argsarray)) :
    errorTemplate.msg;

  const error = new Error(errorMsg);
  error.name = (ERR_NAME_PREFIX ? util.format('%s.', ERR_NAME_PREFIX) : '') + name;

  return error;
};

module.exports = buildError;
