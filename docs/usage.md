# Usage Tutorial

## Auto-Load Models from a Directory

```js
var models = require('express-cassandra');

//Tell express-cassandra to use the models-directory, and
//use bind() to load the models using cassandra configurations.
models.setDirectory( __dirname + '/models').bind(
    {
        clientOptions: {
            contactPoints: ['127.0.0.1'],
            protocolOptions: { port: 9042 },
            keyspace: 'mykeyspace',
            queryOptions: {consistency: models.consistencies.one}
        },
        ormOptions: {
            //If your keyspace doesn't exist it will be created automatically
            //using the default replication strategy provided here.
            defaultReplicationStrategy : {
                class: 'SimpleStrategy',
                replication_factor: 1
            },
            migration: 'safe',
            createKeyspace: true
        }
    },
    function(err) {
        if(err) console.log(err.message);
        else console.log(models.timeuuid());
    }
);

```

Automatic migration is supported. When your model schema changes, the config variable `migration` defines the migration behaviour.

* `alter` will try to alter the corresponding cassandra table to match
the new schema. This operation will try to keep the existing data in
the table and put null data in the newly created fields. Note that if
a field in removed in the changed schema then the column will be
dropped from the table and the data associated with the column or
field will be lost. Also for primary key or clustering_order changes,
the table must be dropped and data will be lost in the process because
cassandra won't allow altering primary key. The module will ask for a
confirmation from the user in the terminal whether to perform the
required alter/drop operations per changed table.

* `drop` will always drop and recreate the table and indexes in case
of schema change. This will wipe out all data in that table. It will
ask for a confirmation from the user in the terminal whether to perform
the required drop operations per changed table.

* `safe` will send an error message in callback for any kind of model
attribute changes. You need to migrate yourself. This is the recommended
setting for production. Note that if NODE_ENV==="production" then
regardless of the migration setting, `safe` is always used to protect
inadvertent deletion of your data.

Note that some environments might not support tty console, so asking the user for confirmation in the terminal may throw errors. If you face such problems or want to automate the migration process in a dev/staging environment then you can set the property `disableTTYConfirmation: true` in the ormOptions. This will do the migrations without asking for a confirmation from the user.

If `createKeyspace=false`, then it won't be checked whether the specified keyspace exists and, if not, it won't get created automatically.


### Now Define a Model named `PersonModel.js` inside Models Directory

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

Note that a model class name should contain the word `Model` in it, otherwise it won't be treated as a model class.

## Alternatively Load & Organize Models Yourself

Alternatively if you don't want to load your models automatically from a specific directory and want to define and load models yourself, then you can asynchronously load your schemas like the following:

```js
var Cassandra = require('express-cassandra');
var models = Cassandra.createClient({
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
        migration: 'safe',
        createKeyspace: true
    }
});

models.connect(function (err) {
    if (err) throw err;

    var MyModel = models.loadSchema('Person', {
        fields:{
            name    : "text",
            surname : "text",
            age     : "int"
        },
        key:["name"]
    }, function(err, UserModel){
        //the table in cassandra is now created
        //the models.instance.Person, UserModel or MyModel can now be used
        console.log(models.instance.Person);
        console.log(models.instance.Person === UserModel);
        console.log(models.instance.Person === MyModel);
    });
});
```

## Important Note on Migrations Support
Current support for migration is an experimental feature and should be set to `safe` for production environments. When set to `alter` or `drop` the ORM will try to take a conservative approach and will ask the user for confirmation when doing any data destructive operation. But as this feature is new and not yet stable, you might encounter some bugs or glitches here and there. Please report an issue in [github](https://github.com/masumsoft/express-cassandra/issues/) if you face any. The team will try their best to fix the problem within short time.

## Connecting to Cassandra Using Authentication

For connecting to cassandra using authentication, you can use the nodejs-driver `authProvider` option in the `clientOptions` object like the following:

```js
clientOptions: {
    contactPoints: ['127.0.0.1'],
    protocolOptions: { port: 9042 },
    keyspace: 'mykeyspace',
    queryOptions: {consistency: models.consistencies.one},
    authProvider: new models.driver.auth.DsePlainTextAuthProvider('my_user', 'my_password')
}
```

Infact any of the clientOptions supported by the nodejs driver can be used. Possible options are documented in the [cassandra driver docs](http://docs.datastax.com/en/developer/nodejs-driver/3.0/common/drivers/reference/clientOptions.html).

## Let's Insert Some Data into PersonModel

```js

var john = new models.instance.Person({
    name: "John",
    surname: "Doe",
    age: 32
});
john.save(function(err){
    if(err) {
        console.log(err);
        return;
    }
    console.log('Yuppiie!');
});

```

## Now Let's Find it

```js

models.instance.Person.findOne({name: 'John'}, function(err, john){
    if(err) {
        console.log(err);
        return;
    }
    //Note that returned variable john here is an instance of your model,
    //so you can also do john.delete(), john.save() type operations on the instance.
    console.log('Found ' + john.name + ' to be ' + john.age + ' years old!');
});

```

## Built-in Promise Support

Express-cassandra has built-in promise support powered by [bluebird](http://bluebirdjs.com/). All the orm functions has an `Async` suffixed pair function that can be used for promise based async operations instead of using callback. For example, if you want to use promises in the above two insert and find operations, you could do the following:

Insert data using promise (note the Async suffix in function name):

```js

var john = new models.instance.Person({
    name: "John",
    surname: "Doe",
    age: 32
});
john.saveAsync()
    .then(function() {
        console.log('Yuppiie!');
    })
    .catch(function(err) {
        console.log(err);
    });

```

Find data using promise (note the Async suffix in function name):

```js

models.instance.Person.findOneAsync({name: 'John'})
    .then(function(john) {
        console.log('Found ' + john.name + ' to be ' + john.age + ' years old!');
    })
    .catch(function(err) {
        console.log(err);
    });

```
