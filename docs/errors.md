# Error Message Reference

## The Error Object

The errors generated from express-cassandra uses the base error class defined by the apollo library. All errors are extended from the javascript `Error` object and contains a `name` property that identifies the error type. The `message` property contains the full error message. You can rely on the `name` property to check for the error type in your application. For example, the `apollo.model.validator.invalidvalue` is thrown when a data value for a field is not valid for the field data type or it did not pass the user defined validator in the schema rule.


## List of ORM Errors

|                    name                    |                     description                        |
|--------------------------------------------|--------------------------------------------------------|
| unspecified                                | unknown error type / uncaught exception                |
| apollo.model.validator.invalidconfig       | invalid cassandra configuration                        |
| apollo.model.validator.invalidudt          | invalid user defined type definition                   |
| apollo.model.validator.invalidudf          | invalid user defined function definition               |
| apollo.model.validator.invaliduda          | invalid user defined aggregate definition              |
| apollo.model.validator.invalidschema       | invalid model schema definition                        |
| apollo.model.validator.invalidvalue        | invalid data value for model field                     |
| apollo.model.tablecreation.invalidname     | invalid cassandra table name                           |
| apollo.model.tablecreation.dbschemaquery   | error while retrieving table schema for cassandra      |
| apollo.model.tablecreation.schemanotfound  | cassandra table for model schema does not exist        |
| apollo.model.tablecreation.schemamismatch  | model schema does not match the cassandra table        |
| apollo.model.tablecreation.dbcreate        | error while creating cassandra table                   |
| apollo.model.tablecreation.dbalter         | error while altering cassandra table                   |
| apollo.model.tablecreation.dbdrop          | error while dropping cassandra table                   |
| apollo.model.tablecreation.dbindexcreate   | error while creating index on cassandra table          |
| apollo.model.tablecreation.dbindexdrop     | error while dropping index of cassandra table          |
| apollo.model.tablecreation.matviewcreate   | error while creating materialized view                 |
| apollo.model.tablecreation.matviewdrop     | error while dropping materialized view                 |
| apollo.model.find.invalidop                | invalid operator in where query                        |
| apollo.model.find.invalidexpr              | invalid expr query object                              |
| apollo.model.find.invalidsolrquery         | invalid solr_query for datastax enterprise             |
| apollo.model.find.invalidorder             | invalid order_by query object                          |
| apollo.model.find.multiorder               | multiple order_by query is not allowed                 |
| apollo.model.find.invalidordertype         | only $asc and $desc order types are allowed            |
| apollo.model.find.limittype                | limit must be an integer                               |
| apollo.model.find.invalidinop              | invalid IN query, $in must be an array                 |
| apollo.model.find.invalidcontainsop        | $contains operator valid for indexed collections only  |
| apollo.model.find.invalidcontainskeyop     | $contains_key operator valid for indexed maps only     |
| apollo.model.find.invalidtoken             | $token must be an object with operator values          |
| apollo.model.find.invalidtokenop           | invalid operator in token query                        |
| apollo.model.find.streamerror              | invalid stream query without an onReadable function    |
| apollo.model.find.eachrowerror             | invalid eachRow query without an onReadable function   |
| apollo.model.find.cberror                  | callback function was required but not provided        |
| apollo.model.find.dberror                  | cassandra db error while trying to do a find query     |
| apollo.model.save.unsetkey                 | missing primary key field while trying to save data    |
| apollo.model.save.unsetrequired            | missing required field while trying to save data       |
| apollo.model.save.invaliddefaultvalue      | invalid default value set in model schema definition   |
| apollo.model.save.dberror                  | cassandra db error while trying to save data           |
| apollo.model.save.before.error             | error returned from before_save hook function          |
| apollo.model.save.after.error              | error returned from after_save hook function           |
| apollo.model.update.unsetkey               | missing primary key field while trying to update data  |
| apollo.model.update.unsetrequired          | unsetting required field while trying to update data   |
| apollo.model.update.invaliddefaultvalue    | invalid default value set in model schema definition   |
| apollo.model.update.invalidreplaceop       | invalid $replace operation while trying to update data |
| apollo.model.update.invalidprependop       | invalid $prepend operation while trying to update data |
| apollo.model.update.dberror                | cassandra db error while trying to update data         |
| apollo.model.update.before.error           | error returned from before_update hook function        |
| apollo.model.update.after.error            | error returned from after_update hook function         |
| apollo.model.delete.dberror                | cassandra db error while trying to delete data         |
| apollo.model.delete.before.error           | error returned from before_delete hook function        |
| apollo.model.delete.after.error            | error returned from after_delete hook function         |
