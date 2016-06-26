module.exports = {
    "fields": {
        "foo": "varchar",
        "bar": {
            "type": "varchar",
            "virtual" : {
                get: function() {
                    return "baz"
                }
            }
        }
    },
    "key" : ["foo"]
}
