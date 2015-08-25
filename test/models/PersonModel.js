module.exports = {
    "fields": {
        "userID": { "type": "int" },
        "Name": { "type": "varchar", "default": "no name provided"},
        "surname": { "type": "varchar", "default": "no surname provided"},
        "completeName": { "type": "varchar", "default": function(){ return this.Name + ' ' + this.surname;}},
        "age": {
            "type": "int",
            "rule" : {
                "validator": function(value){ return (value > 0);  }
            }
        },
        "info": { "type": "map", typeDef:"<varchar,varchar>" },
        "phones": { "type": "list", typeDef:"<varchar>" },
        "emails": { "type": "set", typeDef:"<varchar>" },
        "createdAt": {"type": "timestamp", "default" : {"$db_function": "dateOf(now())"} }
    },
    "key" : [["userID"],"age"],
    "indexes": ["Name"]
}

