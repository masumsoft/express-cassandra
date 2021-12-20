[![Build Status](https://app.travis-ci.com/masumsoft/express-cassandra.svg?branch=master)](https://app.travis-ci.com/masumsoft/express-cassandra)
[![Download Stats](https://img.shields.io/npm/dm/express-cassandra.svg)](https://www.npmjs.com/package/express-cassandra)
[![Npm Version](https://badge.fury.io/js/express-cassandra.svg)](https://www.npmjs.com/package/express-cassandra)
[![Documentation Status](https://readthedocs.org/projects/express-cassandra/badge/?version=latest)](http://express-cassandra.readthedocs.io/en/latest/?badge=latest)
[![Dependency Status](https://img.shields.io/librariesio/github/masumsoft/express-cassandra)](https://github.com/masumsoft/express-cassandra/network/dependencies)
[![Mentioned in Awesome Cassandra](https://awesome.re/mentioned-badge.svg)](https://anant.github.io/awesome-cassandra/)

# Overview

Express-Cassandra is a Cassandra ORM/ODM/OGM for NodeJS with Elassandra & JanusGraph Support.

No more hassling with raw cql queries from your nodejs web frameworks. Express-Cassandra automatically loads your models and provides you with object oriented mapping to your cassandra tables like a standard ORM/ODM. Built in support for [Elassandra](http://www.elassandra.io/) and [JanusGraph](http://janusgraph.org/) allows you to automatically manage synced elasticsearch and janusgraph indexes stored in cassandra.

Express-cassandra enables your nodejs app to manage a highly available distributed data store capable of handling large dataset with powerful query features powered by cassandra, elasticsearch and janusgraph combined. Express-cassandra empowers you to manage and query this truely distributed datastore with search, analytics and graph computing functionality from nodejs like you are just dealing with javascript objects and methods. Models are written as javascript modules and they automatically create the underlying db tables, indexes, materialized views, graphs etc. Afterwards you can save, update, delete and query your data using supported model methods. It's decoupled nature allows you to use it with many popular node frameworks without much hassle.

If you are using elassandra, then saved data in cassandra automatically syncs with elasticsearch indexes defined in your schema. You can then do any query [elasticsearch](https://www.elastic.co/products/elasticsearch) indexes support.

If you are using janusgraph, then you can easily manage your graphs and graph indexes. Creating vertices and edges become simple function calls. You can then do any graph query the tinkerpop3 [gremlin query language](http://docs.janusgraph.org/latest/gremlin.html) supports.

## Our Sponsors: ##
<table><tr>
<td align="center" width="300" ><a href="https://astra.dev/3shh4EF"><img src="https://www.datastax.com/sites/default/files/2021-07/astra-negative-square.png" width="90" height="90" alt="Astra DB" /><br />Astra DB</a><br/>Use Node/Express with DataStax Astra DB - built on Apache Cassandra.</td>
</tr></table>

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

# Installation

For apache cassandra version 4.x, 3.x or datastax enterprise

    npm install express-cassandra

For elassandra version 5.5.x

    npm install express-cassandra elasticsearch

For janusgraph version 0.2.x

    npm install express-cassandra gremlin@2.6.0

For older cassandra 2.x (no longer supported)

    npm install express-cassandra@0.5.4

Please note that if you use the legacy cassandra 2.x compliant version then please use the corresponding README.md file for that version. The following documentation is for version 4.x, 3.x and datastax enterprise 6.x/5.x only. The materialized view support and several other part of the documentation is strictly applicable for cassandra 4.x/3.x or dse 6.x/5.x and will not work in earlier versions of cassandra.

# Documentation

Read the full usage documentation in the [express-cassandra documentation](http://express-cassandra.readthedocs.io) site.

# Changelog

A detailed changelog for released versions are available in the [changelog](./CHANGELOG.md) section.

# Contributing

All contributions, bug reports, bug fixes, documentation improvements, enhancements and ideas are welcome.

A detailed overview on how to contribute can be found in the [contributing guide](./CONTRIBUTING.md).

# Acknowledgement

* Express-cassandra started off from a highly modified version of [apollo-cassandra](https://github.com/3logic/apollo-cassandra) module. Afterwards major refactoring and new development went on to support missing features of cassandra 3.x and beyond with support for additional functionalities.

* Apache Cassandra, Apache Lucene, Apache, Lucene, Solr, TinkerPop, and Cassandra are trademarks of the Apache Software Foundation or its subsidiaries in Canada, the United States and/or other countries.

* DataStax, Titan, and TitanDB are registered trademark of DataStax, Inc. and its subsidiaries in the United States and/or other countries.

* Elasticsearch and Kibana are trademarks of Elasticsearch BV, registered in the U.S. and in other countries.

* Elassandra is a trademark of Strapdata SAS.

* JanusGraph is a trademark of The Linux Foundation.
