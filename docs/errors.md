# Error Message Reference

## The Error Object

The errors generated from express-cassandra uses the base error class defined by the apollo library. All errors are extended from the javascript `Error` object and contains a `name` property that identifies the error type. The `message` property contains the full error message. You can rely on the `name` property to check for the error type in your application. For example, the `model.validator.invalidvalue` is thrown when a data value for a field is not valid for the field data type or it did not pass the user defined validator in the schema rule.


## List of ORM Errors

|                    name                    |                     description                        |
|--------------------------------------------|--------------------------------------------------------|
| unspecified                                | unknown error type / uncaught exception                |
| model.validator.invalidconfig              | invalid cassandra configuration                        |
| model.validator.invalidudt                 | invalid user defined type definition                   |
| model.validator.invalidudf                 | invalid user defined function definition               |
| model.validator.invaliduda                 | invalid user defined aggregate definition              |
| model.validator.invalidschema              | invalid model schema definition                        |
| model.validator.invalidrule                | invalid validation rule in schema                      |
| model.validator.invalidvalue               | invalid data value for model field                     |
| model.tablecreation.invalidname            | invalid cassandra table name                           |
| model.tablecreation.dbschemaquery          | error while retrieving table schema for cassandra      |
| model.tablecreation.schemamismatch         | model schema does not match the cassandra table        |
| model.tablecreation.dbcreate               | error while creating cassandra table                   |
| model.tablecreation.dbalter                | error while altering cassandra table                   |
| model.tablecreation.dbdrop                 | error while dropping cassandra table                   |
| model.tablecreation.dbindexcreate          | error while creating index on cassandra table          |
| model.tablecreation.dbindexdrop            | error while dropping index of cassandra table          |
| model.tablecreation.matviewcreate          | error while creating materialized view                 |
| model.tablecreation.matviewdrop            | error while dropping materialized view                 |
| model.find.invalidop                       | invalid operator in where query                        |
| model.find.invalidexpr                     | invalid expr query object                              |
| model.find.invalidsolrquery                | invalid solr_query for datastax enterprise             |
| model.find.invalidorder                    | invalid order_by query object                          |
| model.find.multiorder                      | multiple order_by query is not allowed                 |
| model.find.invalidordertype                | only $asc and $desc order types are allowed            |
| model.find.limittype                       | limit must be an integer                               |
| model.find.invalidinop                     | invalid IN query, $in must be an array                 |
| model.find.invalidcontainsop               | $contains operator valid for indexed collections only  |
| model.find.invalidcontainskeyop            | $contains_key operator valid for indexed maps only     |
| model.find.invalidtoken                    | $token must be an object with operator values          |
| model.find.invalidtokenop                  | invalid operator in token query                        |
| model.find.streamerror                     | invalid stream query without an onReadable function    |
| model.find.eachrowerror                    | invalid eachRow query without an onReadable function   |
| model.find.cberror                         | callback function was required but not provided        |
| model.find.dberror                         | cassandra db error while trying to do a find query     |
| model.save.unsetkey                        | missing primary key field while trying to save data    |
| model.save.unsetrequired                   | missing required field while trying to save data       |
| model.save.invaliddefaultvalue             | invalid default value set in model schema definition   |
| model.save.dberror                         | cassandra db error while trying to save data           |
| model.save.before.error                    | error returned from before_save hook function          |
| model.save.after.error                     | error returned from after_save hook function           |
| model.update.unsetkey                      | missing primary key field while trying to update data  |
| model.update.unsetrequired                 | unsetting required field while trying to update data   |
| model.update.invaliddefaultvalue           | invalid default value set in model schema definition   |
| model.update.invalidreplaceop              | invalid $replace operation while trying to update data |
| model.update.invalidprependop              | invalid $prepend operation while trying to update data |
| model.update.dberror                       | cassandra db error while trying to update data         |
| model.update.before.error                  | error returned from before_update hook function        |
| model.update.after.error                   | error returned from after_update hook function         |
| model.delete.dberror                       | cassandra db error while trying to delete data         |
| model.delete.before.error                  | error returned from before_delete hook function        |
| model.delete.after.error                   | error returned from after_delete hook function         |


