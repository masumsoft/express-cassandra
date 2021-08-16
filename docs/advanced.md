# Advanced Datatypes and Operations

## Counter Column Operations

Cassandra counter column increment and decrement operations are supported via the update operation. To increment/decrement a counter, you can use the following types of update operation:

```js
//Say your model name is StatsModel that has a user_id as the primary key and visit_count as a counter column.

models.instance.Stats.update({user_id: 1234}, {visit_count: models.datatypes.Long.fromInt(2)}, function(err){
    //visit_count will be incremented by 2
});

models.instance.Stats.update({user_id: 1234}, {visit_count: models.datatypes.Long.fromInt(-1)}, function(err){
    //visit_count will be decremented by 1
});
```

Please note that counter columns has special limitations, to know more about the counter column usage, see the [cassandra counter docs](https://docs.datastax.com/en/cql/3.3/cql/cql_using/useCountersConcept.html).

## Collection Data Types

Cassandra collection data types (`map`, `list` & `set`) are supported in model schema definitions. An additional `typeDef` attribute is used to define the collection type.

```js

export default {

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

## Frozen Collections

Frozen collections are useful if you want to use them in the primary key. Frozen collection can only be replaced as a whole, you cannot for example add/remove elements in a frozen collection.

```js
myfrozenmap: {
    type: "frozen",
    typeDef: "<map<varchar, text>>"
}
```

## Tuple Data Type

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

## User Defined Types, Functions and Aggregates

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

## Shared Static Columns

In a table that uses clustering columns, non-clustering columns can be declared static in the schema definition like the following:

```js
"my_shared_data": {
    "type": "text",
    "static": true
}
```

Note that static columns are only static within a given partition. Static columns also has several restrictions described in the cassandra [static column documentation](https://docs.datastax.com/en/cql/3.3/cql/cql_reference/refStaticCol.html).

## Indexed Collections

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
