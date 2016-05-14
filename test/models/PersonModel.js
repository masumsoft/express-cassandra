module.exports = {
    "fields": {
        "userID": { "type": "int" },
        "uniId": {"type": "uuid", "default":{"$db_function": "uuid()"}},
        "timeId": {"type": "timeuuid"},
        "Name": { "type": "varchar", "default": "no name provided"},
        "surname": { "type": "varchar", "default": "no surname provided"},
        "completeName": { "type": "varchar", "default": function(){return this.Name + (this.surname ? (' ' + this.surname) : '');}},
        "age": {
            "type": "int",
            "rule" : {
                "validator": function(value){ return (value > 0);  }
            }
        },
        "ageString": {
            "type": "text",
            "virtual" : {
                get: function() {
                    return this.age.toString();
                },
                set: function(value) {
                    this.age = parseInt(value);
                }
            }
        },
        "timeMap": {
            type: "map",
            typeDef: "<text, timestamp>"
        },
        "revtimeMap": {
            type: "map",
            typeDef: "<timestamp, text>"
        },
        "intMap": {
            type: "map",
            typeDef: "<text, int>"
        },
        "intMapDefault": {
            type: "map",
            typeDef: "<text, int>",
            default: {
                'one': 1,
                'two': 2
            }
        },
        "stringMap": {
            type: "map",
            typeDef: "<text, text>"
        },
        "timeList": {
            type: "list",
            typeDef: "<timestamp>"
        },
        "intList": {
            type: "list",
            typeDef: "<int>"
        },
        "stringList": {
            type: "list",
            typeDef: "<text>"
        },
        "stringListDefault": {
            type: "list",
            typeDef: "<text>",
            default: ['one','two']
        },
        "timeSet": {
            type: "set",
            typeDef: "<timestamp>"
        },
        "intSet": {
            type: "set",
            typeDef: "<int>"
        },
        "intSetDefault": {
            type: "set",
            typeDef: "<int>",
            default: [1,2]
        },
        "stringSet": {
            type: "set",
            typeDef: "<text>"
        },
        "info": { "type": "map", typeDef:"<varchar,varchar>" },
        "phones": { "type": "list", typeDef:"<varchar>" },
        "emails": { "type": "set", typeDef:"<varchar>" },
        "address": {
            type: 'frozen',
            typeDef: '<address>'
        },
        "points": "double",
        "active": "boolean",
        "createdAt": {"type": "timestamp", "default" : {"$db_function": "toTimestamp(now())"} }
    },
    "key" : [["userID"],"age"],
    "indexes": ["Name"],
    materialized_views: {
        mat_view_composite: {
            select: ['*'],
            key : [["userID","age"],"active"]
        }
    }
}
