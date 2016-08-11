# Notes

All queries except schema definition related queries (i.e. create table etc.) are prepared by default. If you don't want to prepare queries, just set `prepare=false` in the options object.

```js
models.instance.Person.find(query, {prepare: false}, function(err, people){
    //people is an array of plain objects
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

## Debug Logging Queries

You can log the generated queries by the orm if you want. Just set the `DEBUG` environment variable like the following while starting your app:

```
DEBUG=express-cassandra node app.js
```

## Closing connections to cassandra

You can close all orm connections to cassandra by using the following function:

```js
models.close(function(err){
    if(err) throw err;
});
```
