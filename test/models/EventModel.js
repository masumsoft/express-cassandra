module.exports = {
    fields: {
        "email" : {"type": "text"},
        "id" : { "type": "timeuuid"},
        "body" : {"type": "text"}
    },
    "key" : [["email"],"id"],
    "clustering_order": {id: "DESC"}
};
