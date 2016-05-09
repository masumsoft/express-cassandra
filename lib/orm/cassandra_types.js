var check = require('check-types'),
    util = require('util'),
    cql = require('cassandra-driver');


var validators = {};

validators.is_array = function (obj){
    return check.array(obj);
};

validators.is_object = function (obj){
    return check.object(obj);
};

validators.is_long = function (obj){
    return (obj instanceof cql.types.Long);
};

validators.is_decimal = function (obj){
    return (obj instanceof cql.types.BigDecimal);
};

validators.is_integer = function (obj){
    return check.intNumber(obj);
};

validators.is_var_int = function (obj){
    return (obj instanceof cql.types.Integer);
};

validators.is_boolean = function (obj){
    return obj === true || obj === false;
};

validators.is_number = function (obj){
    return check.number(obj);
};

validators.is_string = function (obj){
    return check.string(obj);
};

validators.is_local_date = function (obj){
    return (obj instanceof cql.types.LocalDate);
};

validators.is_local_time = function (obj){
    return (obj instanceof cql.types.LocalTime);
};

validators.is_date = function (obj){
    return check.date(new Date(obj));
};

validators.is_anything = function (obj){
    return true;
};

validators.is_buffer = function (obj){
    return (obj instanceof Buffer);
};

validators.is_timeuuid = function (obj){
    return (obj instanceof cql.types.TimeUuid);
};

validators.is_uuid = function (obj){
    return (obj instanceof cql.types.Uuid);
};

validators.is_inet = function (obj){
    return (obj instanceof cql.types.InetAddress);
};

var TYPE_MAP = {};

TYPE_MAP = {
    "ascii"     : {validator : validators.is_string},
    "bigint"    : {validator : validators.is_long},
    "blob"      : {validator : validators.is_buffer},
    "boolean"   : {validator : validators.is_boolean},
    "counter"   : {validator : validators.is_long},
    "date"      : {validator : validators.is_local_date},
    "decimal"   : {validator : validators.is_decimal},
    "double"    : {validator : validators.is_number},
    "float"     : {validator : validators.is_number},
    "inet"      : {validator : validators.is_inet},
    "int"       : {validator : validators.is_integer},
    "list"      : {validator : validators.is_array},
    "map"       : {validator : validators.is_object},
    "set"       : {validator : validators.is_array},
    "smallint"  : {validator : validators.is_integer},
    "text"      : {validator : validators.is_string},
    "time"      : {validator : validators.is_local_time},
    "timestamp" : {validator : validators.is_date},
    "timeuuid"  : {validator : validators.is_timeuuid},
    "tinyint"   : {validator : validators.is_integer},
    "uuid"      : {validator : validators.is_uuid},
    "varchar"   : {validator : validators.is_string},
    "varint"    : {validator : validators.is_var_int}
};


TYPE_MAP.generic_type_validator = function(fieldtype){
    if(!this[fieldtype]) return null;

    return {
        validator   : this[fieldtype].validator,
        message     : function( value, prop_name, fieldtype){
           return util.format('Invalid Value: "%s" for Field: %s (Type: %s)',value,prop_name,fieldtype);
        },
        "type": "type_validator"
    };
};

TYPE_MAP.extract_type = function(val){
    //decompose composite types
    var decomposed = val ? val.split(/[<,> ]/) : [''];

    for (var d in decomposed) {
        for(var t in this){
            if (t == decomposed[d])
                return t;
        }
    }

    return val;
};

TYPE_MAP.extract_typeMap = function(val){
    //decompose composite types
    var decomposed = val ? val.split(/[<,> ]/) : [''];

    var typeMaps = [];

    for (var d in decomposed) {
        if(d == 0) continue;
        for(var t in this){
            if (t == decomposed[d]) {
                typeMaps.push(t);
                break;
            }
        }
    }

    return typeMaps;
};

module.exports = TYPE_MAP;
