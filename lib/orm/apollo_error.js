var util = require('util');

var AERROR_TYPES = {
    'unspecified': {
        msg: 'Unspecified error ->'
    },
    'model.tablecreation.invalidname': {
        msg: 'Table names only allow alphanumeric and _ and must start with a letter, got %s'
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
    'model.tablecreation.matview': {
        msg: 'Error during creation of materialized view on DB Table -> %s'
    },
    'model.value.invalidvalue' : {
        msg : 'Invalid Value: "%s" for Field: %s (Type: %s)'
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
    'model.find.invalidinop': {
        msg: 'Invalid IN query operator. Must be an array'
    },
    'model.find.invalidtoken': {
        msg: 'Invalid token. Must be an object with operator values'
    },
    'model.find.dberror': {
        msg: 'Error during find query on DB -> %s'
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
    'model.save.dberror': {
            msg: 'Error during save query on DB -> %s'
    },
    'model.update.invalidvalue' : {
        msg : 'Invalid Value: "%s" for Field: %s'
    },
    'model.update.dberror': {
            msg: 'Error during update query on DB -> %s'
    },
    'model.delete.invalidvalue' : {
        msg : 'Invalid Value: "%s" for Field: %s (Type: %s)'
    },
    'model.delete.dberror': {
        msg: 'Error during delete query on DB -> %s'
    }
};

var ERR_NAME_PREFIX = 'apollo';

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

module.exports = build_error;
