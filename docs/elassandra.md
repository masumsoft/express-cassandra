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
        manageESIndex: true,
    }
}
```

Note that you can optionally provide connection options for elasticsearch in the clientOptions like the following. If omitted, then the cassandra `contactPoints` are used as default host addresses with `sniffOnStart: true` as default configuration for elasticsearch client.

```
{
    clientOptions: {
        // omitted other options for clarity
        elasticsearch: {
            host: 'http://localhost:9200',
            apiVersion: '5.5',
            sniffOnStart: true,
        }
    },
    ormOptions: {
        // omitted other options for clarity
        migration: 'alter',
        manageESIndex: true,
    }
}
```

Note that any config option [elasticsearch js client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/configuration.html) supports can be used in the above elasticsearch configuration block.

## Define Elasticsearch Mapping for a Table Schema:

To keep all your cassandra table fields synced into the elasticsearch index, use the `discover` option from elassandra like the following schema for an example `User` model:

```
// User model
module.exports = {
  fields: {
    id: 'varchar',
    name: 'text',
    score: 'int'
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
    score: 'int'
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


## Search Elasticsearch Index Mapping for the Table:

You can now use the `search` method to do an elasticsearch query like the following:

```
models.instance.User.search({
    q: 'name:John',
}, function(err, response) {
    if (err) throw err;

    console.log(response);
});
```

You could also use the optional `from` and `size` parameters to paginate, `sort` parameter to sort and provide the `body` parameter to use elasticsearch query dsl:

```
var pageNum = 2;
var perPage = 30;

models.instance.User.search({
    from: (pageNum - 1) * perPage,
    size: perPage,
    sort: ['score:desc'],
    body: {
        query: {
            match: {
                name: 'john'
            }
        }
    }
}, function(err, response) {
    if (err) throw err;

    console.log(response);
});
```

You could also use the `get_es_client` method to get the elasticsearch client instance and do any operations that the [elasticsearch js client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) supports. For example you could count the total number of users like the following:

```
const esClient = models.instance.User.get_es_client();
esClient.count({
    index: models.instance.User.get_keyspace_name(),
    type: models.instance.User.get_table_name(),
}, function(err, response) {
    if (err) throw err;

    console.log(response.count);
});
```
