var check = require('check-types'),
    util = require('util');


var validators = {};

validators.is_array = function (obj){
    return check.array(obj);
};

validators.is_object = function (obj){
    return check.object(obj);
};

validators.is_long = function (obj){
    return isNaN(obj) === false;
};

validators.is_integer = function (obj){
    return check.intNumber(obj);
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

validators.is_datetime = function (obj){
    return check.date(new Date(obj));
};

validators.is_anything = function (obj){
    return true;
};

validators.is_uuid = function (obj){
    var str = obj.toString();

    //var pattern_uuid4 = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
    var pattern_uuid1 = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
    return pattern_uuid1.test(str);
};

validators.is_inet = function (obj){
    if(!check.string(obj))
        return false;

    //var pattern_uuid4 = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
    var patt_ip4 = /^(25[0-5]|2[0-4]\d|[0-1]?\d?\d)(\.(25[0-5]|2[0-4]\d|[0-1]?\d?\d)){3}$/i,
        patt_ip6_1 = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/i,
        patt_ip6_2 = /^((?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?)::((?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?)$/i;
    return patt_ip4.test(obj) || patt_ip6_1.test(obj) || patt_ip6_2.test(obj) ;
};

var TYPE_MAP = {};

TYPE_MAP = {
    "ascii"     : {validator : validators.is_string,   dbvalidator : "org.apache.cassandra.db.marshal.AsciiType"},
    "bigint"    : {validator : validators.is_long,     dbvalidator : "org.apache.cassandra.db.marshal.LongType"},
    "blob"      : {validator : validators.is_anything, dbvalidator : "org.apache.cassandra.db.marshal.BytesType"},
    "boolean"   : {validator : validators.is_boolean,  dbvalidator : "org.apache.cassandra.db.marshal.BooleanType"},
    "counter"   : {validator : validators.is_long,     dbvalidator : "org.apache.cassandra.db.marshal.CounterColumnType"},
    "decimal"   : {validator : validators.is_number,   dbvalidator : "org.apache.cassandra.db.marshal.DecimalType"},
    "double"    : {validator : validators.is_number,   dbvalidator : "org.apache.cassandra.db.marshal.DoubleType"},
    "float"     : {validator : validators.is_number,   dbvalidator : "org.apache.cassandra.db.marshal.FloatType"},
    "inet"      : {validator : validators.is_inet,     dbvalidator : "org.apache.cassandra.db.marshal.InetAddressType"},
    "int"       : {validator : validators.is_integer,  dbvalidator : "org.apache.cassandra.db.marshal.Int32Type"},
    "text"      : {validator : validators.is_string,   dbvalidator : "org.apache.cassandra.db.marshal.UTF8Type"},
    "timestamp" : {validator : validators.is_datetime, dbvalidator : "org.apache.cassandra.db.marshal.TimestampType"},
    "timeuuid"  : {validator : validators.is_uuid,     dbvalidator : "org.apache.cassandra.db.marshal.TimeUUIDType"},
    "uuid"      : {validator : validators.is_uuid,     dbvalidator : "org.apache.cassandra.db.marshal.UUIDType"},
    "varchar"   : {validator : validators.is_string,   dbvalidator : "org.apache.cassandra.db.marshal.UTF8Type"},
    "varint"    : {validator : validators.is_integer,  dbvalidator : "org.apache.cassandra.db.marshal.IntegerType"},
    "map"       : {validator : validators.is_object,   dbvalidator : "org.apache.cassandra.db.marshal.MapType"},
    "list"      : {validator : validators.is_array,    dbvalidator : "org.apache.cassandra.db.marshal.ListType"},
    "set"       : {validator : validators.is_array,    dbvalidator : "org.apache.cassandra.db.marshal.SetType"}
};


TYPE_MAP.generic_type_validator = function(validator){
    return {
        validator   : validator,
        message     : function( value, prop_name, fieldtype){
           return util.format('Invalid Value: "%s" for Field: %s (Type: %s)',value,prop_name,fieldtype);
        },
        "type": "type_validator"
    };
};

TYPE_MAP.find_type_by_dbvalidator = function(val){
    //decompose composite types
    var decomposed = val ? val.split(/[(,)]/) : [''];

    for(var t in this){
        if (this[t].dbvalidator == decomposed[0])
            return t;
    }
    return null;
};

module.exports = TYPE_MAP;
