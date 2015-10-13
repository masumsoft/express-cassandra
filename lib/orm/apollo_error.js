var util = require('util');

/**
 * Errors for Apollo.
 * All errors generated from Apollo which are not directly fired by Cassandra should belong to this list.<br />
 * Errors have a property `name` which is always {@link ERR_NAME_PREFIX}.{@link AERROR_TYPES}, for example `apollo.model.save.unsetkey`<br />
 * You can rely on this property to check the error in callback and in try/catch.
 * @enum {string} Error code string
 */
var AERROR_TYPES = {
    'unspecified': {
        msg: 'Unspecified Apollo error ->'
    },
    'model.tablecreation.invalidname': {
        msg: 'Table names only allow alphanumeric and _ and must star witch a letter, got %s'
    },
    'model.tablecreation.dbschemaquery': {
        msg: 'Error while retrieveing Schema of DB Table "%s"'
    },
    'model.tablecreation.schemamismatch': {
        msg: 'Given Schema does not match existing DB Table "%s"'
    },
    'model.tablecreation.dbdrop': {
        msg: 'Error during drop of DB Table -> %s'
    },
    'model.tablecreation.dbcreate': {
        msg: 'Error during creation of DB Table -> %s'
    },
    'model.tablecreation.dbindex': {
        msg: 'Error during creation of index on DB Table -> %s'
    },
    'model.find.invalidrelob': {
        msg: 'Invalid field relation object: key -> "%s" with value -> "%s"'
    },
    'model.find.multiop': {
        msg: 'Invalid field relation: only one operator allowed'
    },
    'model.find.invalidop': {
        msg: 'Invalid field relation: unknown operator: "%s"'
    },
    'model.find.multiorder': {
        msg: 'Invalid order by: only one clause per object'
    },
    'model.find.invalidordertype': {
        msg: 'Invalid order. Allowed :$asc, $desc. Got "%s"'
    },
    'model.find.invalidorder': {
        msg: 'Invalid order. Must be an object'
    },
    'model.find.limittype': {
        msg: 'Invalid limit value'
    },
    'model.find.dberror': {
        msg: 'Error during find query on DB -> %s'
    },
    'model.save.dberror': {
            msg: 'Error during save query on DB -> %s'
    },
    'model.update.dberror': {
            msg: 'Error during update query on DB -> %s'
    },
    'model.delete.dberror': {
        msg: 'Error during delete query on DB -> %s'
    },
    'model.save.unsetkey': {
        msg: 'Key Field: %s must be set'
    },
    'model.save.invalidvalue' : {
        msg : 'Invalid Value: "%s" for Field: %s (Type: %s)'
    },
    'model.save.invaliddefaultvalue' : {
        msg : 'Invalid Default value: "%s" for Field: %s (Type: %s)'
    },
    'model.update.invalidvalue' : {
        msg : 'Invalid Value: "%s" for Field: %s'
    },
    'model.value.invalidvalue' : {
        msg : 'Invalid Value: "%s" for Field: %s (Type: %s)'
    },
    'model.delete.invalidvalue' : {
        msg : 'Invalid Value: "%s" for Field: %s (Type: %s)'
    }
};

/**
 * Prefix for errors
 * @readonly
 * @constant
 * @default
 * @type {String}
 */
var ERR_NAME_PREFIX = 'apollo';

/**
 * Builds a standardized Error object
 *
 * @param {string} [error_type='unspecified'] - Error type according to {@link AERROR_TYPES}
 * @param {...string} [params] - Parameters to fill in the error message template
 * @return {Apollo~Error} The built error object
 */
var build_error = function(error_type, params){
    var argsarray = Array.prototype.slice.call(arguments);
    var name = argsarray.length ? argsarray.shift() : '_none_given_';

    var error_template = AERROR_TYPES[name] || AERROR_TYPES.unspecified,
        error_msg;

    error_msg = argsarray.length ?
        util.format.apply(this,[error_template.msg].concat(argsarray)) :
        error_template.msg;

    var error = new Error(error_msg);
    error.name = ( ERR_NAME_PREFIX ?  ERR_NAME_PREFIX + '.' : '' ) + name;

    return error;
};

 /**
  * Apollo standard Error object
  *
  * @typedef {Object} Apollo~Error
  * @property {String} type - error type, as enumerated in {@link AERROR_TYPES}
  * @property {String} msg  - error message (with replaced parameters if any)
  */

module.exports = build_error;
