[![Build Status](https://travis-ci.org/masumsoft/express-cassandra.svg)](https://travis-ci.org/masumsoft/express-cassandra)
[![Download Stats](https://img.shields.io/npm/dm/express-cassandra.svg)](https://www.npmjs.com/package/express-cassandra)
[![Npm Version](https://badge.fury.io/js/express-cassandra.svg)](https://www.npmjs.com/package/express-cassandra)
[![Documentation Status](https://readthedocs.org/projects/express-cassandra/badge/?version=latest)](http://express-cassandra.readthedocs.io/en/latest/?badge=latest)
[![Dependency Status](https://www.versioneye.com/nodejs/express-cassandra/badge?style=flat-square)](https://www.versioneye.com/nodejs/express-cassandra/)

# Overview

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

This module uses datastax [cassandra-driver](https://github.com/datastax/nodejs-driver) by default or uses the [dse-driver](https://github.com/datastax/nodejs-driver-dse) if already installed.

If you are using apache cassandra, then the module should work just fine. Datastax enterprise users can use this module, but needs to install the dse-driver separately in your app.

Some of the base orm features are wrapper over a highly modified version of [apollo-cassandra](https://github.com/3logic/apollo-cassandra) module. The modifications made to the orm library was necessary to support missing features in the orm, keep it updated with the latest cassandra releases and to make it compatible with the advanced requirements of this module.

# Installation

For apache cassandra version 3.x

    npm install express-cassandra

For datastax enterprise version 5.x

    npm install express-cassandra dse-driver

For older cassandra 2.x

    npm install express-cassandra@0.5.4

Please note that if you use the legacy cassandra 2.x compliant version then please use the corresponding README.md file for that version. The following documentation is for version 3.x and datastax enterprise 5.x only. The materialized view support and several other part of the documentation is strictly applicable for cassandra 3.x / dse 5.x and will not work in earlier versions of cassandra.

# Documentation

Read the full [ORM Documentation](http://express-cassandra.readthedocs.io)
