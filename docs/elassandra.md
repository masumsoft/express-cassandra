# Elassandra Support (elassandra 5.5.x)

## Configure Auto Index Management

If you are a user of [elassandra](https://github.com/strapdata/elassandra), then express-cassandra provides built in index management functionality for you. If enabled, express-cassandra will automatically create and manage an index with the same name as your keyspace and create type mapping for your tables according to an `es_index_mapping` defined in your table model schema. To enable auto index management, make sure to use the `NetworkTopologyStrategy` as the replication strategy and set `manageESIndex: true` in the `ormOptions` like the following:

```
{
    clientOptions: {
        // omitted other options for clarity
    },
    ormOptions: {
        // omitted other options for clarity
        defaultReplicationStrategy: {
            class: 'NetworkTopologyStrategy',
            datacenter1: 1
        },
	migration: 'alter',
        manageESIndex: true
    }
}
```

Elassandra does not work with the `SimpleStrategy` replication class. You can still have a single Elassandra node. The `datacenter1` parameter is the **case sensitive** name of the _Data Center_ as defined in your `elassandra/conf/cassandra-rackdc.properties` file. You may also have to edit your `elassandra/conf/cassandra-topology.properties` file to match the rack data center declarations. If you did not edit those files, the default is `datacenter1`. These parameters are used with the [CREATE KEYSPACE](https://docs.datastax.com/en/cql/3.3/cql/cql_reference/cqlCreateKeyspace.html) CQL command.

Note that you can optionally provide connection options for elasticsearch in the `clientOptions` like the following. If omitted, then the cassandra `contactPoints` are used as default host addresses with `sniffOnStart: true` as default configuration for the elasticsearch client.

```
{
    clientOptions: {
        // omitted other options for clarity
        elasticsearch: {
            host: 'http://localhost:9200',
            apiVersion: '5.5',
            sniffOnStart: true
        }
    },
    ormOptions: {
        // omitted other options for clarity
        defaultReplicationStrategy: {
            class: 'NetworkTopologyStrategy',
            datacenter1: 1
        },
        migration: 'alter',
        manageESIndex: true
    }
}
```

Note that any config option [elasticsearch js client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/configuration.html) supports can be used in the above elasticsearch configuration block.

## Define Elasticsearch Mapping for a Table Schema:

To keep all your cassandra table fields synced into the elasticsearch index, use the `discover` option from elassandra like the following schema for an example `User` model:

```
// User model
export default {
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
export default {
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
    q: 'name:John'
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

You could also use the `get_es_client()` method to get the elasticsearch client instance and do any operations that the [elasticsearch js client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) supports. For example you could count the total number of users like the following:

```
const esClient = models.instance.User.get_es_client();
const modelKeyspaceName = models.instance.MultipleOrderBy.get_keyspace_name();
const modelTableName = models.instance.User.get_table_name();
const modelIndexName = modelKeyspaceName + '_' + modelTableName;

esClient.count({
    index: modelIndexName,
    type: modelTableName
}, function(err, response) {
    if (err) throw err;

    console.log(response.count);
});
```
