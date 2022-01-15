# Validators

## Built-in type validators

Every time you save a field value for an instance of your model, an internal type validator checks whether the value is valid according to the defined data type of the field. A validation error is thrown if the given data type does not match the data type of the field.

For example let's have a field type defined as `int` like the following:

```js

export default {
    //... other fields hidden for clarity
    age: {
        type : "int"
    }
}

```

So now you cannot for example save a value of type decimal or string for age field. For non integer type input, a validation error will be returned in error callback or a validation error will be thrown if no callback is defined:

```js

var john = new models.instance.Person({
    //... other fields hidden for clarity
    age: 32.5
});
john.save(function(err){
    // invalid value error will be returned in callback
    if(err) {
        console.log(err);
        return;
    }
});

//... trying with string will also fail
john.age = '32';
john.save(); // invalid value error will be thrown

```

## Disabling Built-in type validation

If you want to disable the built-in data type validation checks, you may overwrite the behaviour by setting a rule `type_validation: false` for the field:

```js

export default {
    //... other fields hidden for clarity
    age: {
        type : "int",
        rule : {
            type_validation: false // Won't have validation error even if the value is not an integer
        }
    }
}

```

So now you may use a string and by default it will be converted to integer by cassandra driver using it's automatic safe type conversion system for prepared queries:

```js

john.age = '32';
john.save(); // will be successfully converted by driver to int

john.age='abc'
john.save(); // will throw db error for invalid data

```

## Required fields

If a field value is not set and no default value is provided, then the validators will not be executed. So if you want to have `required` fields, then you need to set the `required` flag to true like the following:

```js

export default {
    //... other fields hidden for clarity
    age: {
        type : "int",
        rule : {
            required: true // If age is undefined or null, then throw validation error
        }
    }
}

```

## Custom validators

You may also add a custom validator on top of existing type validators? You need to provide your custom validator in the schema definition rule. For example, if you want to check age to be a number greater than zero:

```js

export default {
    //... other fields hidden for clarity
    age: {
        type : "int",
        rule : function(value){ return value > 0; }
    }
}

```

your validator must return a boolean. If someone will try to assign `john.age = -15;` an error will be thrown.
You can also provide a message for validation error:

```js

export default {
    //... other fields hidden for clarity
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

export default {
    //... other fields hidden for clarity
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

Note that default values are validated if defined either by value or as a javascript function. Defaults defined as DB functions, on the other hand, are never validated in the model as they are retrieved after the corresponding data has entered the DB.

If you need to exclude defaults from being checked you can pass an extra flag:

```js

export default {
    //... other fields hidden for clarity
    email: {
        type : "text",
        default : "no email provided",
        rule : {
            validator : function(value){ /* code to check that value matches an email pattern*/ },
            ignore_default: true
        }
    }
}

```

You may also add multiple validators with a different validation message for each. Following is an example of using multiple validators:

```js
export default {
  //... other fields hidden for clarity
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
