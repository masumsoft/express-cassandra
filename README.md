[![Build Status](https://travis-ci.org/masumsoft/express-cassandra.svg)](https://travis-ci.org/masumsoft/express-cassandra)
[![npm version](https://badge.fury.io/js/express-cassandra.svg)](http://badge.fury.io/js/express-cassandra)

express-cassandra
===================

No more hassling with raw cql queries from your nodejs web frameworks. express-cassandra automatically loads your models and provides you with object oriented mapping to your cassandra tables like a standard ORM.

This module uses datastax <a href="https://github.com/datastax/nodejs-driver">cassandra-driver</a> for node and many of the orm features are wrapper over a modified version of <a href="https://github.com/3logic/apollo-cassandra">apollo-cassandra</a> module. The modifications made to the orm library was necessary to support missing features in the orm and to make it compatible with requirements of this module.


## Installation

    $ npm install express-cassandra

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
models.setDirectory( __dirname + '/models').bind(
    {
        clientOptions: {
            contactPoints: ['127.0.0.1'],
            keyspace: 'mykeyspace',
            queryOptions: {consistency: models.consistencies.one}
        },
        ormOptions: {
            defaultReplicationStrategy : {
                class: 'SimpleStrategy',
                replication_factor: 1
            },
            dropTableOnSchemaChange: false
        }
    },
    function(err) {
        if(err) console.log(err.message);
        else console.log(models.timeuuid());
    }
);

```

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

## Model Schema in detail

```js

module.exports = {
    "fields": {
        "id"     : { "type": "uuid", "default": {"$db_function": "uuid()"} },
        "name"   : { "type": "varchar", "default": "no name provided"},
        "surname"   : { "type": "varchar", "default": "no surname provided"},
        "complete_name" : { "type": "varchar", "default": function(){ return this.name + ' ' + this.surname;}},
        "age"    :  { "type": "int" },
        "created"     : {"type": "timestamp", "default" : {"$db_function": "dateOf(now())"} }
    },
    "key" : [["id"],"created"],
    "indexes": ["name"],
    "custom_index": {
        on: '...',
        using: '...',
        options: {
            option1 : '...',
            option2: '...'
        }
    }
}

```

What does the above code means?
- `fields` are the columns of your table. For each column name the value can be a string representing the type or an object containing more specific informations. i.e.
    + ` "id"     : { "type": "uuid", "default": {"$db_function": "uuid()"} },` in this example id type is `uuid` and the default value is a cassandra function (so it will be executed from the database).
    + `"name"   : { "type": "varchar", "default": "no name provided"},` in this case name is a varchar and, if no value will be provided, it will have a default value of `no name provided`. The same goes for `surname`.
    + `complete_name` the default values is calculated from others field. When the orm processes your model instances, the `complete_name` will be the result of the function you defined. In the function `this` is bound to the current model instance.
    + `age` no default is provided and we could write it just as `"age": "int"`.
    + `created`, like uuid(), will be evaluated from cassandra using the `now()` function.
- `key`: here is where you define the key of your table. As you can imagine, the array defines a `compound primary key` and the first value of the array is the `partition key` and the others are the `clustering keys`. The `partition key` itself can be an array with multiple fields making it a `composite key`. Read more about compound keys on the <a href="http://docs.datastax.com/en/cql/3.1/cql/ddl/ddl_compound_keys_c.html" target="_blank">documentation</a>
- `indexes` are the index of your table. It's always an array of field names. You can read more on the <a href="http://www.datastax.com/documentation/cql/3.1/cql/ddl/ddl_primary_index_c.html" target="_blank">documentation</a>
- `custom_index` provides the ability to define custom indexes with cassandra. Cassandra upto version 2.1.x supports only one custom index per table.

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
*   `models.timeuuid()`  
    returns a type 1 (time-based) uuid, suitable for Cassandra `timeuuid` fields, as a string
*   `models.consistencies`
    this object contains all the available consistency enums defined by node cassandra driver, so you can for example use models.consistencies.one, models.consistencies.quorum etc.
*   `models.datatypes`
    this object contains all the available datatypes defined by node cassandra driver, so you can for example use
    models.datatypes.Long to deal with the cassandra bigint or counter field types.

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

Please note that counter columns has special limitations, to know more about the counter column usage, see the <a href="http://docs.datastax.com/en/cql/3.1/cql/cql_using/use_counter_t.html">cassandra docs</a>.

### Support for Composite Data Types

Cassandra composite data types (`map`, `list` & `set`) are supported in model schema definitions. An additional `typeDef` attribute is used to define the composite type.

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

When saving or updating composite types, use an object for a `map` value and use an array for `set` or `list` value like the following:

```

var person = new models.instance.Person({

    mymap: {'key1':'val1','key2': 'val2'},
    mylist: ['value1', 'value2'],
    myset: ['value1', 'value2']

});

person.save(function(err){

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

### Find

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

In the above example it will perform the query `SELECT * FROM person WHERE name='john'` but `find()` allows you to perform even more complex queries on cassandra.  You should be aware of how to query cassandra. Every error will be reported to you in the `err` argument, while in `people` you'll find instances of `Person`.

If you don't want the orm to cast results to instances of your model you can use the `raw` option as in the following example:

```js

models.instance.Person.find({name: 'John'}, { raw: true }, function(err, people){
    //people is an array of plain objects
});

```

You can also select particular columns using the select key in the options object like the following example:

```js

models.instance.Person.find({name: 'John'}, { raw: true, select: ['name','age'] }, function(err, people){
    //people is an array of plain objects with only name and age
});

```

### Let's see a complex query

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

If you want to set allow filtering option, you may do that like this:

```js

models.instance.Person.find(query, {raw:true, allow_filtering: true}, function(err, people){
    //people is an array of plain objects
});

```

You can also use the `token` comparison function while querying a result set using the $token operator. This is specially useful for <a href="http://docs.datastax.com/en/cql/3.1/cql/cql_using/paging_c.html">paging through unordered partitioner results</a>.

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

Note that all query clauses must be Cassandra compliant. You cannot, for example, use $in operator for a key which is not the partition key. Querying in Cassandra is very basic but could be confusing at first. Take a look at this <a href="http://mechanics.flite.com/blog/2013/11/05/breaking-down-the-cql-where-clause/" target="_blank">post</a> and, obvsiouly, at the <a href="http://www.datastax.com/documentation/cql/3.1/cql/cql_using/about_cql_c.html" target="_blank">documentation</a>


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


## Raw Query

You can get the raw query interface from cassandra nodejs-driver using the `execute_query` method.

```js

var query = "Select * from user where gender=? and age > ? limit ?";
var params = ['male', 18, 10];
models.instance.Person.execute_query(query, params, function(err, people){
    //people is an array of plain objects
});

```

## Batch Query

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

You can get the client driver instance from cassandra nodejs-driver using the `get_cql_client` method. This will provide you a cql driver instance with which you can do anything you could possibly do with the datastax nodejs-driver version 2.1.

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

```
models.instance.Person.find(query, {prepare: false}, function(err, people){
    //people is an array of plain objects
});
```
