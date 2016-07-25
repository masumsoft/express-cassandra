[![Build Status](https://travis-ci.org/masumsoft/express-cassandra.svg)](https://travis-ci.org/masumsoft/express-cassandra)
[![Download Stats](https://img.shields.io/npm/dm/express-cassandra.svg)](https://www.npmjs.com/package/express-cassandra)
[![Npm Version](https://badge.fury.io/js/express-cassandra.svg)](https://www.npmjs.com/package/express-cassandra)

express-cassandra
===================

No more hassling with raw cql queries from your nodejs web frameworks. express-cassandra automatically loads your models and provides you with object oriented mapping to your cassandra tables like a standard ORM.

This module uses datastax [cassandra-driver](https://github.com/datastax/nodejs-driver) for node and many of the orm features are wrapper over a largely modified version of [apollo-cassandra](https://github.com/3logic/apollo-cassandra) module. The modifications made to the orm library was necessary to support missing features in the orm, keep it updated with the latest cassandra releases and to make it compatible with requirements of this module.


## Installation

For cassandra version 3.x

    npm install express-cassandra

For older cassandra 2.x

    npm install express-cassandra@0.5.4

Please note that if you use the legacy cassandra 2.x compliant version then please use the corresponding README.md file for that version. The following documentation is for version 3.x only. The materialized view support and several other part of the documentation is strictly applicable for cassandra 3.x and will not work in earlier versions of cassandra.

## Usage

```js
var models = require('express-cassandra');

//Tell express-cassandra to use the models-directory, and
//use bind() to load the models using cassandra configurations.

//If your keyspace doesn't exist it will be created automatically
//using the default replication strategy provided here.

//If dropTableOnSchemaChange=true, then if your model schema changes,
//the corresponding cassandra table will be dropped and recreated with
//the new schema. Setting this to false will send an error message
//in callback instead for any model attribute changes.
//
//If createKeyspace=false, then it won't be checked whether the
//specified keyspace exists and, if not, it won't get created
// automatically.
models.setDirectory( __dirname + '/models').bind(
    {
        clientOptions: {
            contactPoints: ['127.0.0.1'],
            protocolOptions: { port: 9042 },
            keyspace: 'mykeyspace',
            queryOptions: {consistency: models.consistencies.one}
        },
        ormOptions: {
            defaultReplicationStrategy : {
                class: 'SimpleStrategy',
                replication_factor: 1
            },
            dropTableOnSchemaChange: false, //recommended to keep it false in production, use true for development convenience.
            createKeyspace: true
        }
    },
    function(err) {
        if(err) console.log(err.message);
        else console.log(models.timeuuid());
    }
);

```

Alternatively if you don't want to load your models automatically from a specific directory and want to define and load models yourself, then you can asynchronously load your schemas like the following:

```js
var Cassandra = require('express-cassandra');
var cassandra = Cassandra.createClient({
    clientOptions: {
        contactPoints: ['127.0.0.1'],
        protocolOptions: { port: 9042 },
        keyspace: 'mykeyspace',
        queryOptions: {consistency: Cassandra.consistencies.one}
    },
    ormOptions: {
        defaultReplicationStrategy : {
            class: 'SimpleStrategy',
            replication_factor: 1
        },
        dropTableOnSchemaChange: false,
        createKeyspace: true
    }
});


var UserSchema = cassandra.loadSchema('users', {
    fields: {
        name: 'text',
        password: 'text'
    },
    key: ['name']
});

cassandra.connect(function (err) {
    if (err) {
        console.log(err.message);
    } else {
        console.log(cassandra.modelInstance.users);
        console.log(cassandra.modelInstance.users === UserSchema);
    }
});

```

For connecting to cassandra using authentication, you can use the nodejs-driver `authProvider` option in the `clientOptions` object like the following:

```js
clientOptions: {
    contactPoints: ['127.0.0.1'],
    protocolOptions: { port: 9042 },
    keyspace: 'mykeyspace',
    queryOptions: {consistency: models.consistencies.one},
    authProvider: new models.driver.auth.PlainTextAuthProvider('my_user', 'my_password')
}
```

Infact any of the clientOptions supported by the nodejs driver can be used. Possible options are documented in the [cassandra driver docs](http://docs.datastax.com/en/developer/nodejs-driver/3.0/common/drivers/reference/clientOptions.html).

## Write a Model named `PersonModel.js` inside models directory

```js

module.exports = {
    fields:{
        name    : "text",
        surname : "text",
        age     : "int"
    },
    key:["name"]
}

```

Note that a model class name should contain the word `Model` in it,
otherwise it won't be treated as a model class.

## Let's insert some data into PersonModel

```js

var john = new models.instance.Person({name: "John", surname: "Doe", age: 32});
john.save(function(err){
    if(err) console.log(err);
    else console.log('Yuppiie!');
});

```

## Now let's find it

```js

models.instance.Person.findOne({name: 'John'}, function(err, john){
    if(err) throw err;

    //Note that returned variable john here is an instance of your model,
    //so you can also do john.delete(), john.save() type operations on the instance.
    console.log('Found ' + john.name + ' to be ' + john.age + ' years old!');
});

```

## Model Schema in detail by example

```js

module.exports = {
    fields: {
        id: {
            type: "uuid",
            default: {"$db_function": "uuid()"}
        },
        name: { type: "varchar", default: "no name provided"},
        surname: { type: "varchar", default: "no surname provided"},
        complete_name: {
            type: "varchar",
            default: function() {
                return this.name + ' ' + this.surname;
            }
        },
        age: "int",
        active: "boolean",
        created: {
            type: "timestamp",
            default: {"$db_function": "toTimestamp(now())"}
        }
    },
    key : [["id"],"created"],
    clustering_order: {"created": "desc"},
    materialized_views: {
        view_name1: {
            select: ["name","age"],
            key : ["age","created","id"],
        },
        view_name2: {
            select: ["name","age","active"],
            key : [["name", "id"],"created"],
            clustering_order: {"created": "desc"}
        }
    },
    indexes: ["name"],
    custom_indexes: [
        {
            on: 'age',
            using: 'path.to.the.IndexClass',
            options: {
                option1 : '...',
                option2: '...'
            }
        }
    ],
    table_name: "my_custom_table_name"
}

```

What does the above code means?

- `fields` are the columns of your table. For each column name the value can be a string representing the type or an object containing more specific informations. i.e.
    + ` "id"     : { "type": "uuid", "default": {"$db_function": "uuid()"} },` in this example id type is `uuid` and the default value is a cassandra function (so it will be executed from the database).
    + `"name"   : { "type": "varchar", "default": "no name provided"},` in this case name is a varchar and, if no value will be provided, it will have a default value of `no name provided`. The same goes for `surname`.
    + `complete_name` the default values is calculated from others field. When the orm processes your model instances, the `complete_name` will be the result of the function you defined. In the function `this` is bound to the current model instance. If you need to use the custom datatypes, you may use the `this._get_data_types()` function that will be similar to using [models.datatypes](#cassandra-to-javascript-datatypes) but the difference is, it can be used from within a model definition. For example to return a Long value from a default function, you could use the `this._get_data_types().Long` class.
    + `age` no default is provided and we could write it just as `age: "int"`.
    + `active` no default is provided and we could write it just as `active: "boolean"`.
    + `created`, like uuid(), will be evaluated from cassandra using the `now()` function.

- `key`: here is where you define the primary key of your table. As you can imagine, the array defines a `compound primary key` and the first value of the array is the `partition key` and the others are the `clustering keys`. The `partition key` itself can be an array with multiple fields. When a partition key is an array of multiple fields, it is called a `composite` partition key.

The partition key is the key field by which cassandra distributes it's data into multiple machines. So when querying cassandra, in most cases you need to provide the partition key, so cassandra knows which machines or partitions contains the data you are looking for.

The clustering keys are used to keep the data sorted according to the field values of those keys in a partition. So that after getting into a partition, cassandra can find the required data under those partitions very quickly. As the data is sorted according to those keys, cassandra can efficiently seek to find the data it needs.

Understanding the primary key parts is a crucial concept to cassandra data modeling. To get a detailed idea about them, read the cassandra documentation. For your convenience, following are some links to the relevant documentation pages:

Read more about composite keys on the [composite key doc](http://docs.datastax.com/en/cql/3.3/cql/cql_using/useCompositePartitionKeyConcept.html)

Read more about the compound key here on the [compound key documentation](http://docs.datastax.com/en/cql/3.3/cql/cql_using/useCompoundPrimaryKeyConcept.html)

- `clustering_order`: here you can define the clustering order of the clustering keys. If order is not defined, default value of ASC (ascending) is used.

- `materialized_views` provides you the ability to define cassandra 3.x materialized views for your model table. You may want to read more about it on the [materialized view documentation](http://docs.datastax.com/en/cql/3.3/cql/cql_using/useCreateMV.html). This is generally suited for querying high cardinality fields. If you need to use select * for the materialized view, you can also use `select: ['*']`.

- `indexes` are the index of your table. It's always an array of field names. You can read more on the [index documentation](http://docs.datastax.com/en/cql/3.3/cql/cql_using/usePrimaryIndex.html). This is generally suited for querying low cardinality fields, but not as low as boolean fields or fields with very limited number of variants. Very low cardinality fields are not a good separator of large datasets and hence not worthwhile to index.

- `custom_indexes` is an array of objects defining the custom indexes for the table. The `on` section should contain the column name on which the index should be built, the `using` section should contain the custom indexer class path and the `options` section should contain the passed options for the indexer class if any.

- `table_name` provides the ability to use a different name for the actual table in cassandra. By default the lowercased modelname is used as the table name. But if you want a different table name instead, then you may want to use this optional field to specify the custom name for your cassandra table.

When you instantiate a model, every field you defined in schema is automatically a property of your instances. So, you can write:

```js

john.age = 25;
console.log(john.name); //John
console.log(john.complete_name); // undefined.

```
__note__: `john.complete_name` is undefined in the newly created instance but will be populated when the instance is saved because it has a default value in schema definition

Ok, we are done with John, let's delete it:

```js

john.delete(function(err){
    //...
});

```

### A few handy tools for your model

Express cassandra exposes some node driver methods for convenience. To generate uuids e.g. in field defaults:

*   `models.uuid()`
    returns a type 3 (random) uuid, suitable for Cassandra `uuid` fields, as a string
*   `models.uuidFromString(str)`
    returns a type 3 uuid from input string, suitable for Cassandra `uuid` fields
*   `models.timeuuid() / .maxTimeuuid() / .minTimeuuid()`
    returns a type 1 (time-based) uuid, suitable for Cassandra `timeuuid` fields, as a string. From the [Datastax documentation](https://docs.datastax.com/en/cql/3.3/cql/cql_reference/timeuuid_functions_r.html):

    > The min/maxTimeuuid example selects all rows where the timeuuid column, t, is strictly later than 2013-01-01 00:05+0000 but strictly earlier than 2013-02-02 10:00+0000. The t >= maxTimeuuid('2013-01-01 00:05+0000') does not select a timeuuid generated exactly at 2013-01-01 00:05+0000 and is essentially equivalent to t > maxTimeuuid('2013-01-01 00:05+0000').

    > The values returned by minTimeuuid and maxTimeuuid functions are not true UUIDs in that the values do not conform to the Time-Based UUID generation process specified by the RFC 4122. The results of these functions are deterministic, unlike the now function.
*   `models.consistencies`
    this object contains all the available consistency enums defined by node cassandra driver, so you can for example use models.consistencies.one, models.consistencies.quorum etc.
*   `models.datatypes`
    this object contains all the available datatypes defined by node cassandra driver, so you can for example use
    models.datatypes.Long to deal with the cassandra bigint or counter field types.


### Cassandra to Javascript Datatypes

When saving or retrieving the value of a column, the value is typed according to the following table.

| Cassandra Field Types  |  Javascript Types                 |
|------------------------|-----------------------------------|
|     ascii              |     String                        |
|     bigint             |     [models.datatypes.Long](https://google.github.io/closure-library/api/goog.math.Long.html)|
|     blob               |     [Buffer](https://nodejs.org/api/buffer.html)|
|     boolean            |     Boolean                       |
|     counter            |     [models.datatypes.Long](https://google.github.io/closure-library/api/goog.math.Long.html)|
|     date               |     [models.datatypes.LocalDate](http://docs.datastax.com/en/drivers/nodejs/3.0/module-types-LocalDate.html)|
|     decimal            |     [models.datatypes.BigDecimal](http://docs.datastax.com/en/drivers/nodejs/3.0/module-types-BigDecimal.html)|
|     double             |     Number                        |
|     float              |     Number                        |
|     inet               |     [models.datatypes.InetAddress](http://docs.datastax.com/en/drivers/nodejs/3.0/module-types-InetAddress.html)|
|     int                |     Number (Integer)              |
|     list               |     Array                         |
|     map                |     Object                        |
|     set                |     Array                         |
|     smallint           |     Number (Integer)|
|     text               |     String                        |
|     time               |     [models.datatypes.LocalTime](http://docs.datastax.com/en/drivers/nodejs/3.0/module-types-LocalTime.html)|
|     timestamp          |     Date                          |
|     timeuuid           |     [models.datatypes.TimeUuid](http://docs.datastax.com/en/drivers/nodejs/3.0/module-types-TimeUuid.html)|
|     tinyint            |     Number (Integer)|
|     tuple              |     [models.datatypes.Tuple](http://docs.datastax.com/en/drivers/nodejs/3.0/module-types-Tuple.html)|
|     uuid               |     [models.datatypes.Uuid](http://docs.datastax.com/en/drivers/nodejs/3.0/module-types-Uuid.html)|
|     varchar            |     String                        |
|     varint             |     [models.datatypes.Integer](http://docs.datastax.com/en/drivers/nodejs/3.0/module-types-Integer.html)|


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

To complete a distributed DELETE operation, Cassandra replaces it with a special value called a tombstone which can be propagated to replicas. When inserting or updating a field, you can set a certain field to null as a way to clear the value of a field, and it is considered a DELETE operation. In some cases, you might insert rows using null for values that are not specified, and even though our intention is to leave the value empty, Cassandra represents it as a tombstone causing unnecessary overhead.

To avoid tombstones, cassandra has the concept of unset for a parameter value. So you can do the following to unset a field value for example:

```js
models.instance.User.update({user_id: models.datatypes.Long.fromString('1234556567676782')}, {
    user_name: models.datatypes.unset
}, function(err){
    //user name is now unset
})
```

### Counter Column Operations

Cassandra counter column increment and decrement operations are supported via the update operation. To increment/decrement a counter, you can use the following types of update operation:

```js
//Say your model name is StatsModel that has a user_id as the primary key and visit_count as a counter column.

models.instance.Stats.update({user_id:1234}, {visit_count:2}, function(err){
    //visit_count will be incremented by 2
});

models.instance.Stats.update({user_id:1234}, {visit_count:-1}, function(err){
    //visit_count will be decremented by 1
});
```

Please note that counter columns has special limitations, to know more about the counter column usage, see the [cassandra counter docs](https://docs.datastax.com/en/cql/3.3/cql/cql_using/useCountersConcept.html).

### Support for Collection Data Types

Cassandra collection data types (`map`, `list` & `set`) are supported in model schema definitions. An additional `typeDef` attribute is used to define the collection type.

```js

module.exports = {

    "fields": {

        mymap: {
            type: "map",
            typeDef: "<varchar, text>"
        },
        mylist: {
            type: "list",
            typeDef: "<varchar>"
        },
        myset: {
            type: "set",
            typeDef: "<varchar>"
        }

    }

}

```

When saving or updating collection types, use an object for a `map` value and use an array for `set` or `list` value like the following:

```js

var person = new models.instance.Person({

    mymap: {'key1':'val1','key2': 'val2'},
    mylist: ['value1', 'value2'],
    myset: ['value1', 'value2']

});

person.save(function(err){

});

```

If you want to add/remove/update existing map, list or set, then you can always find it using the find function,
then change the map, list or set elements in javascript and use the `save` function on that model instance to save the changes.

```js
models.instance.Person.findOne(query, function(err, person){
    person.mymap.key1 = 'val1 new';
    delete person.mymap.key2;
    person.mymap.key3 = 'val3';
    person.mylist.push('value3');
    person.myset.splice(0,1);

    person.save(function(err){

    });
});
```

But sometimes you may want to add/remove elements into an existing map, list or set in a single call atomically.
So you can use the update function along with the `$add` and `$remove` directive to do that.

```js
models.instance.Person.update({userID:1234, age:32}, {
    info:{'$add':{'new2':'addition2'}},
    phones:{'$add': ['12345']},
    emails: {'$add': ['e@f.com']}
}, function(err){
    if(err) throw err;
    done();
});
```

```js
models.instance.Person.update({userID:1234, age:32}, {
    info:{'$remove':{'new2':''}},
    phones:{'$remove': ['12345']},
    emails: {'$remove': ['e@f.com']}
}, function(err){
    if(err) throw err;
    done();
});
```

Instead of `$add`, you may also use `$append`. Both of them will have the same effect. If you want to prepend in a list instead of append, you can use the `$prepend` directive like the following:

```js
models.instance.Person.update({userID:1234, age:32}, {
    phones:{'$prepend': ['654532']}
}, function(err){

});
```

You can also replace a specific item in a map using the `$replace` directive like the following:

```js
models.instance.Person.update({userID:1234, age:32}, {
    info:{'$replace':{'new':'replaced value'}}
}, function(err){

});
```

You may also replace a list item using the index. In this case provide a 2 item array where the first item is the index to replace and the second item is the value you want to set for that index.

```js
models.instance.Person.update({userID:1234, age:32}, {
    phones:{'$replace': [1,'23456']} //replace the phone number at index 1 with the value 23456
}, function(err){

});
```

### Support for Frozen Collections

Frozen collections are useful if you want to use them in the primary key. Frozen collection can only be replaced as a whole, you cannot for example add/remove elements in a frozen collection.

```js
myfrozenmap: {
    type: "frozen",
    typeDef: "<map<varchar, text>>"
}
```

### Support for Tuple Data Type

Cassandra tuple data types can be declared using the `frozen` type like the following:

```js
mytuple: {
    type: "frozen",
    typeDef: "<tuple<int, text, float>>"
}
```

To insert/update data into a tuple, use the cassandra Tuple datatype like the following:

```js
var person = new models.instance.Person({
    //...other fields ommitted for clarity
    mytuple: new models.datatypes.Tuple(3, 'bar', 2.1)
});

```

### Support for User Defined Types, Functions and Aggregates

User defined types (UDTs), user defined functions (UDFs) and user defined aggregates (UDAs) are supported too. The UDTs, UDFs & UDAs should be defined globally against your keyspace. You can defined them in the configuration object passed to initialize express-cassandra, so that express cassandra could create and sync them against your keyspace. So you may be able to use them in your schema definition and queries. The configuration object should have some more object keys representing the user defined types, functions and aggregates under `ormOptions` like the following:

```js
clientOptions: {
    //... client options are ommitted for clarity
},
ormOptions: {
    //... other orm options are ommitted for clarity
    udts: {
        phone: {
            alias: 'text',
            phone_number: 'text',
            country_code: 'int'
        },
        address: {
            street: 'text',
            city: 'text',
            state: 'text',
            zip: 'int',
            phones: 'set<frozen<phone>>'
        }
    },
    udfs: {
        fLog: {
            language: 'java',
            code: 'return Double.valueOf(Math.log(input.doubleValue()));',
            returnType: 'double',
            inputs: {
                input: 'double'
            }
        },
        avgState: {
            language: 'java',
            code: 'if (val !=null) { state.setInt(0, state.getInt(0)+1); state.setLong(1,state.getLong(1)+val.intValue()); } return state;',
            returnType: 'tuple<int,bigint>',
            inputs: {
                state: 'tuple<int,bigint>',
                val: 'int'
            }
        },
        avgFinal: {
            language: 'java',
            code: 'double r = 0; if (state.getInt(0) == 0) return null; r = state.getLong(1); r/= state.getInt(0); return Double.valueOf(r);',
            returnType: 'double',
            inputs: {
                state: 'tuple<int,bigint>'
            }
        }
    },
    udas: {
        average: {
            input_types: ['int'],
            sfunc: 'avgState',
            stype: 'tuple<int,bigint>',
            finalfunc: 'avgFinal',
            initcond: '(0,0)'
        }
    }
}
```

After configuring them for your keyspace, you could possibly define fields using udts like the following:

```js
currencies: {
    type: 'frozen',
    typeDef: '<address>'
}
```

and use the UDFs and UDAs like any other standard functions using the `select` attribute:

```js
models.instance.Person.findOne({...}, {select: ['fLog(points)','average(age)']}, function(err, user){
    //...
});
```

### Support for shared static columns

In a table that uses clustering columns, non-clustering columns can be declared static in the schema definition like the following:

```js
"my_shared_data": {
    "type": "text",
    "static": true
}
```

Note that static columns are only static within a given partition. Static columns also has several restrictions described in the cassandra [static column documentation](https://docs.datastax.com/en/cql/3.3/cql/cql_reference/refStaticCol.html).

### Support for indexed collections

Collections can be indexed and queried to find a collection containing a particular value. Sets and lists are indexed slightly differently from maps, given the key-value nature of maps.

Sets and lists can index all values found by indexing the collection column. Maps can index a map key, map value, or map entry using the methods shown below. Multiple indexes can be created on the same map column in a table, so that map keys, values, or entries can be queried. In addition, frozen collections can be indexed using FULL to index the full content of a frozen collection.

For defining indexed collections or frozen full indexes, you can define the corresponsing fields in your schema definition indexes like the following:

```js
"fields": {...},
"key": [...],
"indexes": ["my_list","my_set","keys(my_map)","entries(my_map)","values(my_map)","full(my_frozen_field)"],
```

Now after defining your indexes in your collections, you can use the `$contains` and `$contains_key` directives to query those indexes:

```js
//Find all persons where my_list contains my_value
models.instance.Person.find({my_list: {$contains: 'my_value'}}, {raw: true}, function(err, people){

});
//Find all persons where my_set contains my_value
models.instance.Person.find({my_set: {$contains: 'my_value'}}, {raw: true}, function(err, people){

});
//Find all persons where my_map keys contains my_key
models.instance.Person.find({my_map: {$contains_key: 'my_key'}}, {raw: true}, function(err, people){

});
//Find all persons where my_map contains object {my_key: 'my_value'}
models.instance.Person.find({my_map: {$contains: {my_key: 'my_value'}}}, {raw: true}, function(err, people){

});
//Find all persons where my_map contains my_value
models.instance.Person.find({my_map: {$contains: 'my_value'}}, {raw: true}, function(err, people){

});
```

Now for finding using indexed frozen field using `full` type index, you can directly use the value of the complex object in your query.

For example your person schema has a frozen map `myFrozenMap` with typeDef `<map <int, text>>` that is indexed using the `full` keyword like the following:

```js
fields: {
    myFrozenMap: {
        type: 'frozen',
        typeDef: '<map <text, text>>'
    }
},
keys: [...],
indexes: ['full(myFrozenMap)']
```

So now you may query like the following:

```js
models.instance.Person.find({
    myFrozenMap: {
        my_key: 'my_value'
    }
}, {raw: true}, function(err, people){
    //people is a list of persons where myFrozenMap value is {mykey: 'my_value'}
});
```

## Virtual fields

Your model could have some fields which are not saved on database. You can define them as `virtual`

```js

module.exports = {
    "fields": {
        "id"     : { "type": "uuid", "default": {"$db_function": "uuid()"} },
        "name"   : { "type": "varchar", "default": "no name provided"},
        "surname"   : { "type": "varchar", "default": "no surname provided"},
        "complete_name" : {
            "type": "varchar",
            "virtual" : {
                get: function(){return this.name + ' ' +this.surname;},
                set: function(value){
                    value = value.split(' ');
                    this.name = value[0];
                    this.surname = value[1];
                }
            }
        }
    }
}

```

A virtual field is simply defined adding a `virtual` key in field description. Virtuals can have a `get` and a `set` function, both optional (you should define at least one of them!).
`this` inside get and set functions is bound to current instance of your model.

## Validators

Every time you set a property for an instance of your model, an internal type validator checks that the value is valid. If not an error is thrown. But how to add a custom validator? You need to provide your custom validator in the schema definition. For example, if you want to check age to be a number greater than zero:

```js

module.exports = {
    //... other properties hidden for clarity
    age: {
        type : "int",
        rule : function(value){ return value > 0; }
    }
}

```

your validator must return a boolean. If someone will try to assign `john.age = -15;` an error will be thrown.
You can also provide a message for validation error in this way

```js

module.exports = {
    //... other properties hidden for clarity
    age: {
        type : "int",
        rule : {
            validator : function(value){ return value > 0; },
            message   : 'Age must be greater than 0'
        }
    }
}

```

then the error will have your message. Message can also be a function; in that case it must return a string:

```js

module.exports = {
    //... other properties hidden for clarity
    age: {
        type : "int",
        rule : {
            validator : function(value){ return value > 0; },
            message   : function(value){ return 'Age must be greater than 0. You provided '+ value; }
        }
    }
}

```

The error message will be `Age must be greater than 0. You provided -15`

Note that default values _are_ validated if defined either by value or as a javascript function. Defaults defined as DB functions, on the other hand, are never validated in the model as they are retrieved _after_ the corresponding data has entered the DB.
If you need to exclude defaults from being checked you can pass an extra flag:

```js

module.exports = {
    //... other properties hidden for clarity
    email: {
        type : "text",
        default : "<enter your email here>",
        rule : {
            validator : function(value){ /* code to check that value matches an email pattern*/ },
            ignore_default: true
        }
    }
}

```

## Querying your data

Ok, now you have a bunch of people on db. How do I retrieve them?

### Find (results are model instances)

```js

models.instance.Person.find({name: 'John'}, function(err, people){
    if(err) throw err;
    //people is an array of model instances containing the persons with name `John`
    console.log('Found ', people);
});

//If you specifically expect only a single object after find, you may do this
models.instance.Person.findOne({name: 'John'}, function(err, john){
    if(err) throw err;
    //The variable `john` is a model instance containing the person named `John`
    //`john` will be undefined if no person named `John` was found
    console.log('Found ', john.name);
});

```

Note that, result objects here in callback will be model instances. So you may do operations like `john.save`, `john.delete` etc on the result object directly. If you want to extract the raw javascript object values from a model instance, you may use the toJSON method like `john.toJSON()`.

In the above example it will perform the query `SELECT * FROM person WHERE name='john'` but `find()` allows you to perform even more complex queries on cassandra.  You should be aware of how to query cassandra. Every error will be reported to you in the `err` argument, while in `people` you'll find instances of `Person`.

#### Find (results are raw objects)

If you don't want the orm to cast results to instances of your model you can use the `raw` option as in the following example:

```js

models.instance.Person.find({name: 'John'}, { raw: true }, function(err, people){
    //people is an array of plain objects
});

```

#### Find (A more complex query)

```js

var query = {
    name: 'John', // stays for name='john'
    age : { '$gt':10, '$lte':20 }, // stays for age>10 and age<=20 You can also use $gt, $gte, $lt, $lte, $eq
    surname : { '$in': ['Doe','Smith'] }, //This is an IN clause
    $orderby:{'$asc' :'age'}, //Order results by age in ascending order. Also allowed $desc and complex order like $orderby:{'$asc' : ['k1','k2'] }
    $limit: 10 //limit result set
}

models.instance.Person.find(query, {raw: true}, function(err, people){
    //people is an array of plain objects satisfying the query conditions above
});

```

#### Find (results to contain only selected columns)

You can also select particular columns using the select key in the options object like the following example:

```js

models.instance.Person.find({name: 'John'}, { select: ['name as username','age'] }, function(err, people){
    //people is an array of plain objects with only name and age
});

```

Note that if you use the `select` option, then the results will always be raw plain objects instead of model instances.

Also **Remember** that your select needs to include all the partition key columns defined for your table!

If your model key looks like this:

```js

module.exports = {
    fields: {
        //fields are not shown for clarity
    },
    key : [["columnOne","columnTwo","columnThree"],"columnFour","ColumnFive"]
}

```

Then your `select`-array has to at least include the partition key columns like this: `select: ['columnOne', 'columnTwo', 'columnThree']`.

#### Find (using aggregate function)

You can also use `aggregate functions` using the select key in the options object like the following example:

```js

models.instance.Person.find({name: 'John'}, { select: ['name','sum(age)'] }, function(err, people){
    //people is an array of plain objects with sum of all ages where name is John
});

```

#### Find (using distinct select)

Also, `DISTINCT` selects are possible:

```js

models.instance.Person.find({}, { select: ['name','age'], distinct: true }, function(err, people){
    //people is a distinct array of plain objects with only distinct name and ages.
});

```

#### Find (querying a materialized view)

And if you have defined `materialized views` in your schema as described in the schema detail section, then you can query your views by using the similar find/findOne functions. Just add an option with the materialized view name like the following:


```js

models.instance.Person.find({name: 'John'}, { materialized_view: 'view_name1', raw: true }, function(err, people){
    //people is an array of plain objects taken from the materialized view
});

```

#### Find (with allow filtering)

If you want to set allow filtering option, you may do that like this:

```js

models.instance.Person.find(query, {raw:true, allow_filtering: true}, function(err, people){
    //people is an array of plain objects
});

```

#### Find (using index expression)

If you want to use custom index expressions, you may do that like this:

```js
var query = {
    $expr: {
        index: 'YOUR_INDEX_NAME',
        query: 'YOUR_CUSTOM_EXPR_QUERY'
    }
}

models.instance.Person.find(query, function(err, people){

});

```

#### Find (fetching large result sets using streaming queries)

The stream() method automatically fetches the following pages, yielding the rows as they come through the network and retrieving the following page after the previous rows were read (throttling).

```js
models.instance.Person.stream({Name: 'John'}, {raw: true}, function(reader){
    var row;
    while (row = reader.readRow()) {
        //process row
    }
}, function(err){
    //emitted when all rows have been retrieved and read
});
```

With the eachRow() method, you can retrieve the following pages automatically by setting the autoPage flag to true in the query options to request the following pages automatically. Because eachRow() does not handle backpressure, it is only suitable when there is minimum computation per row required and no additional I/O, otherwise it ends up buffering an unbounded amount of rows.

```js
models.instance.Person.eachRow({Name: 'John'}, {autoPage : true}, function(n, row){
    // invoked per each row in all the pages
}, function(err, result){
    // ...
});
```

If you want to retrieve the next page of results only when you ask for it (for example, in a web page or after a certain computation or job finished), you can use the eachRow() method in the following way:

```js
models.instance.Person.eachRow({Name: 'John'}, {fetchSize : 100}, function(n, row){
    // invoked per each row in all the pages
}, function(err, result){
    // called once the page has been retrieved.
    if(err) throw err;
    if (result.nextPage) {
        // retrieve the following pages
        // the same row handler from above will be used
        result.nextPage();
    }
});
```

You can also use the `pageState` property, a string token made available in the result if there are additional result pages.

```js
models.instance.Person.eachRow({Name: 'John'}, {fetchSize : 100}, function(n, row){
    // invoked per each row in all the pages
}, function(err, result){
    // called once the page has been retrieved.
    if(err) throw err;
    // store the paging state
    pageState = result.pageState;
});
```

In the next request, use the page state to fetch the following rows.

```js
models.instance.Person.eachRow({Name: 'John'}, {fetchSize : 100, pageState : pageState}, function(n, row){
    // invoked per each row in all the pages
}, function(err, result){
    // called once the page has been retrieved.
    if(err) throw err;
    // store the next paging state.
      pageState = result.pageState;
});
```

Saving the paging state works well when you only let the user move from one page to the next. But it doesn’t allow random jumps (like "go directly to page 10"), because you can't fetch a page unless you have the paging state of the previous one. Such a feature would require offset queries, which are not natively supported by Cassandra.

Note: The page state token can be manipulated to retrieve other results within the same column family, so it is not safe to expose it to the users.

#### Find (token based pagination)

You can also use the `token` comparison function while querying a result set using the $token operator. This is specially useful for [paging through unordered partitioner results](https://docs.datastax.com/en/cql/3.3/cql/cql_using/usePaging.html).

```js
//consider the following situation
var query = {
    $limit:10
};
models.instance.Person.find(query, function(err, people){
    //people is an array of first 10 persons

    //Say your PRIMARY_KEY column is `name` and the 10th person has the name 'John'
    //Now to get the next 10 results, you may use the $token operator like the following:
    var query = {
        name:{
            '$token':{'$gt':'John'}
        },
        $limit:10
    };
    //The above query translates to `Select * from person where token(name) > token('John') limit 10`
    models.instance.Person.find(query, function(err, people){
        //people is an array of objects containing the 11th - 20th person
    });
});
```

If you have a `composite partition key`, then the token operator should be contained in comma (,) separated partition key field names and the values should be an array containing the values for the partition key fields. Following is an example to demonstrate that:

```js
var query = {
    'id,name':{
        '$token':{
            '$gt':[1234,'John']
        }
    }
};
models.instance.Person.find(query, function(err, people){

});
```

Note that all query clauses must be Cassandra compliant. You cannot, for example, use $in operator for a key which is not part of the primary key. Querying in Cassandra is very basic but could be confusing at first. Take a look at this [post](http://mechanics.flite.com/blog/2013/11/05/breaking-down-the-cql-where-clause/) and, obvsiouly, at the [cql query documentation](https://docs.datastax.com/en/cql/3.3/cql/cql_using/useQueryDataTOC.html)


## Save / Update / Delete

### Save

The save operation on a model instance will insert a new record with the attribute values mentioned when creating the model object. It will update the record if it already exists in the database. A record is updated or inserted based on the primary key definition. If the primary key values are same as an existing record, then the record will be updated and otherwise it will be inserted as new record.

```js

var john = new models.instance.Person({name: 'John', surname: 'Doe', age: 32});
john.save(function(err){
    if(err) console.log(err);
    else console.log('Yuppiie!');
});

```

You can use the find query to get an object and modify it and save it like the following:

```js

models.instance.Person.findOne({name: 'John'}, function(err, john){
    if(err) throw err;
    if(john){
        john.age = 30;
        john.save(function(err){
            if(err) console.log(err);
            else console.log('Yuppiie!');
        });
    }
});

```

The save function also takes optional parameters. By default cassandra will update the row if the primary key
already exists. If you want to avoid on duplicate key updates, you may set if_not_exist:true.

```js

john.save({if_not_exist: true}, function(err){
    if(err) console.log(err);
    else console.log('Yuppiie!');
});

```

You can also set an expiry ttl for the saved row if you want. In that case the row will be removed by cassandra
automatically after the time to live has expired.

```js

//The row will be removed after 86400 seconds or one day
john.save({ttl: 86400}, function(err){
    if(err) console.log(err);
    else console.log('Yuppiie!');
});

```

### Update

Use the update function if your requirements are not satisfied with the `save()` function or you directly want to update records without reading them from the db. The update function takes the following forms, (options are optional):

```js

/*
UPDATE person
    USING TTL 86400
    SET email='abc@gmail.com'
WHERE username= 'abc'
    IF EXISTS
*/

var query_object = {username: 'abc'};
var update_values_object = {email: 'abc@gmail.com'};
var options = {ttl: 86400, if_exists: true};
models.instance.Person.update(query_object, update_values_object, options, function(err){
    if(err) console.log(err);
    else console.log('Yuppiie!');
});


/*
UPDATE person
    SET email='abc@gmail.com'
WHERE username= 'abc'
    IF email='typo@gmail.com'
*/
var query_object = {username: 'abc'};
var update_values_object = {email: 'abc@gmail.com'};
var options = {conditions: {email: 'typo@gmail.com'}};
models.instance.Person.update(query_object, update_values_object, options, function(err){
    if(err) console.log(err);
    else console.log('Yuppiie!');
});

```

### Delete

The delete function takes the following form:

```js

//DELETE FROM person WHERE username='abc';
var query_object = {username: 'abc'};
models.instance.Person.delete(query_object, function(err){
    if(err) console.log(err);
    else console.log('Yuppiie!');
});

```

If you have a model instance and you want to delete the instance object, you may do that like the following:

```js
models.instance.Person.findOne({name: 'John'}, function(err, john){
    if(err) throw err;

    //Note that returned variable john here is an instance of your model,
    //so you can do john.delete() like the following
    john.delete(function(err){
        //...
    });
});
```


## Raw Query

You can get the raw query interface from cassandra nodejs-driver using the `execute_query` method.

```js

var query = "Select * from user where gender=? and age > ? limit ?";
var params = ['male', 18, 10];
models.instance.Person.execute_query(query, params, function(err, people){
    //people is an array of plain objects
});

```

## Batching ORM Operations

You can batch any number of save, update and delete operations using the `models.doBatch` function. To use more than one of those functions as a combined batch operation, you need to tell each of the save/update/delete functions, that you want to get the final built query from the orm instead of executing it immediately. You can do that by adding a `return_query` parameter in the options object of the corresponding function and build an array of operations to execute atomically like the following:

```js
var queries = [];

var event = new models.instance.Event({
    id: 3,
    body: 'hello3'
});
var save_query = event.save({return_query: true});
queries.push(save_query);

var update_query = models.instance.Event.update(
    {id: 1},
    {body: 'hello1 updated'},
    {return_query: true}
);
queries.push(update_query);

var delete_query = models.instance.Event.delete(
    {id: 2},
    {return_query: true}
);
queries.push(delete_query);

models.doBatch(queries, function(err){
    if(err) throw err;
});
```

## Debug Logging Queries

You can log the generated queries by the orm if you want. Just set the `DEBUG` environment variable like the following while starting your app:

```
DEBUG=express-cassandra node app.js
```

## Raw Batch Query

You can get the batch query interface from cassandra nodejs-driver using the `execute_batch` method.

```js

var queries = [
    {
        query: "...",
        params: [...]
    },
    {
        query: "...",
        params: [...]
    }
];
models.instance.Person.execute_batch(queries, function(err){

});

```

## Get the client driver instance

You can get the client driver instance from cassandra nodejs-driver using the `get_cql_client` method. This will provide you a cql driver instance with which you can do anything you could possibly do with the datastax nodejs-driver version 3.0.

```js

models.instance.Person.get_cql_client(function(err, client){
    client.eachRow('Select * from person limit 10', [], { autoPage : true }, function(n, row) {}, function(err, result){});
});

```

## Closing connections to cassandra

You can close all orm connections to cassandra by using the following function:

```js
models.close(function(err){
    if(err) throw err;
});
```

## Note

All queries except schema definition related queries (i.e. create table etc.) are prepared by default. If you don't want to prepare queries, just set `prepare=false` in the options object.

```js
models.instance.Person.find(query, {prepare: false}, function(err, people){
    //people is an array of plain objects
});
```
