module.exports = {
    "fields": {
        "userID": { "type": "int" },
        "uniId": {"type": "uuid", "default":{"$db_function": "uuid()"}},
        "Name": { "type": "varchar", "default": "no name provided"},
        "surname": { "type": "varchar", "default": "no surname provided"},
        "completeName": { "type": "varchar", "default": function(){ return this.Name + ' ' + this.surname;}},
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
        "intMap": {
            type: "map",
            typeDef: "<text, int>"
        },
        "stringMap": {
            type: "map",
            typeDef: "<text, text>"
        },
        "intList": {
            type: "list",
            typeDef: "<int>"
        },
        "stringList": {
            type: "list",
            typeDef: "<text>"
        },
        "intSet": {
            type: "set",
            typeDef: "<int>"
        },
        "stringSet": {
            type: "set",
            typeDef: "<text>"
        },
        "info": { "type": "map", typeDef:"<varchar,varchar>" },
        "phones": { "type": "list", typeDef:"<varchar>" },
        "emails": { "type": "set", typeDef:"<varchar>" },
        "createdAt": {"type": "timestamp", "default" : {"$db_function": "dateOf(now())"} }
    },
    "key" : [["userID"],"age"],
    "indexes": ["Name"]
}
