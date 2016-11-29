# Welcome to Express Cassandra

Express-Cassandra is an advanced Cassandra ORM for NodeJS. No more hassling with raw cql queries from your nodejs web frameworks. Express-Cassandra automatically loads your models and provides you with object oriented mapping to your cassandra tables like a standard ORM. It's framework independent nature allows you to use it with many popular nodejs frameworks with ease.

* supports the latest cassandra 3.x releases
* most of the bleeding edge cassandra features are supported
* compatible with datastax enterprise search and dse graph
* full featured CRUD operations and data type validations
* full support for collections and other advanced data types
* support for materialized views, secondary/custom/sasi indexes
* support for complex queries, streaming and token based pagination
* support for user defined types/functions/aggregates
* support for batching ORM operations for atomic updates
* support for before and after hook functions for save/update/delete
* built-in experimental support for automatic migrations
* built-in promise support with Async suffixed functions

This module uses datastax [dse-driver](https://github.com/datastax/nodejs-driver-dse) which is based on the official [cassandra-driver](https://github.com/datastax/nodejs-driver) for node. The dse driver is used so that both apache-cassandra and datastax enterprise users can use this module. Some of the base orm features are wrapper over a highly modified version of [apollo-cassandra](https://github.com/3logic/apollo-cassandra) module. The modifications made to the orm library was necessary to support missing features in the orm, keep it updated with the latest cassandra releases and to make it compatible with the advanced requirements of this module.
