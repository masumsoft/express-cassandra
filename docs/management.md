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