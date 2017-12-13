# Schema Reference

```js

module.exports = {
    fields: {
        id: {
            type: "uuid",
            default: {"$db_function": "uuid()"}
        },
        name: { type: "varchar", default: "no name provided"},
        surname: { type: "varchar", default: "no surname provided"},
        complete_name: {
            type: "varchar",
            default: function() {
                return this.name + ' ' + this.surname;
            }
        },
        password_hash: "blob",
        age: "int",
        active: "boolean",
        created: {
            type: "timestamp",
            default: {"$db_function": "toTimestamp(now())"}
        }
    },
    key : [["id"],"created"],
    clustering_order: {"created": "desc"},
    materialized_views: {
        view_name1: {
            select: ["name","age"],
            key : ["age","created","id"],
        },
        view_name2: {
            select: ["name","age","active"],
            key : [["name", "id"],"created"],
            clustering_order: {"created": "desc"},
            filters: {
                created: { $gte: new Date('2017-10-10') },
                age: { $isnt: null },
            },
        }
    },
    indexes: ["name"],
    custom_indexes: [
        {
            on: 'complete_name',
            using: 'org.apache.cassandra.index.sasi.SASIIndex',
            options: {}
        }
    ],
    table_name: "my_custom_table_name",
    methods: {
        setPassword: function (password, callback) {
          crypto.pbkdf2Sync('secret', 'salt', 100000, 512, 'sha512', function(err, hashed) {
            if (err) { return callback(err); }
            this.password_hash = hashed;
            return callback();
          });
        }
    },
    options: {
        timestamps: {
            createdAt: 'created_at', // defaults to createdAt
            updatedAt: 'updated_at' // defaults to updatedAt
        },
        versions: {
            key: '__v' // defaults to __v
        }
    },
}

```

What does the above code mean?

- `fields` are the columns of your table. For each column name the value can be a string representing the type or an object containing more specific informations. i.e.
    + ` "id"     : { "type": "uuid", "default": {"$db_function": "uuid()"} },` in this example id type is `uuid` and the default value is a cassandra function (so it will be executed from the database).
    + `"name"   : { "type": "varchar", "default": "no name provided"},` in this case name is a varchar and, if no value will be provided, it will have a default value of `no name provided`. The same goes for `surname`.
    + `complete_name` the default values is calculated from others field. When the orm processes your model instances, the `complete_name` will be the result of the function you defined. In the function `this` is bound to the current model instance. If you need to use the custom datatypes, you may use the `this.get_data_types()` function that will be similar to using [models.datatypes](#cassandra-to-javascript-datatypes) but the difference is, it can be used from within a model definition. For example to return a Long value from a default function, you could use the `this.get_data_types().Long` class.
    + `age` no default is provided and we could write it just as `age: "int"`.
    + `active` no default is provided and we could write it just as `active: "boolean"`.
    + `created`, like uuid(), will be evaluated from cassandra using the `now()` function.

- `key`: here is where you define the primary key of your table. As you can imagine, the array defines a `compound primary key` and the first value of the array is the `partition key` and the others are the `clustering keys`. The `partition key` itself can be an array with multiple fields. When a partition key is an array of multiple fields, it is called a `composite` partition key.

    > The partition key is the key field by which cassandra distributes it's data into multiple machines. So when querying cassandra, in most cases you need to provide the partition key, so cassandra knows which machines or partitions contains the data you are looking for.

    > The clustering keys are used to keep the data sorted according to the field values of those keys in a partition. So that after getting into a partition, cassandra can find the required data under those partitions very quickly. As the data is sorted according to those keys, cassandra can efficiently seek to find the data it needs.

    > Understanding the primary key parts is a crucial concept to cassandra data modeling. To get a detailed idea about them, read the cassandra documentation. For your convenience, following are some links to the relevant documentation pages:

    > Read more about composite keys on the [composite key doc](http://docs.datastax.com/en/cql/3.3/cql/cql_using/useCompositePartitionKeyConcept.html)

    > Read more about the compound key here on the [compound key documentation](http://docs.datastax.com/en/cql/3.3/cql/cql_using/useCompoundPrimaryKeyConcept.html)

- `clustering_order`: here you can define the clustering order of the clustering keys. If order is not defined, default value of ASC (ascending) is used.

- `materialized_views` provides you the ability to define cassandra 3.x materialized views for your model table. You may want to read more about it on the [materialized view documentation](http://docs.datastax.com/en/cql/3.3/cql/cql_using/useCreateMV.html). This is generally suited for querying high cardinality fields. If you need to use select * for the materialized view, you can also use `select: ['*']`. You can also define filters for the data that should be inserted into the materialized view. Only the rows that passes the filter criteria will be available in the materialized view. Note that filters are supported in cassandra 3.10+ only.

- `indexes` are the index of your table. It's always an array of field names. You can read more on the [index documentation](http://docs.datastax.com/en/cql/3.3/cql/cql_using/usePrimaryIndex.html). This is generally suited for querying low cardinality fields, but not as low as boolean fields or fields with very limited number of variants. Very low cardinality fields are not a good separator of large datasets and hence not worthwhile to index.

- `custom_indexes` is an array of objects defining the custom indexes for the table. The `on` section should contain the column name on which the index should be built, the `using` section should contain the custom indexer class path and the `options` section should contain the passed options for the indexer class if any. If no `options` are required, pass a blank {} object.

- `table_name` provides the ability to use a different name for the actual table in cassandra. By default the lowercased modelname is used as the table name. But if you want a different table name instead, then you may want to use this optional field to specify the custom name for your cassandra table.

- `methods` allows you to define custom methods for your instances. This can be useful when a single model method should act on various fields and therefore cannot be mapped to a virtual field, or when an asynchronous operation is required for reading or updating a field, such as hashing a password or retrieving related data against a database.

- `options` allows you to tell express-cassandra to automatically manage timestamp and version information in your data.

> The `timestamps` option if set assigns createdAt and updatedAt fields to your schema and the assigned type is timestamp. Whenever a new document is saved for the schema the createdAt and updatedAt is set automatically to the current timestamp. All save or update operations on the document afterwards will update the updatedAt field automatically. By default, the name of two fields are createdAt and updatedAt, but you can customize the field names by setting timestamps.createdAt and timestamps.updatedAt attributes.

> The `versions` option if set assigns a version field to your schema and the assigned type is a timeuuid. It automatically saves a unique timeuuid each time the document is saved or updated. By default the name of the field will be __v, but you can customize the field name by setting the versions.key attribute.

When you instantiate a model, every field you defined in schema is automatically a property of your instances. So, you can write:

```js

john.age = 25;
console.log(john.name); //John
console.log(john.complete_name); // undefined.

```
__note__: `john.complete_name` is undefined in the newly created instance but will be populated when the instance is saved because it has a default value in schema definition

Ok, we are done with John, let's delete him:

```js

john.delete(function(err){
    //...
});

```
