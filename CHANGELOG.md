# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.8.0] - 2022-03-12

### Added
- Option to disable built-in type validation

### Fixed
- Avoid mutating passed options objects

### Security
- Upgraded package dependencies to resolve vulnerability in dependent packages

## [2.7.0] - 2021-12-20

### Added
- Support confirmation for cassandra 4.x
- Support for ES6 based model definition
- Node 14 now officially supported

### Changed
- Removed support for Node version 6

### Security
- Upgraded package dependencies to resolve vulnerability in dependent packages

## [2.6.0] - 2021-04-16

### Changed
- Upgrade cassandra-driver from 3.3 to 4.6 - [driver upgrade guide](https://docs.datastax.com/en/developer/nodejs-driver/4.6/upgrade-guide/)

### Fixed
- Allow filtering error in cloud cassandra deployments

## [2.5.0] - 2020-10-08

### Added
- Added support for per partition limit operator

### Security
- Upgraded package dependencies to resolve vulnerability in a dependent package

## [2.4.0] - 2020-07-27

### Changed
- Allow additional control in janusgraph configuration

### Fixed
- Unset primary key error thrown for non primary keys when key is a substring of the primary key

### Security
- Upgraded package dependencies to resolve vulnerability in a dependent package

## [2.3.2] - 2019-09-20

### Fixed
- schema mismatch for materialized views with multiple filters
- generated query clauses contained extra spaces

## [2.3.1] - 2019-09-20

### Fixed
- ttl queries were not prepared properly

### Security
- Upgraded package dependencies to resolve vulnerability

## [2.3.0] - 2018-12-29
### Added
- Support for group by queries

### Fixed
- Improved error message to contain which field has an invalid type
- Improved documentation with usage example of NetworkTopologyStrategy

## [2.2.4] - 2018-10-04
### Fixed
- Field type validation message display undefined value when invalid type is used

### Security
- Upgraded locked package dependencies to resolve vulnerability in a dependent package

## [2.2.3] - 2018-07-10
### Fixed
- Auto timestamp and version fields are not working properly if used in index and materialized views

## [2.2.2] - 2018-06-17
### Fixed
- UDF and UDA with multiple parameters not parsed correctly and behaves like select *
- Virtual fields that set value of another field does not work while creating model instance

## [2.2.1] - 2018-06-17
### Fixed
- Frozen set collections that uses UDTs are not normalized properly and throws schemamismatch error

## [2.2.0] - 2018-02-03
### Changed
- Separate index per table for elassandra instead of a single index for the whole keyspace. This fixes conflicts where the same fieldname with different datatypes exists in different tables. The index names are now of the format: keyspaceName_tableName

## [2.1.1] - 2018-01-05
### Fixed
- Reserved keywords not quoted in materialized view where query
- Some query options were missing in options normalizer

## [2.1.0] - 2017-12-13
### Added
- Support for materialized view filters added in cassandra 3.10.

### Changed
- SyncDB callback now informs whether any db schema was updated. It returns true if any db schema was updated and false if no schema change was detected.

### Fixed
- Unexpected pause behaviour in fixture import json streamer

## [2.0.0] - 2017-11-10
### Breaking
- Hooks api has some major changes about how it works. Hooks are no longer asynchronous functions. Instead of callback based error or success to control the corresponding operation, it now requires to return true or false instead. This API change helped us to eliminate some major issues related to hooks and hope to prevent future inconsistencies with it.
- Custom schema load and sync has been decoupled and the api changed significantly for good. You can now load the schema and syncDB seperately. You have complete control over loading a schema instance and syncing the schema with cassandra. Also calling the init function is now optional.

### Added
- Support for automatic elasticsearch index management and search analytics for Elassandra users
- Support for automatic graph management and gremlin graph traversals for JanusGraph users
- Support for auto timestamp and versioning fields. This enables automatic creation and management of versionKey, createdAt and updatedAt fields in cassandra against a schema
- Support for export/import of data from cassandra to fixture json files
- Added get_table_name function for model instances
- Added docs and tests for db_function support

### Changed
- Signifant performance improvement in ORM batches and importer
- Major refactoring to organise the codebase to keep it maintainable.
- Upgraded eslint to version 4
- try-catch instead of try-require for optional modules
- createTable, createKeyspace are now optional and defaults to true

### Fixed
- Buggy alter logic for materialized views, fixes migration hang issues
- Unable to query indexed map with multiple entries
- CamelCased frozen typeDef for UDT incorrectly detect schema mismatch


## [1.10.0] - 2017-09-06
### Changed
- Removing dse-driver due to license issues. Datastax enterprise users now need to install dse-driver along with express-cassandra to work with datastax enterprise. The dse-driver will be used by express-cassandra if present, otherwise it will fallback to the default cassandra-driver.

### Fixed
- Altering/adding field to UDT fails if out of order

## [1.9.1] - 2017-08-28
### Fixed
- Patch to support working with tables containing elassandra indexes

## [1.9.0] - 2017-06-11
### Added
- Support for query operators for light weight transactions
- Doc to clarify usage of connection policies

## [1.8.3] - 2017-04-28
### Fixed
- Order by does not work for multiple clustering columns with different order

## [1.8.2] - 2017-04-21
### Added
- Support for nested directory models

### Fixed
- Semantic versioning issue with dse-driver, uses wrong protocol version

## [1.8.1] - 2017-04-15
### Fixed
- isModified not working properly for some corner cases

## [1.8.0] - 2017-04-11
### Added
- Support for custom model instance methods
- Support for isModified model instance method

## [1.7.5] - 2017-03-02
### Fixed
- Hook functions are not called on orm batch

## [1.7.4] - 2017-02-21
### Fixed
- All clients are not properly shutdown on close

## [1.7.2] - 2017-01-17
### Added
- Truncate table support for cassandra

## [1.7.1] - 2017-01-16
### Added
- Codeclimate for improving coding standards

### Changed
- Default prepare for prototype batch
- Safer arguments handling in the prototype.doBatch
- Updating eslint and fixing new code linting errors

## [1.7.0] - 2016-12-26
### Added
- Multiple validator support in schema
- Error message reference in docs

## [1.6.5] - 2016-12-22
### Changed
- Making rule validator function optional

### Fixed
- Required fields without a validator is not allowed

## [1.6.4] - 2016-12-22
### Fixed
- Default options are completely overwritten by user provided options in batch query

## [1.6.3] - 2016-12-22
### Changed
- Validate query_segment instead of parameter

### Fixed
- Empty strings with $in clause throwing errors

## [1.6.2] - 2016-12-03
### Fixed
- Ignoring dse solr_query index to fix model sync

## [1.6.1] - 2016-11-30
### Fixed
- Resolved loadSchema callback and promise issue

## [1.6.0] - 2016-11-30
### Added
- Support for builtin promises in all APIs

## [1.5.0] - 2016-11-26
### Added
- Support for solr_query and index expression
- Support for datastax enterprise cassandra

## Changed
- Upgraded to cassandra driver 3.1.6
- Upgraded travis build cassandra to 3.9

### Fixed
- Proper handling of batches having less than 2 queries
- Counter update doc with datatype conversions

## [1.4.2] - 2016-09-28
### Fixed
- Handling typeof null values properly
- Doc confusions regarding null and unset

## [1.4.1] - 2016-09-05
### Changed
- Upgraded to cassandra driver 3.1.3

## [1.4.0] - 2016-09-04
### Added
- Support for hook functions before and after save, update, delete operations
- Option for disabling tty confirmation on migrations

## [1.3.3] - 2016-09-02
### Fixed
- Camel cased udts not handled properly

## [1.3.2] - 2016-08-29
### Fixed
- Whitelist file extensions for modelsync

## [1.3.1] - 2016-08-29
### Fixed
- Streaming queries ignore materialized_view option
- Nodejs 4.x error for missing babel-register module

## [1.3.0] - 2016-08-27
### Added
- Implemented require validator for schema rules
- Tests for utility functions and require validator

### Changed
- Major refactoring to es2015 with eslint and babel
- Refactored utility functions seperating concerns

## [1.2.1] - 2016-08-12
### Changed
- Improving docs with readthedocs build

## [1.2.0] - 2016-08-11
### Added
- Migrations support without fixture (Experimental)

### Changed
- Refactor using strict mode for all js files
- Typo in variable name on uda errors

## [1.1.2] - 2016-07-30
### Fixed
- Tablename issue in alternate model loader

## [1.1.1] - 2016-07-25
### Changed
- Doc updates for custom sasi indexes
- Doc reorganization and $like query clarifications

## [1.1.0] - 2016-07-25
### Added
- Support for sasi and multiple custom indexes

### Changed
- Doc update Long datatype reference link

## [1.0.3] - 2016-06-28
### Added
- Implemented 'toJSON' model instance method

## [1.0.2] - 2016-06-23
### Changed
- Making datatypes accessible from within model definitions

## [1.0.1] - 2016-05-24
### Changed
- Doc update for connecting to cassandra using authProvider

## [1.0.0] - 2016-05-17
### Breaking
- Consistent data types validation. All datatypes are now cassandra-driver compliant. Such as bigint, counter, uuid etc now use Long, UUID etc classes exposed by the cassandra-driver. Dealing with non javascript compatible datatypes from cassandra now follows the cassandra-driver datatype conversion standards.

### Added
- Support for frozen keyword and tuple data type
- Support for User defined types, functions and aggregates
- Support for streaming queries
- Support for cassandra shared static columns
- Support for $prepend and $replace operators for collections
- Support for querying indexed collections
- Support for altering keyspace replication

## [0.8.2] - 2016-05-07
### Added
- Support for cassandra authProvider option
- Support for all cassandra-driver connection options

## [0.8.1] - 2016-04-26
### Added
- Support for select * in materialized views
- Support for test coverage

## [0.8.0] - 2016-04-17
### Added
- Support for composite data types add/remove element

### Changed
- Using database limit for findOne queries

## [0.7.2] - 2016-04-05
### Fixed
- Instance delete for composite partition keys not working

## [0.7.1] - 2016-04-03
### Added
- Support for index expressions in find query

### Fixed
- Resolved models.doBatch error when using options

## [0.7.0] - 2016-03-25
### Changed
- Consistent datatypes handling using nodejs driver params

## [0.6.4] - 2016-03-08
### Changed
- Clarifying custom index documentation
- Updated doc for token with composite keys

### Fixed
- Token operator fix for composite partition keys

## [0.6.3] - 2016-03-02
### Added
- Support for async custom model loading
- Support for multiple orm connections

## [0.6.1] - 2016-02-22
### Added
- Support for aggregate functions

## [0.6.0] - 2016-02-17
### Added
- Support for cassandra 3.x
- Support for materialized views

## [0.5.4] - 2016-01-05
### Fixed
- Long types in where clause throws invalidop error

## [0.5.3] - 2015-12-22
### Added
- Support for maxTimeuuid & minTimeuuid in timeuuid generator

### Changed
- Refactored error messages to be more specific

## [0.5.2] - 2015-12-12
### Added
- Support for clustering order in primary key definition
- Support for SELECT DISTINCT through options
- Option for avoiding keyspace creation

### Fixed
- Uppercase keyspace names not handled properly

## [0.5.1] - 2015-12-03
### Fixed
- Table not synced for map typeDef changes
- DB value expression for timestamp columns not consistent
- Counter columns type handling not consistent
- Default value for composite types throws errors

## [0.5.0] - 2015-11-21
### Added
- Support for ORM batch operations

## [0.4.12] - 2015-11-21
### Fixed
- Instance delete query escaped twice

## [0.4.11] - 2015-11-21
### Added
- Support for uuid and timeuuid types in where query
- Added test cases for uuid types

## [0.4.10] - 2015-11-15
### Added
- Support for nodejs 4 in tests
- Added uuidFromString() util function

### Changed
- Test cases for timeuuid

### Fixed
- Map types not working with timestamps

## [0.4.9] - 2015-10-18
### Added
- Support for counter column operations

## [0.4.8] - 2015-10-13
### Fixed
- Proper handling of undefined values

## [0.4.7] - 2015-10-04
### Changed
- Exposing function for closing connections

### Fixed
- Instance delete not working consistently

## [0.4.6] - 2015-10-04
### Fixed
- Instance delete not working consistently

## [0.4.5] - 2015-10-04
### Fixed
- Instance delete not working properly

## [0.4.4] - 2015-09-29
### Fixed
- Properly escape composite datatype values

## [0.4.3] - 2015-09-26
### Fixed
- Virtual fields treated similarly to db fields in some cases

## [0.4.2] - 2015-09-22
### Added
- Option for setting prepare to false in queries

## [0.4.1] - 2015-09-09
### Added
- Support for raw client driver interface

## [0.4.0] - 2015-09-08
### Added
- Support for token pagination operators
- Support for comparison query operators

## [0.3.8] - 2015-09-06
### Changed
- Doc update for supported frameworks and minor adjustments

## [0.3.7] - 2015-09-01
### Added
- FindOne query for single object retrieval

### Changed
- Doc clarify use case of save function

## [0.3.6] - 2015-08-28
### Fixed
- Find query with $in operator bug

## [0.3.5] - 2015-08-25
### Changed
- Validation errors are now passed as error on
save function callback instead of raising exceptions
- Refactored codebase for consistent error messages

### Fixed
- Model validations for update operation

## [0.3.4] - 2015-08-25
### Changed
- Doc clarifications and updates

## [0.3.3] - 2015-08-24
### Added
- Travis integration for automated tests and build status

## [0.3.2] - 2015-08-24
### Added
- Mocha test framework and initial test cases

### Fixed
- Proper composite type validations
- Proper field value expressions for composite types

## 0.3.1 - 2015-08-23
### Fixed
- Camel cased field names not handled properly

## 0.3.0 - 2015-08-21
### Added
- Support for composite map, list and set datatypes

## 0.2.5 - 2015-06-06
### Added
- Support for custom indexes

### Changed
- Refactored code to include modified apollo orm

## 0.2.4 - 2015-06-03
### Added
- Warning for schema mismatch

## 0.2.3 - 2015-06-02
### Added
- Support for partial selects in find operations

## 0.2.2 - 2015-06-02
### Added
- License file

## 0.2.1 - 2015-06-01
### Added
- Doc for batch query interface

### Fixed
- Build models even if cassandra is not available

## 0.2.0 - 2015-05-31
### Added
- Initial featureset and documentation
- Basic ODM with CRUD support
- Support for virtual fields
- Support for schema validators
- Support for auto loading of model schema from directory

[Unreleased]: https://github.com/masumsoft/express-cassandra/compare/v2.8.0...master
[2.8.0]: https://github.com/masumsoft/express-cassandra/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/masumsoft/express-cassandra/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/masumsoft/express-cassandra/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/masumsoft/express-cassandra/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/masumsoft/express-cassandra/compare/v2.3.2...v2.4.0
[2.3.2]: https://github.com/masumsoft/express-cassandra/compare/v2.3.1...v2.3.2
[2.3.1]: https://github.com/masumsoft/express-cassandra/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/masumsoft/express-cassandra/compare/v2.2.4...v2.3.0
[2.2.4]: https://github.com/masumsoft/express-cassandra/compare/v2.2.3...v2.2.4
[2.2.3]: https://github.com/masumsoft/express-cassandra/compare/v2.2.2...v2.2.3
[2.2.2]: https://github.com/masumsoft/express-cassandra/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/masumsoft/express-cassandra/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/masumsoft/express-cassandra/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/masumsoft/express-cassandra/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/masumsoft/express-cassandra/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/masumsoft/express-cassandra/compare/v1.10.0...v2.0.0
[1.10.0]: https://github.com/masumsoft/express-cassandra/compare/v1.9.1...v1.10.0
[1.9.1]: https://github.com/masumsoft/express-cassandra/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/masumsoft/express-cassandra/compare/v1.8.3...v1.9.0
[1.8.3]: https://github.com/masumsoft/express-cassandra/compare/v1.8.2...v1.8.3
[1.8.2]: https://github.com/masumsoft/express-cassandra/compare/v1.8.1...v1.8.2
[1.8.1]: https://github.com/masumsoft/express-cassandra/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/masumsoft/express-cassandra/compare/v1.7.5...v1.8.0
[1.7.5]: https://github.com/masumsoft/express-cassandra/compare/v1.7.4...v1.7.5
[1.7.4]: https://github.com/masumsoft/express-cassandra/compare/v1.7.2...v1.7.4
[1.7.2]: https://github.com/masumsoft/express-cassandra/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/masumsoft/express-cassandra/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/masumsoft/express-cassandra/compare/v1.6.5...v1.7.0
[1.6.5]: https://github.com/masumsoft/express-cassandra/compare/v1.6.4...v1.6.5
[1.6.4]: https://github.com/masumsoft/express-cassandra/compare/v1.6.3...v1.6.4
[1.6.3]: https://github.com/masumsoft/express-cassandra/compare/v1.6.2...v1.6.3
[1.6.2]: https://github.com/masumsoft/express-cassandra/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/masumsoft/express-cassandra/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/masumsoft/express-cassandra/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/masumsoft/express-cassandra/compare/v1.4.2...v1.5.0
[1.4.2]: https://github.com/masumsoft/express-cassandra/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/masumsoft/express-cassandra/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/masumsoft/express-cassandra/compare/v1.3.3...v1.4.0
[1.3.3]: https://github.com/masumsoft/express-cassandra/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/masumsoft/express-cassandra/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/masumsoft/express-cassandra/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/masumsoft/express-cassandra/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/masumsoft/express-cassandra/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/masumsoft/express-cassandra/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/masumsoft/express-cassandra/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/masumsoft/express-cassandra/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/masumsoft/express-cassandra/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/masumsoft/express-cassandra/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/masumsoft/express-cassandra/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/masumsoft/express-cassandra/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/masumsoft/express-cassandra/compare/v0.8.2...v1.0.0
[0.8.2]: https://github.com/masumsoft/express-cassandra/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/masumsoft/express-cassandra/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/masumsoft/express-cassandra/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/masumsoft/express-cassandra/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/masumsoft/express-cassandra/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/masumsoft/express-cassandra/compare/v0.6.4...v0.7.0
[0.6.4]: https://github.com/masumsoft/express-cassandra/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/masumsoft/express-cassandra/compare/v0.6.1...v0.6.3
[0.6.1]: https://github.com/masumsoft/express-cassandra/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/masumsoft/express-cassandra/compare/v0.5.4...v0.6.0
[0.5.4]: https://github.com/masumsoft/express-cassandra/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/masumsoft/express-cassandra/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/masumsoft/express-cassandra/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/masumsoft/express-cassandra/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/masumsoft/express-cassandra/compare/v0.4.12...v0.5.0
[0.4.12]: https://github.com/masumsoft/express-cassandra/compare/v0.4.11...v0.4.12
[0.4.11]: https://github.com/masumsoft/express-cassandra/compare/v0.4.10...v0.4.11
[0.4.10]: https://github.com/masumsoft/express-cassandra/compare/v0.4.9...v0.4.10
[0.4.9]: https://github.com/masumsoft/express-cassandra/compare/v0.4.8...v0.4.9
[0.4.8]: https://github.com/masumsoft/express-cassandra/compare/v0.4.7...v0.4.8
[0.4.7]: https://github.com/masumsoft/express-cassandra/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/masumsoft/express-cassandra/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/masumsoft/express-cassandra/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/masumsoft/express-cassandra/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/masumsoft/express-cassandra/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/masumsoft/express-cassandra/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/masumsoft/express-cassandra/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/masumsoft/express-cassandra/compare/v0.3.8...v0.4.0
[0.3.8]: https://github.com/masumsoft/express-cassandra/compare/v0.3.7...v0.3.8
[0.3.7]: https://github.com/masumsoft/express-cassandra/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/masumsoft/express-cassandra/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/masumsoft/express-cassandra/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/masumsoft/express-cassandra/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/masumsoft/express-cassandra/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/masumsoft/express-cassandra/compare/v0.3.1...v0.3.2
