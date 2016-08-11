# Batching ORM Operations

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