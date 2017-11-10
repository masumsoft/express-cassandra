# JanusGraph Support (janusgraph 0.2.0 or above)

## Configure Auto Graph Management

If you are a user of [janusgraph](http://janusgraph.org/) - a distributed graph database supporting cassandra as backend, then express-cassandra provides built in graph management functionality for you. If enabled, express-cassandra will automatically create and manage a graph with the name as your keyspace name appended with the word graph `keyspacename_graph`. Express-cassandra will create graph relations and graph indexes for your tables accroding to a `graph_mapping` defined in your model schema. Also you can use tinkerpop3 gremlin queries to traverse your graph using built in model methods. To enable automatic graph management, just set `manageGraphs: true` in the ormOptions like the following:

```
{
    clientOptions: {
        // omitted other options for clarity
    },
    ormOptions: {
        // omitted other options for clarity
        migration: 'alter',
        manageGraphs: true,
    }
}
```

Note that janusgraph must be configured to run `Gremlin Server with ConfigurationManagementGraph` setting. Otherwise express-cassandra cannot manage the graph for you. Download the pre-configured [elassandra+janusgraph](https://www.dropbox.com/s/vebuzbdql0w6eap/elassandra_janusgraph_distribution.zip?dl=1) setup for a working configuration.

You can optionally provide connection options for gremlin server in the clientOptions like the following. If omitted, then the cassandra `contactPoints` first host will be used as default host address with `port: 8182` as default configuration for gremlin client.

```
{
    clientOptions: {
        // omitted other options for clarity
        gremlin: {
            host: 'localhost',
            port: 8182,
            options: {
                user: '...',
                password: '...',
            },
        },
    },
    ormOptions: {
        // omitted other options for clarity
        migration: 'alter',
        manageGraphs: true,
    }
}
```

Note that any config option [gremlin client](https://www.npmjs.com/package/gremlin#creating-a-new-client) supports can be used in the above gremlin configuration block.

## Define JanusGraph Mapping for a Table Schema:

To create a graph mapping for your schema, use the `graph_mapping` option from janusgraph like the following schema for an example `User` model:

```
// User model
module.exports = {
  fields: {
    id: 'int',
    name: 'text',
    age: 'int'
  },
  key: ['id'],
  graph_mapping: {
    relations: {
      follow: 'MULTI',
      mother: 'MANY2ONE',
    },
    properties: {
      userId: {
        type: 'Integer',
        cardinality: 'SINGLE',
      },
      name: {
        type: 'String',
        cardinality: 'SINGLE',
      },
      age: {
        type: 'Integer',
        cardinality: 'SINGLE',
      },
      followedAt: {
        type: 'Long',
        cardinality: 'SINGLE',
      },
    },
    indexes: {
      byUserIdComposite: {
        type: 'Composite',
        keys: ['userId'],
        unique: true,
      },
      byNameComposite: {
        type: 'Composite',
        keys: ['name'],
      },
      byNameAgeComposite: {
        type: 'Composite',
        keys: ['name', 'age'],
      },
      byUserIdNameAgeMixed: {
        type: 'Mixed',
        keys: ['userId', 'name', 'age'],
      },
      byFollowedAtVertexCentric: {
        type: 'VertexCentric',
        keys: ['followedAt'],
        label: 'follow',
        direction: 'BOTH',
        order: 'decr',
      },
    },
  },
};
```

- `relations` defines the edge relations in your graph. For example, here two relations named `follow` and `mother` are defined with their `multiplicity` values. For details on what they mean, visit the [janusgraph schema and data modeling](http://docs.janusgraph.org/latest/schema.html) docs.

- `properties` defines the vertex/edge property keys with their janusgraph type and cardinality. Here we have defined userId, name and age properties for our vertices and followedAt property for our follow edge relation. Visit the [janusgraph schema and data modeling](http://docs.janusgraph.org/latest/schema.html) docs for details of these concepts.

- `indexes` defines the graph indexes for improving performance of your graph queries. Here we have defined the index names with the index properties for each of them. For details about index properties, visit the [janusgraph indexing docs](http://docs.janusgraph.org/latest/indexes.html). Following is a brief description for the index properties that can be used:

    - `type` defines the index type. Possible values are `Composite`, `Mixed` or `VertexCentric`.

    - `keys` defines an array of the property keys to index. Must be a valid property key defined in properties.

    - `unique` defines an optional boolean to enable unique contraint for the index. Here `userId` is defined to be unique.

    - `label` defines the edge label for VertexCentric (Edge) indexes. Here the `follow` edge relation is defined as the label.

    - `direction` defines the edge direction for which to create the VertexCentric index. Possible values are `BOTH`, `IN` and `OUT`.

    - `order` defines the sort order of the VertexCentric index. Possible values are `incr` or `decr`.

By default all indexes are label contrained to the schema table name, that means the indexes are always bound to the vertices and edges defined by the current model schema.

## Create vertex:

To create a vertex use the createVertex method with the property values like the following:

```
models.instance.User.createVertex({ userId: 1234, name: 'john', age: 32 }, function(err, response) {
    if (err) throw err;

    // response contains the created vertex object
    // response.id contains vertex id
    // response.properties contains it's properties
    console.log(response);
});
```

Note that the createVertex method creates a labeled vertex with the table name of your model schema by default. So the above operation creates an user labeled vertex.

## Get vertex:

To get a vertex use the getVertex method with the vertex id like the following:

```
models.instance.User.getVertex(vertex.id, function(err, response) {
    if (err) throw err;

    // response contains the vertex object with the vertex id
    console.log(response);
});
```

## Update vertex:

To update a vertex use the updateVertex method with the vertex id and updated values object like the following:

```
models.instance.User.updateVertex(vertex.id, { age: 33 }, function(err, response) {
    if (err) throw err;

    // response contains the updated vertex object
    console.log(response);
});
```

## Delete vertex:

To delete a vertex use the deleteVertex method with the id of the vertex to be deleted:

```
models.instance.User.deleteVertex(vertex.id, function(err) {
    if (err) throw err;
});
```

## Create edge (relation between vertices):

To create an edge relation between two vertices use the createEdge method with the relation_name, from_vertex_id and to_vertex_id along with an optional properties object for defining edge properties.

For example, to create a follow relation between two user vertices with a followedAt property:

```
models.instance.User.createEdge('follow', followerVertex.id, followeeVertex.id, { followedAt: Date.now() }, function(err, response) {
    if (err) throw err;

    // response contains the created edge object
    // response.id contains edge id
    // response.properties contains it's properties
    console.log(response);
});
```

Another example could be creating a mother edge from one user to another. Note that we can skip the properties for the edge in this case:

```
models.instance.User.createEdge('mother', childVertex.id, motherVertex.id, function(err, response) {
    if (err) throw err;
});
```

## Get edge:

To get an edge use the getEdge method with the edge id like the following:

```
models.instance.User.getEdge(edge.id, function(err, response) {
    if (err) throw err;

    // response contains the edge object with the edge id
    console.log(response);
});
```

## Update edge:

To update an edge property, use the updateEdge method with the updated properties object:

```
models.instance.User.updateEdge(edge.id, { followedAt: Date.now() }, function(err, response) {
    if (err) throw err;

    // response contains the updated edge object
    console.log(response);
});
```

## Delete edge:

To delete an edge relation, use the deleteEdge method with the id of the edge to be deleted:

```
models.instance.User.deleteEdge(edge.id, function(err) {
    if (err) throw err;
});
```

## Traversing graph using gremlin queries:

After creating some vertices and edges you can search/traverse your graph using [gremlin queries](http://docs.janusgraph.org/latest/gremlin.html). You need to use the `graphQuery(gremlin_query, params, callback)` method to do that.

For example for the above user graph, you can now query to find the followers of the user named john:

```
models.instance.User.graphQuery('vertices.has("name", name).in("follow")', { name: 'john' }, function(err, response){
    if (err) throw err;

    // response contains an array of vertices containing the followers of john
    console.log(response);
});
```

Note that graphQuery function takes a gremlin query as the first parameter. The second parameter defines the value of a variable inside the gremlin query. In this case `name` is a variable defined inside the gremlin query and you have provided the value of the variable in the params object.


### Default global variables for gremlin queries
You will get some default variables already defined for you while using the `graphQuery` method. The variables `graph`, `g` and `vertices` are defined globally for you. These variables represent the following gremlin queries:

```
graph = ConfiguredGraphFactory.open(__graphName);
g = graph.traversal();
vertices = g.V().hasLabel(__vertexLabel);
```

- `graph` variable contains the opened graph instance. By default __graphName contains the graph name (your keyspace name + '_graph') managed by express-cassandra.

- `g` variable contains the gremlin traversal root.

- `vertices` variable contains the vertices created using the current model instance. By default __vertexLabel contains the table name for your model schema. For example if you call `models.instance.User.graphQuery` then vertices variable will contain only the user labeled vertices created by `models.instance.User.createVertex`.


### Querying the whole graph

For the previous query, our search was bounded to only the user labeled vertices, because we were using the vertices variable. Let us do another gremlin query to find all the vertices with a particular name be it a user name or the name of another schema label. Say we also have a company schema with a name property in company vertices. So to find all the companies and users with a particular name in the whole graph:

```
models.instance.User.graphQuery('g.V().has("name", name)', { name: 'myname' }, function(err, response){
    if (err) throw err;

    // response contains an array of vertices containing the name toyota
    console.log(response);
});
```


## Using the raw gremlin client
You could also use the `get_gremlin_client` method to get the gremlin client instance and do any operation that the [node gremlin module](https://www.npmjs.com/package/gremlin) supports:

```
const gemlintClient = models.instance.User.get_gremlin_client();
gemlintClient.execute('g.V().has("name", name)', { name: 'john' }, function(err, results) {
  if (err) {
    return console.error(err)
  }

  console.log(results);
});
```
