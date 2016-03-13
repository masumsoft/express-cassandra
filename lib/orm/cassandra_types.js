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
    "ascii"     : {validator : validators.is_string},
    "bigint"    : {validator : validators.is_long},
    "blob"      : {validator : validators.is_anything},
    "boolean"   : {validator : validators.is_boolean},
    "counter"   : {validator : validators.is_long},
    "decimal"   : {validator : validators.is_number},
    "double"    : {validator : validators.is_number},
    "float"     : {validator : validators.is_number},
    "inet"      : {validator : validators.is_inet},
    "int"       : {validator : validators.is_integer},
    "text"      : {validator : validators.is_string},
    "timestamp" : {validator : validators.is_datetime},
    "timeuuid"  : {validator : validators.is_uuid},
    "uuid"      : {validator : validators.is_uuid},
    "varchar"   : {validator : validators.is_string},
    "varint"    : {validator : validators.is_integer},
    "map"       : {validator : validators.is_object},
    "list"      : {validator : validators.is_array},
    "set"       : {validator : validators.is_array}
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

    if(typeMaps.length ==0 && val.indexOf('list')> -1){
        var tm = decomposed[1] + '<' + decomposed[2] +'>';
        typeMaps.push(tm);
    }


    return typeMaps;
};

module.exports = TYPE_MAP;
