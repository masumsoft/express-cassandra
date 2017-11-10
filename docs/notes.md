# Notes

## Prepared Queries

All queries except schema definition related queries (i.e. create table etc.) are prepared by default. If you don't want to prepare queries, just set `prepare=false` in the options object.

```js
models.instance.Person.find(query, {prepare: false}, function(err, people){
    //people is an array of plain objects
});
```

## Get Cassandra Table Name

To get the cassandra table name for your model instance, you can use the `get_table_name()` function.

```js

models.instance.Person.get_table_name(); // returns 'person'

models.instance.Person.findOne({ name: 'alex' }, function(err, alex) {
    alex.get_table_name(); // returns 'person'
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

You can get the client driver instance from cassandra nodejs-driver using the `get_cql_client` method. This will provide you a cql driver instance with which you can do anything you could possibly do with the cassandra-driver for apache cassandra or datastax dse-driver for datastax enterprise, depending on which driver you are using.

```js
models.instance.Person.get_cql_client(function(err, client){
    client.eachRow('Select * from person limit 10', [], { autoPage : true }, function(n, row) {}, function(err, result){});
});
```

You can also use datastax enterprise graph by using the [dse-driver](http://docs.datastax.com/en/developer/nodejs-driver-dse/1.3/#graph) client instance. You need to provide the graph options in the `clientOptions` described before in usage section like the following:

```js
clientOptions: {
    contactPoints: ['127.0.0.1'],
    keyspace: 'mykeyspace',
    queryOptions: {consistency: models.consistencies.one},
    graphOptions: { name: 'demo' }
},
```

Now you can take the cql instance and do graph queries like the following:

```js
models.instance.Person.get_cql_client(function(err, client){
    client.executeGraph('g.V()', function (err, result) {
        assert.ifError(err);
        const vertex = result.first();
        console.log(vertex.label);
    });
});
```

Details of graph operations can be found in [dse-driver docs](http://docs.datastax.com/en/developer/nodejs-driver-dse/1.3/#graph) and in [datastax enterprise docs](http://docs.datastax.com/en/latest-dse/datastax_enterprise/graph/graphTOC.html).

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
