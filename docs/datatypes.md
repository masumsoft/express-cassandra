# Datatypes and Utility Functions

## A few Handy Enums and Functions

Express cassandra exposes some node driver methods for convenience. To generate uuids e.g. in field defaults:

*   `models.uuid()`
    returns a version 4 (random) uuid as javascript type models.datatypes.Uuid, suitable for Cassandra `uuid` fields.
*   `models.uuidFromString(str)`
    returns a version 4 uuid as javascript type models.datatypes.Uuid from input string, suitable for Cassandra `uuid` fields.
*   `models.uuidFromBuffer(buf)`
    returns a version 4 uuid as javascript type models.datatypes.Uuid from input buffer, suitable for Cassandra `uuid` fields. Parameter buf must be a 16-byte buffer.
*   `models.timeuuid() / models.timeuuidFromString(str) / models.timeuuidFromBuffer(buf)`
    returns a version 1 (time-based) uuid as javascript type models.datatypes.TimeUuid, suitable for Cassandra `timeuuid` fields. Parameter str must be a valid timeuuid string. Parameter buf must be a 16-byte buffer.
*   `models.timeuuidFromDate(date) / models.maxTimeuuid(date) / models.minTimeuuid(date)`
    returns a version 1 (time-based) uuid as javascript type models.datatypes.TimeUuid, suitable for Cassandra `timeuuid` fields. Parameter `date` must be a javascript Date object. From the [Datastax documentation](https://docs.datastax.com/en/cql/3.3/cql/cql_reference/timeuuid_functions_r.html):

    > The min/maxTimeuuid example selects all rows where the timeuuid column, t, is strictly later than 2013-01-01 00:05+0000 but strictly earlier than 2013-02-02 10:00+0000. The t >= maxTimeuuid('2013-01-01 00:05+0000') does not select a timeuuid generated exactly at 2013-01-01 00:05+0000 and is essentially equivalent to t > maxTimeuuid('2013-01-01 00:05+0000').

    > The values returned by minTimeuuid and maxTimeuuid functions are not true UUIDs in that the values do not conform to the Time-Based UUID generation process specified by the RFC 4122. The results of these functions are deterministic, unlike the now function.

*   `models.consistencies`
    this object contains all the available consistency enums defined by node cassandra driver, so you can for example use models.consistencies.one, models.consistencies.quorum etc.
*   `models.datatypes`
    this object contains all the available datatypes defined by node cassandra driver, so you can for example use
    models.datatypes.Long to deal with the cassandra bigint or counter field types.
*   `models.driver`
    this object contains the dse-driver/cassandra-driver instance, so this can be used to access any node cassandra driver method or objects. For example, models.driver.policies contains the connection policies etc.


## Cassandra to Javascript Datatypes

When saving or retrieving the value of a column, the value is typed according to the following table.

| Cassandra Field Types  |  Javascript Types                 |
|------------------------|-----------------------------------|
|     ascii              |     String                        |
|     bigint             |     [models.datatypes.Long](https://google.github.io/closure-library/api/goog.math.Long.html)|
|     blob               |     [Buffer](https://nodejs.org/api/buffer.html)|
|     boolean            |     Boolean                       |
|     counter            |     [models.datatypes.Long](https://google.github.io/closure-library/api/goog.math.Long.html)|
|     date               |     [models.datatypes.LocalDate](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/module.types/class.LocalDate/)|
|     decimal            |     [models.datatypes.BigDecimal](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/module.types/class.BigDecimal/)|
|     double             |     Number                        |
|     float              |     Number                        |
|     inet               |     [models.datatypes.InetAddress](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/module.types/class.InetAddress/)|
|     int                |     Number (Integer)              |
|     list               |     Array                         |
|     map                |     Object                        |
|     set                |     Array                         |
|     smallint           |     Number (Integer)|
|     text               |     String                        |
|     time               |     [models.datatypes.LocalTime](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/module.types/class.LocalTime/)|
|     timestamp          |     Date                          |
|     timeuuid           |     [models.datatypes.TimeUuid](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/module.types/class.TimeUuid/)|
|     tinyint            |     Number (Integer)|
|     tuple              |     [models.datatypes.Tuple](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/module.types/class.Tuple/)|
|     uuid               |     [models.datatypes.Uuid](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/module.types/class.Uuid/)|
|     varchar            |     String                        |
|     varint             |     [models.datatypes.Integer](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/module.types/class.Integer/)|


For example, you have a User model schema like the following:

```js
module.exports = {
    "fields": {
        "user_id": "bigint",
        "user_name": "text"
    },
    "key" : ["user_id"]
}
```

Now to insert data in the model, you need the Long data type. To create a Long type data, you can use the `models.datatypes.Long` like the following:

```js
var user = new models.instance.User({
    user_id: models.datatypes.Long.fromString('1234556567676782'),
    user_name: 'john'
});
user.save(function(err){
    //Now let's find the saved user
    models.instance.User.findOne({user_id: models.datatypes.Long.fromString('1234556567676782')}, function(err, john){
        console.log(john.user_id.toString()); // john.user_id is of type Long.
    });
});
```

### Null and unset values

To complete a distributed DELETE operation, Cassandra replaces it with a special value called a tombstone which can be propagated to replicas. When inserting or updating a field, you can set a certain field to null as a way to clear the value of a field, and it is considered a DELETE operation on that particular column.

```js
models.instance.User.update({user_id: models.datatypes.Long.fromString('1234556567676782')}, {
    user_name: null
}, function(err){
    // user_name value is now cleared
})
```

In some cases, you might want to just insert rows using null for values that are not specified, and even though our intention is to leave the value empty, Cassandra represents it as a tombstone causing unnecessary overhead. To avoid such tombstones for save operations, cassandra has the concept of unset for a parameter value. So you can do the following to unset a field value while saving for example:

```js
var user = new models.instance.User({
    user_id: models.datatypes.Long.fromString('1234556567676782'),
    user_name: models.datatypes.unset
});
user.save(function(err){
    // user_name value is not set and does not create any unnecessary tombstone overhead
});
```
