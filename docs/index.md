# Overview

Express-Cassandra is a Cassandra ORM/ODM/OGM for NodeJS with Elassandra & JanusGraph Support.

No more hassling with raw cql queries from your nodejs web frameworks. Express-Cassandra automatically loads your models and provides you with object oriented mapping to your cassandra tables like a standard ORM/ODM. Built in support for [Elassandra](http://www.elassandra.io/) and [JanusGraph](http://janusgraph.org/) allows you to automatically manage synced elasticsearch and janusgraph indexes stored in cassandra.

Express-cassandra enables your nodejs app to manage a highly available distributed data store capable of handling large dataset with powerful query features powered by cassandra, elasticsearch and janusgraph combined. Express-cassandra empowers you to manage and query this truely distributed datastore with search, analytics and graph computing functionality from nodejs like you are just dealing with javascript objects and methods. Models are written as javascript modules and they automatically create the underlying db tables, indexes, materialized views, graphs etc. Afterwards you can save, update, delete and query your data using supported model methods. It's decoupled nature allows you to use it with many popular node frameworks without much hassle.

If you are using elassandra, then saved data in cassandra automatically syncs with elasticsearch indexes defined in your schema. You can then do any query [elasticsearch](https://www.elastic.co/products/elasticsearch) indexes support.

If you are using janusgraph, then you can easily manage your graphs and graph indexes. Creating vertices and edges become simple function calls. You can then do any graph query the tinkerpop3 [gremlin query language](http://docs.janusgraph.org/latest/gremlin.html) supports.

## Supported Features

* supports the latest cassandra 4.x and older stable 3.x releases
* support for elassandra index management and search queries
* support for janusgraph graph management and tinkerpop3 gremlin queries
* compatible with datastax enterprise solr search and dse graph
* full featured CRUD operations and data type validations
* full support for collections and other advanced data types
* support for materialized views, secondary/custom/sasi indexes
* support for complex queries, streaming and token based pagination
* support for user defined types/functions/aggregates
* support for batching ORM operations for atomic updates
* support for before and after hook functions for save/update/delete
* promise support with async suffixed functions
* built-in experimental support for automatic migrations
* built-in experimental support for fixture data import/export
* optional support for query debug and progress logs
* most of the bleeding edge cassandra features are supported

This module internally uses [cassandra-driver](https://github.com/datastax/nodejs-driver).

## Optional Preconfigured Elassandra+JanusGraph

Download the preconfigured [elassandra+janusgraph](https://www.dropbox.com/s/vebuzbdql0w6eap/elassandra_janusgraph_distribution.zip?dl=1) distribution for development convenience. This distribution contains the elassandra and janusgraph versions express-cassandra was tested in and contains mostly configuration changes. This distribution can also be used as a reference configuration for your own environment.
