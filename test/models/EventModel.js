module.exports = {
    fields: {
        "email" : {"type": "text"},
        "id" : { "type": "timeuuid"},
        "body" : {"type": "text"},
        "extra": {"type": "text"},
        "tupletest": {
            "type": "frozen",
            "typeDef": "<tuple<int, text, float>>"
        },
        "statictest": {
            "type": "text",
            "static": true
        }
    },
    "key" : [["email"],"id"],
    "clustering_order": {id: "desc"},
    materialized_views: {
        event_by_id: {
            select: ["body"],
            key : ["id","email"],
            clustering_order: {email: "desc"}
        }
    }
};
