# Querying Data

Ok, now you have a bunch of people on db. How do I retrieve them?

## Find (results are model instances)

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

## Find (results are raw objects)

If you don't want the orm to cast results to instances of your model you can use the `raw` option as in the following example:

```js

models.instance.Person.find({name: 'John'}, { raw: true }, function(err, people){
    //people is an array of plain objects
});

```

## Find (A more complex query)

```js

var query = {
    // equal query stays for name='john', also could be written as name: { $eq: 'John' }
    name: 'John',
    // range query stays for age>10 and age<=20. You can use $gt (>), $gte (>=), $lt (<), $lte (<=)
    age : { '$gt':10, '$lte':20 },
    // IN clause, means surname should either be Doe or Smith
    surname : { '$in': ['Doe','Smith'] },
    // like query supported by sasi indexes, complete_name must have an SASI index defined in custom_indexes
    complete_name: { '$like': 'J%' },
    // order results by age in ascending order.
    // also allowed $desc and complex order like $orderby: {'$asc' : ['k1','k2'] }
    $orderby: { '$asc' :'age' },
    // group results by a certain field or list of fields
    $groupby: [ 'age' ],
    //limit the result set to 10 rows, $per_partition_limit is also supported
    $limit: 10
}

models.instance.Person.find(query, {raw: true}, function(err, people){
    //people is an array of plain objects satisfying the query conditions above
});

```

### Query Operators for WHERE and IF conditions

Following are the query operators and their cassandra counterparts:

```
{
    $eq: '=',
    $ne: '!=', // applicable for IF conditions only
    $isnt: 'IS NOT', // applicable for materialized view filters only
    $gt: '>',
    $lt: '<',
    $gte: '>=',
    $lte: '<=',
    $in: 'IN',
    $like: 'LIKE', // applicable for sasi indexes only
    $token: 'token', // applicable for token queries only
    $contains: 'CONTAINS', // applicable for indexed collections only
    $contains_key: 'CONTAINS KEY', // applicable for indexed maps only
}
```

Note that all query clauses must be Cassandra compliant. You cannot, for example, use $in operator for a key which is not part of the primary key. Querying in Cassandra is very basic but could be confusing at first. Take a look at this [post](http://mechanics.flite.com/blog/2013/11/05/breaking-down-the-cql-where-clause/) and, obvsiouly, at the [cql query documentation](https://docs.datastax.com/en/cql/3.3/cql/cql_using/useQueryDataTOC.html)

## Find (results to contain only selected columns)

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

export default {
    fields: {
        //fields are not shown for clarity
    },
    key : [["columnOne","columnTwo","columnThree"],"columnFour","ColumnFive"]
}

```

Then your `select`-array has to at least include the partition key columns like this: `select: ['columnOne', 'columnTwo', 'columnThree']`.

## Find (using aggregate function)

You can also use `aggregate functions` using the select key in the options object like the following example:

```js

models.instance.Person.find({name: 'John'}, { select: ['name','sum(age)'] }, function(err, people){
    //people is an array of plain objects with sum of all ages where name is John
});

```

## Find (using distinct select)

Also, `DISTINCT` selects are possible:

```js

models.instance.Person.find({}, { select: ['name','age'], distinct: true }, function(err, people){
    //people is a distinct array of plain objects with only distinct name and ages.
});

```

## Find (querying a materialized view)

And if you have defined `materialized views` in your schema as described in the schema detail section, then you can query your views by using the similar find/findOne functions. Just add an option with the materialized view name like the following:


```js

models.instance.Person.find({name: 'John'}, { materialized_view: 'view_name1', raw: true }, function(err, people){
    //people is an array of plain objects taken from the materialized view
});

```

## Find (with allow filtering)

If you want to set allow filtering option, you may do that like this:

```js

models.instance.Person.find(query, {raw:true, allow_filtering: true}, function(err, people){
    //people is an array of plain objects
});

```

## Find (using index expression)

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

## Find (fetching large result sets using streaming queries)

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

## Find (token based pagination)

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

## DataStax Enterprise Search (Not available in community edition)

If you are using dse search, $solr_query can be used like the following:

```js
var query = {
    $solr_query: 'name: cat name: dog -name:fish'
}

models.instance.Person.find(query, function(err, people){

});

```
