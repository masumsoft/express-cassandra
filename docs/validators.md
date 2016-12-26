# Validators

Every time you set a property for an instance of your model, an internal type validator checks that the value is valid. If not an error is thrown. But how to add a custom validator? You need to provide your custom validator in the schema definition. For example, if you want to check age to be a number greater than zero:

```js

module.exports = {
    //... other properties hidden for clarity
    age: {
        type : "int",
        rule : function(value){ return value > 0; }
    }
}

```

your validator must return a boolean. If someone will try to assign `john.age = -15;` an error will be thrown.
You can also provide a message for validation error in this way

```js

module.exports = {
    //... other properties hidden for clarity
    age: {
        type : "int",
        rule : {
            validator : function(value){ return value > 0; },
            message   : 'Age must be greater than 0'
        }
    }
}

```

then the error will have your message. Message can also be a function; in that case it must return a string:

```js

module.exports = {
    //... other properties hidden for clarity
    age: {
        type : "int",
        rule : {
            validator : function(value){ return value > 0; },
            message   : function(value){ return 'Age must be greater than 0. You provided '+ value; }
        }
    }
}

```

The error message will be `Age must be greater than 0. You provided -15`

Note that default values _are_ validated if defined either by value or as a javascript function. Defaults defined as DB functions, on the other hand, are never validated in the model as they are retrieved _after_ the corresponding data has entered the DB.
If you need to exclude defaults from being checked you can pass an extra flag:

```js

module.exports = {
    //... other properties hidden for clarity
    email: {
        type : "text",
        default : "<enter your email here>",
        rule : {
            validator : function(value){ /* code to check that value matches an email pattern*/ },
            ignore_default: true
        }
    }
}

```

If a field value is not set and no default value is provided, then the validators will not be executed. So if you want to have `required` fields, then you need to set the `required` flag to true like the following:

```js

module.exports = {
    //... other properties hidden for clarity
    email: {
        type : "text",
        rule : {
            validator : function(value){ /* code to check that value matches an email pattern*/ },
            required: true // If email is undefined or null, then throw validation error
        }
    }
}

```

You may also add multiple validators with a different validation message for each. Following is an example of using multiple validators:

```
module.exports = {
  //... other properties hidden for clarity
  age: {
    type: "int",
    rule: {
      required: true,
      validators: [
        {
          validator: function (value) { return value > 0; },
          message: function (value) { return 'Age must be greater than 0. You provided ' + value; }
        },
        {
          validator: function (value) { return value < 100; },
          message: 'You\'re not that old!'
        }
      ]
    }
  }
}
```
