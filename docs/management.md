# Data Management

## Save

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

## Update

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

Note that the conditions object supports [query operators](find.md#query-operators-for-where-and-if-conditions). So for example, if you want to use $gt, $lt etc operators in your if conditions for light weight transactions, you can do that as well.

## Delete

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

## Truncate

Truncate is a destructive operation. It deletes or clears all data in the table. The truncate function takes the following form:

```js

//TRUNCATE TABLE person;
models.instance.Person.truncate(function(err){
    if(err) console.log(err);
    else console.log('Yuppiie!');
});

```

## Hook Functions

When you perform a save/update/delete operation, a hook function helps you to tap into it in order to change data or perform other operations. Following are the available hook functions you can define in your schema:

```js
export default {
    fields: {
        ...
    },
    key: [...],
    before_save: function (instance, options) {
        return true;
    },
    after_save: function (instance, options) {
        return true;
    },
    before_update: function (queryObject, updateValues, options) {
        return true;
    },
    after_update: function (queryObject, updateValues, options) {
        return true;
    },
    before_delete: function (queryObject, options) {
        return true;
    },
    after_delete: function (queryObject, options) {
        return true;
    },
}
```

* `before_save` if defined, will be automatically called each time before a save operation is performed. The `instance` will contain the model instance, so you could modify instance values or perform other things based on it. The `options` will contain the query options being passed to cassandra. You could also modify the options or do things based on it. After you're done, you should `return true;` to let the data saved in cassandra. Otherwise you may also `return false;` to halt the save operation. In this case the data will not be saved and the caller will receive an error message via callback.

* `after_save` if defined, will be automatically called each time after a save operation is successfully performed. The `instance` will contain the model instance, so you could get the instance values that were actually used and perform other things based on it. Note that if you performed any database functions then the output of those functions will not be available in the instance object. For example if you used the `$db_function: 'uuid()'` to generate your id field, then the actual saved value will not be available in the instance object. If you need to know what id was generated, then you need to use the utility function `models.uuid()` in javascript and send that value in the id field instead of using $db_function. The `options` will contain the final query options passed to cassandra. After you're done, you should `return true;` to let the caller recieve it's callback. Otherwise you may also `return false;` and in this case the caller will receive an error message via callback.

* `before_update` if defined, will be automatically called each time before an update operation is performed. The `queryObject` and the `updateValues` will contain the query and updated values part of the update operation as is, so you could modify them if required or perform other things based on them. The `options` will contain the query options being passed to cassandra. You could also modify the options or do things based on it. After you're done, you should `return true;` to let the data updated in cassandra. Otherwise you may also `return false;` to halt the update operation. In this case the data will not be updated and the caller will receive an error message via callback.

* `after_update` if defined, will be automatically called each time after an update operation is successfully performed. The `queryObject` and the `updateValues` will contain the query and updated values part of the update operation as is, so you could get the query and values that were actually used and perform other things based on them. Note that if you performed any database functions then the output of those functions will not be available in the updateValues object. For example if you used the `$db_function: 'now()'` to update your `updatedAt` field, then the actual updated value will not be available in the `updateValues` object. If you need to know the updated value of the `updatedAt` field, then you need to generate the current timestamp in javascript and send that value in the updatedAt field instead of using $db_function. The `options` will contain the final query options passed to cassandra. After you're done, you should `return true;` to let the caller recieve it's callback. Otherwise you may also `return false;` and in this case the caller will receive an error message via callback.

* `before_delete` if defined, will be automatically called each time before a delete operation is performed. The `queryObject` will contain the query part of the delete operation as is, so you could modify them if required or perform other things based on them. The `options` will contain the query options being passed to cassandra. You could also modify the options or do things based on it. After you're done, you should `return true;` to let the data deleted in cassandra. Otherwise you may also `return false;` to halt the delete operation. In this case the data will not be deleted and the caller will receive an error message via callback.

* `after_delete` if defined, will be automatically called each time after a delete operation is successfully performed. The `queryObject` will contain the query part of the delete operation as is, so you could get the query that was actually used and perform other things based on it. The `options` will contain the final query options passed to cassandra. After you're done, you should `return true;` to let the caller recieve it's callback. Otherwise you may also `return false;` and in this case the caller will receive an error message via callback.

## Tracking changes to data

The isModified operation on a model instance lets you know whether or not the entire document or a field in particular has been modified locally since it has been retrieved from the database. This can be useful if you are running expensive operations in your model hooks that do not need to be performed in case the value of a field has not changed.

```js
var john = new models.instance.Person({name: 'John', surname: 'Doe', age: 32});
john.isModified(); // Returns true
john.save(function(err){
    if(err) console.log(err);
    john.isModified(); // Returns false
});

var jane = models.instance.Person.findOne({name: 'Jane'}, function(err, jane) {
  if (err) throw err;

  if (jane) {
    jane.isModified('surname'); // Returns false
    jane.surname = 'Smith';
    jane.isModified('surname'); // Returns true
    jane.save(function(err) {
        if(err) console.log(err);
        jane.isModified('surname'); // Returns false
    });
  });
});
```
