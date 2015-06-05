var TYPE_MAP = require('./cassandra_types'),
    lodash = require('lodash');

/*
    {
        fields : { //obbligatorio
            column1 : "tipo",
            column2 : "tipo2",
            column3 : "tipo3"
        },
        key : ["column1","column2"],
        indexes : ["column1","column3"]
    }
*/


var schemer = {

    normalize_model_schema: function(model_schema){
        var output_schema = lodash.clone(model_schema,true);
        var good_fields = {fields : true, key:true, indexes:true, custom_index: true};

        for(var k in output_schema){
            if(!(k in good_fields))
                delete(output_schema[k]);
        }

        var index_sort = function(a,b){
            return a > b ? 1 : (a < b ? -1 : 0);
        };

        for(k in output_schema.fields){
            if (typeof (output_schema.fields[k]) == 'string' )
                output_schema.fields[k] = {'type':output_schema.fields[k]};
            else {
                if(output_schema.fields[k].virtual){
                    delete output_schema.fields[k];
                }else{
                    output_schema.fields[k] = {'type':output_schema.fields[k].type};
                }
            }

            if(output_schema.fields[k] && output_schema.fields[k].type == 'varchar') {
                output_schema.fields[k].type = 'text';
            }
        }

        if(output_schema.key && typeof output_schema.key[0] === 'string'){
            output_schema.key[0] = [output_schema.key[0]];
        }

        if(output_schema.indexes){
            output_schema.indexes.sort(index_sort);
        }

        return output_schema;
    },

    validate_model_schema: function(model_schema){
        if(!model_schema)
            throw("A schema must be specified");

        if(typeof(model_schema.fields) != "object" || Object.keys(model_schema.fields).length === 0 )
            throw('Schema must contain a non-empty "fields" map object');
        if(!model_schema.key || !(model_schema.key instanceof Array))
            throw('Schema must contain "key" in the form: [ [partitionkey1, ...], clusteringkey1, ...]');

        for( var k in model_schema.fields){
            var fieldtype = this.get_field_type(model_schema,k);
            if (!( fieldtype in TYPE_MAP))
                throw("Schema Field type unknown for: " + k+ "("+model_schema.fields[k].type+")");
            if (!(this.is_field_default_value_valid(model_schema,k) ))
                throw("Invalid defult definition for: " + k+ "("+model_schema.fields[k].type+")");
        }

        if( typeof(model_schema.key[0]) == "string" ){
            if(!(model_schema.key[0] in model_schema.fields))
                throw("Partition Key as string must match a column name");
            if( model_schema.fields[model_schema.key[0]].virtual )
                throw("Partition Key must match a db column name, can't be a virtual field name");
        }
        else if(model_schema.key[0] instanceof Array){
            if(model_schema.key[0].length === 0){
                 throw("Partition Key array can't be empty");
            }
            for(var j in model_schema.key[0]){
                if((typeof(model_schema.key[0][j]) != "string") || !(model_schema.key[0][j] in model_schema.fields))
                    throw("Partition Key array must contain only column names");
                if( model_schema.fields[model_schema.key[0][j]].virtual )
                    throw("Partition Key array must contain only db column names, can't contain virtual field names");
            }
        }
        else {
            throw("Partition Key must be a column name string, or array of");
        }

        for(var i in model_schema.key){
            if(i>0){
                if((typeof(model_schema.key[i]) != "string") || !(model_schema.key[i] in model_schema.fields))
                    throw("Clustering Keys must match column names");
                if( model_schema.fields[model_schema.key[i]].virtual )
                    throw("Clustering Keys must match db column names, can't be virtual field names");
            }
        }

        if(model_schema.indexes){
            if(!(model_schema.indexes instanceof Array))
                throw("Indexes must be an array of column name strings");
            for(var l in model_schema.indexes){
                if((typeof(model_schema.indexes[l]) != "string") || !(model_schema.indexes[l] in model_schema.fields))
                    throw("Indexes must be an array of column name strings");
                if( model_schema.fields[model_schema.indexes[l]].virtual )
                    throw("Indexes must be an array of db column names, can't contain virtual field names");
            }
        }

        if(model_schema.custom_index){
            if((typeof(model_schema.custom_index.on) != "string") || !(model_schema.custom_index.on in model_schema.fields))
                throw("Custom Index must be a string with a valid column name");
            if(model_schema.fields[model_schema.custom_index.on].virtual)
                throw("Custom Index must be a db column name, can't contain virtual field name");
            if(typeof(model_schema.custom_index.using) != "string") {
                throw("Custom Index must have a 'using' attribute with string value");
            }
            if(!model_schema.custom_index.options) {
                throw("Custom Index options cannot be undefined");
            }
        }
    },

    get_field_type: function(model_schema, fieldname){
        var fieldob = model_schema.fields[fieldname];

        if(typeof fieldob == 'string')
            return fieldob;
        else if(typeof fieldob == 'object'){
            return fieldob.type;
        }
        else
            return undefined;
    },

    is_field_default_value_valid: function(model_schema, fieldname){
        var fieldtype = this.get_field_type(model_schema, fieldname);

        if (typeof model_schema.fields[fieldname] == 'object' && model_schema.fields[fieldname].default){
            /* jshint sub: true */
            if(typeof model_schema.fields[fieldname].default == 'object' && !(model_schema.fields[fieldname].default['$db_function'])){
                return false;
            }
            else
                return true;
        }
        else
            return true;
    }

};

module.exports = schemer;