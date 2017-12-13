# Usage Tutorial

## Auto-Load Models from a Directory

### Define a Model named `PersonModel.js` in `models` Directory

```js

module.exports = {
    fields:{
        name    : "text",
        surname : "text",
        age     : "int",
        created : "timestamp"
    },
    key:["name"]
}

```

Note that a model class name should contain the word `Model` in it, otherwise it won't be treated as a model.

### Now bind the `models` directory with express-cassandra

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
            defaultReplicationStrategy : {
                class: 'SimpleStrategy',
                replication_factor: 1
            },
            migration: 'safe'
        }
    },
    function(err) {
        if(err) throw err;

        // You'll now have a `person` table in cassandra created against the model
        // schema you've defined earlier and you can now access the model instance
        // in `models.instance.Person` object containing supported orm operations.
    }
);

```

## Alternatively Load & Organize Models Yourself

Alternatively if you don't want to load your models automatically from a specific directory and want to load and sync models yourself, then you can load your schemas like the following:

```js
var ExpressCassandra = require('express-cassandra');
var models = ExpressCassandra.createClient({
    clientOptions: {
        contactPoints: ['127.0.0.1'],
        protocolOptions: { port: 9042 },
        keyspace: 'mykeyspace',
        queryOptions: {consistency: ExpressCassandra.consistencies.one}
    },
    ormOptions: {
        defaultReplicationStrategy : {
            class: 'SimpleStrategy',
            replication_factor: 1
        },
        migration: 'safe',
    }
});

var MyModel = models.loadSchema('Person', {
    fields:{
        name    : "text",
        surname : "text",
        age     : "int",
        created : "timestamp"
    },
    key:["name"]
});

// MyModel or models.instance.Person can now be used as the model instance
console.log(models.instance.Person === MyModel);

// sync the schema definition with the cassandra database table
// if the schema has not changed, the callback will fire immediately
// otherwise express-cassandra will try to migrate the schema and fire the callback afterwards
MyModel.syncDB(function(err, result) {
    if (err) throw err;
    // result == true if any database schema was updated
    // result == false if no schema change was detected in your models
});
```

## Explanations for the Options Used to Initialize

> clientOptions

Any of the `clientOptions` supported by the cassandra nodejs driver can be used. Possible options are documented in the [cassandra driver docs](http://docs.datastax.com/en/developer/nodejs-driver/3.3/api/type.ClientOptions/).


> ormOptions

If your keyspace doesn't exist it will be created automatically using the `defaultReplicationStrategy` provided here.

To know more about cassandra replication strategies read the [replication docs](http://docs.datastax.com/en/cassandra/3.0/cassandra/architecture/archDataDistributeReplication.html) and for available options for creating keyspace, read the [create keyspace docs](https://docs.datastax.com/en/cql/3.3/cql/cql_reference/cqlCreateKeyspace.html#cqlCreateKeyspace__description)

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

The keyspace is created automatically if it does not exist. If you don't want express-cassandra to create the keyspace for you then set `createKeyspace: false` in ormOptions. It will fire an error if no keyspace with the given name was found.

When express-cassandra syncs your model schema with cassandra, it creates a new table if the table does not exist already. If you don't want express-cassandra to create the new table for you, then set `createTable: false` in ormOptions. It will fire an error if no table with the given schema table name was found.


## Important Note on Migrations Support

Current support for migration is an experimental feature and should be set to `safe` for production environments. When set to `alter` or `drop` the ORM will try to take a conservative approach and will ask the user for confirmation when doing any data destructive operation. But as this feature is new and not yet stable, you might encounter some bugs or glitches here and there. Please report an issue in [github](https://github.com/masumsoft/express-cassandra/issues/) if you face any. The team will try their best to fix the problem within short time.


## Export/Import Fixture Data

You can dump all table data into json fixture files and reload them back into the tables later on. It's sometimes useful to take a snapshot of current data in your cassandra tables and later populate your database with that data when you're first setting up your app in a new cassandra instance. Also you may use this as a programmable backup system for your app data or whatever use case you can think of.

```js
// exports all table data in current keyspace to the
// directory: 'fixtures' inside current script directory
models.export(__dirname + '/fixtures', function(err){

});

// imports all table data to current keyspace from the
// directory: 'fixtures' inside current script directory
models.import(__dirname + '/fixtures', function(err){

});

// To improve import performance, you may use an optional
// parameter: batchSize to batch the imports in chunks of queries
models.import(__dirname + '/fixtures', { batchSize: 10 }, function(err){

});
```

## Connecting to Cassandra Using Authentication

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

If you are using datastax enterprise then please use the auth provider `DsePlainTextAuthProvider` from dse-driver instead.

## Let's Insert Some Data into PersonModel

```js

var john = new models.instance.Person({
    name: "John",
    surname: "Doe",
    age: 32,
    created: Date.now()
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

## Cassandra DB Functions Support

You can use cassandra provided db functions instead of providing a value for a field while inserting, updating or finding an object. For example, we could use the `$db_function` operator to get the current time for the `created` field while inserting data for John Doe into the model:

```js

var john = new models.instance.Person({
    name: "John",
    surname: "Doe",
    age: 32,
    created: { $db_function: 'toTimestamp(now())' }
});
john.save(function(err){
    if(err) {
        console.log(err);
        return;
    }
    console.log('Yuppiie!');
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
