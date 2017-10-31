# Elassandra Support (elassandra 5.5 or above)

## Configure Auto Index Management

If you are a user of [elassandra](https://github.com/strapdata/elassandra), then express-cassandra provides built in index management functionality for you. If enabled, express-cassandra will automatically create and manage an index with the same name as your keyspace and create type mapping for your tables accroding to an `es_index_mapping` defined in your table model schema. To enable auto index management, just set `manageESIndex: true` in the ormOptions like the following:

```
{
    clientOptions: {
        // omitted other options for clarity
    },
    ormOptions: {
        // omitted other options for clarity
        migration: 'alter',
        createKeyspace: true,
        manageESIndex: true,
    }
}
```

## Define Elasticsearch Mapping for a Table Schema:

To keep all your cassandra table fields synced into the elasticsearch index, use the `discover` option from elassandra like the following schema for an example `User` model:

```
// User model
module.exports = {
  fields: {
    id: 'varchar',
    name: 'text',
  },
  key: ['id'],
  es_index_mapping: {
    discover: '.*',
  }
};
```

By default, all text columns are mapped with `"index":"not_analyzed"`. To overwrite some properties, you could do the following:

```
// User model
module.exports = {
  fields: {
    id: 'varchar',
    name: 'text',
  },
  key: ['id'],
  es_index_mapping: {
    discover: '.*',
    properties: {
        "name" : {
            "type" : "string",
            "index" : "analyzed"
        }
    }
  }
};
```

Elassandra [mapping docs](http://elassandra.readthedocs.io/en/latest/mapping.html) contain details about possible mapping parameters and customizations that can be defined here.


## Sync the Model Mappings to Elassandra Index:

After all your model schema are synced to db, use the `models.syncESIndex()` function to sync all the elassandra indexes from your cassandra model schema definitions.

```
models.setDirectory( __dirname + '/models').bind(
    {
        clientOptions: {
            // omitted other options for clarity
        },
        ormOptions: {
            // omitted other options for clarity
            migration: 'alter',
            createKeyspace: true,
            manageESIndex: true,
        }
    },
    function(err) {
        if(err) throw err;

        models.syncESIndex(function (err){
            if(err) throw err;

            // now all the elassandra index mappings are created / synced
        });
    }
);
```

Make sure to call `syncESIndex` after all your models are loaded and synced to db, otherwise, you'll recieve errors.


## Search Elasticsearch Index Mapping for the Table:

You can now use the `get_es_client` function to get the elasticsearch client instance and do any operations that the [elasticsearch js client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) supports. For example you can search for a user by his name using elasticsearch client:

```
const esClient = models.instance.User.get_es_client();
esClient.search({
    index: models.instance.User.get_keyspace_name(),
    type: models.instance.User.get_table_name(),
    q: 'first_name:John',
}, (err, response) => {
    if (err) throw err;

    console.log(response);
});
```
