const check = require('check-types');
const util = require('util');
const cql = require('cassandra-driver');

const validators = {};
validators.is_array = (obj) => (check.array(obj));
validators.is_object = (obj) => (check.object(obj));
validators.is_long = (obj) => ((obj instanceof cql.types.Long));
validators.is_decimal = (obj) => ((obj instanceof cql.types.BigDecimal));
validators.is_integer = (obj) => (check.intNumber(obj));
validators.is_var_int = (obj) => ((obj instanceof cql.types.Integer));
validators.is_boolean = (obj) => ((obj === true || obj === false));
validators.is_number = (obj) => (check.number(obj));
validators.is_string = (obj) => (check.string(obj));
validators.is_local_date = (obj) => ((obj instanceof cql.types.LocalDate));
validators.is_local_time = (obj) => ((obj instanceof cql.types.LocalTime));
validators.is_date = (obj) => (check.date(new Date(obj)));
validators.is_buffer = (obj) => ((obj instanceof Buffer));
validators.is_timeuuid = (obj) => ((obj instanceof cql.types.TimeUuid));
validators.is_uuid = (obj) => ((obj instanceof cql.types.Uuid));
validators.is_inet = (obj) => ((obj instanceof cql.types.InetAddress));
validators.is_frozen = (obj) => ((validators.is_array(obj) || validators.is_object(obj)));

const TYPE_MAP = {
  ascii: { validator: validators.is_string },
  bigint: { validator: validators.is_long },
  blob: { validator: validators.is_buffer },
  boolean: { validator: validators.is_boolean },
  counter: { validator: validators.is_long },
  date: { validator: validators.is_local_date },
  decimal: { validator: validators.is_decimal },
  double: { validator: validators.is_number },
  float: { validator: validators.is_number },
  inet: { validator: validators.is_inet },
  int: { validator: validators.is_integer },
  list: { validator: validators.is_array },
  map: { validator: validators.is_object },
  set: { validator: validators.is_array },
  smallint: { validator: validators.is_integer },
  text: { validator: validators.is_string },
  time: { validator: validators.is_local_time },
  timestamp: { validator: validators.is_date },
  timeuuid: { validator: validators.is_timeuuid },
  tinyint: { validator: validators.is_integer },
  uuid: { validator: validators.is_uuid },
  varchar: { validator: validators.is_string },
  varint: { validator: validators.is_var_int },
  frozen: { validator: validators.is_frozen },
};


TYPE_MAP.generic_type_validator = function f(fieldtype) {
  if (!this[fieldtype]) return null;

  return {
    validator: this[fieldtype].validator,
    message(value, propName, fieldType) {
      return util.format('Invalid Value: "%s" for Field: %s (Type: %s)', value, propName, fieldType);
    },
    type: 'type_validator',
  };
};

TYPE_MAP.extract_type = function f(val) {
  // decompose composite types
  const decomposed = val ? val.replace(/[\s]/g, '').split(/[<,>]/g) : [''];

  for (let d = 0; d < decomposed.length; d++) {
    if (Object.keys(this).indexOf(decomposed[d]) > -1) {
      return decomposed[d];
    }
  }

  return val;
};

TYPE_MAP.extract_typeDef = function f(val) {
  // decompose composite types
  let decomposed = val ? val.replace(/[\s]/g, '') : '';
  decomposed = decomposed.substr(decomposed.indexOf('<'), decomposed.length - decomposed.indexOf('<'));

  return decomposed;
};

module.exports = TYPE_MAP;
