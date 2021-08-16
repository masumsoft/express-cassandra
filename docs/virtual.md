# Virtual fields

Your model could have some fields which are not saved on database. You can define them as `virtual`

```js

export default {
    "fields": {
        "id"     : { "type": "uuid", "default": {"$db_function": "uuid()"} },
        "name"   : { "type": "varchar", "default": "no name provided"},
        "surname"   : { "type": "varchar", "default": "no surname provided"},
        "complete_name" : {
            "type": "varchar",
            "virtual" : {
                get: function(){return this.name + ' ' +this.surname;},
                set: function(value){
                    value = value.split(' ');
                    this.name = value[0];
                    this.surname = value[1];
                }
            }
        }
    }
}

```

A virtual field is simply defined adding a `virtual` key in field description. Virtuals can have a `get` and a `set` function, both optional (you should define at least one of them!).
`this` inside get and set functions is bound to current instance of your model.

