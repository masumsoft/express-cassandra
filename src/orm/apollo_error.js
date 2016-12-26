const util = require('util');

const AERROR_TYPES = {
  unspecified: {
    msg: 'Unspecified error ->',
  },
  'model.validator.invalidconfig': {
    msg: '%s',
  },
  'model.validator.invalidudt': {
    msg: '%s',
  },
  'model.validator.invalidudf': {
    msg: '%s',
  },
  'model.validator.invaliduda': {
    msg: '%s',
  },
  'model.validator.invalidschema': {
    msg: '%s',
  },
  'model.validator.invalidrule': {
    msg: '%s',
  },
  'model.validator.invalidvalue': {
    msg: '%s',
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
  'model.tablecreation.dbcreate': {
    msg: 'Error while creating DB Table -> %s',
  },
  'model.tablecreation.dbalter': {
    msg: 'Error while altering DB Table -> %s',
  },
  'model.tablecreation.dbdrop': {
    msg: 'Error while dropping DB Table -> %s',
  },
  'model.tablecreation.dbindexcreate': {
    msg: 'Error while creating index on DB Table -> %s',
  },
  'model.tablecreation.dbindexdrop': {
    msg: 'Error while dropping index on DB Table -> %s',
  },
  'model.tablecreation.matviewcreate': {
    msg: 'Error while creating materialized view on DB Table -> %s',
  },
  'model.tablecreation.matviewdrop': {
    msg: 'Error while dropping materialized view on DB Table -> %s',
  },
  'model.find.invalidop': {
    msg: 'Invalid field relation: unknown operator: "%s"',
  },
  'model.find.invalidexpr': {
    msg: '$expr must be an object containing the index name as string and query as string.',
  },
  'model.find.invalidsolrquery': {
    msg: '$solr_query must be a string containing the query for solr.',
  },
  'model.find.invalidorder': {
    msg: 'Invalid $orderby query, $orderby must be an object',
  },
  'model.find.multiorder': {
    msg: 'Invalid $orderby query: only one clause per object is allowed',
  },
  'model.find.invalidordertype': {
    msg: 'Invalid $orderby query, allowed order: $asc / $desc, given "%s"',
  },
  'model.find.limittype': {
    msg: '$limit must be an integer, given value "%s"',
  },
  'model.find.invalidinop': {
    msg: 'Invalid $in query. $in must be an array',
  },
  'model.find.invalidcontainsop': {
    msg: 'Invalid $contains query, $contains operator is only valid for indexed collections',
  },
  'model.find.invalidcontainskeyop': {
    msg: 'Invalid $contains_key query, $contains_key operator is only valid for indexed map collections',
  },
  'model.find.invalidtoken': {
    msg: 'Invalid $token query. $token must be an object with operator values',
  },
  'model.find.invalidtokenop': {
    msg: 'Invalid operator: "%s" in $token query',
  },
  'model.find.streamerror': {
    msg: 'Invalid stream query -> %s',
  },
  'model.find.eachrowerror': {
    msg: 'Invalid eachRow query -> %s',
  },
  'model.find.cberror': {
    msg: 'No valid callback function was provided',
  },
  'model.find.dberror': {
    msg: 'Error during find query on DB -> %s',
  },
  'model.save.unsetkey': {
    msg: 'Primary Key Field: %s must have a value',
  },
  'model.save.unsetrequired': {
    msg: 'Required Field: %s must have a value',
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
    msg: 'Primary Key Field: %s must have a value',
  },
  'model.update.unsetrequired': {
    msg: 'Required Field: %s must have a value',
  },
  'model.update.invaliddefaultvalue': {
    msg: 'Invalid Default value: "%s" for Field: %s (Type: %s)',
  },
  'model.update.invalidreplaceop': {
    msg: 'Invalid $replace operation -> %s',
  },
  'model.update.invalidprependop': {
    msg: 'Invalid $prepend operation -> %s',
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
