var TYPE_MAP = require('./cassandra_types');
var _ = require('lodash');

var schemer = {

    normalize_model_schema: function(model_schema){
        var output_schema = _.clone(model_schema,true);
        var good_fields = {fields : true, key:true, clustering_order:true, materialized_views:true, indexes:true, custom_index: true};

        for(var k in output_schema){
            if(!(k in good_fields))
                delete(output_schema[k]);
        }

        for(k in output_schema.fields){
            if (typeof (output_schema.fields[k]) == 'string') {
                output_schema.fields[k] = {'type': output_schema.fields[k]};
            }
            else {
                if(output_schema.fields[k]) {
                    if(output_schema.fields[k].virtual) {
                        delete output_schema.fields[k];
                    }
                    else {
                        if(output_schema.fields[k].typeDef) {
                            output_schema.fields[k] = {'type': output_schema.fields[k].type, 'typeDef': output_schema.fields[k].typeDef};
                        }
                        else {
                            output_schema.fields[k] = {'type': output_schema.fields[k].type};
                        }
                    }
                }
                else {
                    throw("schema field ''"+ k +"' is not properly defined: " + output_schema.fields[k]);
                }
            }

            if(output_schema.fields[k] && output_schema.fields[k].type == 'varchar') {
                output_schema.fields[k].type = 'text';
            }

            if(output_schema.fields[k] && ['map','list','set','frozen'].indexOf(output_schema.fields[k].type) > -1) {
                if(model_schema.typeMaps && model_schema.typeMaps[k]) {
                    output_schema.fields[k].typeDef = model_schema.typeMaps[k];
                }
                else {
                    output_schema.fields[k].typeDef = output_schema.fields[k].typeDef.replace(/[\s]/g,'').replace(/varchar/g,'text');
                }
            }

            if(model_schema.staticMaps && model_schema.staticMaps[k] == true) {
                output_schema.fields[k].static = true;
            }
            else if(model_schema.fields[k].static) {
                output_schema.fields[k].static = true;
            }
        }

        if(output_schema.key && typeof output_schema.key[0] === 'string'){
            output_schema.key[0] = [output_schema.key[0]];
        }

        if(output_schema.key && output_schema.key.length) {
            for(var i=1;i<output_schema.key.length;i++) {
                if(!output_schema.clustering_order) output_schema.clustering_order = {};
                if(!output_schema.clustering_order[output_schema.key[i]]) output_schema.clustering_order[output_schema.key[i]] = 'ASC';

                output_schema.clustering_order[output_schema.key[i]] = output_schema.clustering_order[output_schema.key[i]].toUpperCase();
            }
        }

        var array_sort = function(a,b) {
            return a > b ? 1 : (a < b ? -1 : 0);
        };

        if(output_schema.materialized_views) {
            for(var mvindex in output_schema.materialized_views) {
                //make parition key an array
                if(output_schema.materialized_views[mvindex].key && typeof output_schema.materialized_views[mvindex].key[0] === 'string'){
                    output_schema.materialized_views[mvindex].key[0] = [output_schema.materialized_views[mvindex].key[0]];
                }

                //add clustering_order for all clustering keys
                if(output_schema.materialized_views[mvindex].key && output_schema.materialized_views[mvindex].key.length) {
                    for(var i=1;i<output_schema.materialized_views[mvindex].key.length;i++) {
                        if(!output_schema.materialized_views[mvindex].clustering_order) output_schema.materialized_views[mvindex].clustering_order = {};
                        if(!output_schema.materialized_views[mvindex].clustering_order[output_schema.materialized_views[mvindex].key[i]]) output_schema.materialized_views[mvindex].clustering_order[output_schema.materialized_views[mvindex].key[i]] = 'ASC';

                        output_schema.materialized_views[mvindex].clustering_order[output_schema.materialized_views[mvindex].key[i]] = output_schema.materialized_views[mvindex].clustering_order[output_schema.materialized_views[mvindex].key[i]].toUpperCase();
                    }
                }

                //add all non existent primary key items to select and sort them
                for(var pkey_item in output_schema.materialized_views[mvindex].key) {
                    if(pkey_item == 0) {
                        for(var partition_item in output_schema.materialized_views[mvindex].key[pkey_item]) {
                            if(output_schema.materialized_views[mvindex].select.indexOf(output_schema.materialized_views[mvindex].key[pkey_item][partition_item]) == -1) {
                                output_schema.materialized_views[mvindex].select.push(output_schema.materialized_views[mvindex].key[pkey_item][partition_item]);
                            }
                        }
                    }
                    else {
                        if(output_schema.materialized_views[mvindex].select.indexOf(output_schema.materialized_views[mvindex].key[pkey_item]) == -1) {
                            output_schema.materialized_views[mvindex].select.push(output_schema.materialized_views[mvindex].key[pkey_item]);
                        }
                    }
                }

                //check if select has * and then add all fields to select
                if(output_schema.materialized_views[mvindex].select[0] == '*') {
                    output_schema.materialized_views[mvindex].select = Object.keys(output_schema.fields);
                }

                output_schema.materialized_views[mvindex].select.sort(array_sort);
            }
        }

        if(output_schema.indexes) {
            for(var i=0;i<output_schema.indexes.length;i++) {
                var index_name_list = output_schema.indexes[i].replace(/["\s]/g,'').split(/[\(\)]/g);
                if(index_name_list.length > 1) {
                    index_name_list[0] = index_name_list[0].toLowerCase();
                    if(index_name_list[0] == 'values') output_schema.indexes[i] = index_name_list[1];
                    else output_schema.indexes[i] = index_name_list[0] + '(' + index_name_list[1] + ')';
                }
                else {
                    output_schema.indexes[i] = index_name_list[0];
                }
            }
            output_schema.indexes.sort(array_sort);
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

        for( var k in model_schema.fields) {
            var fieldtype = this.get_field_type(model_schema,k);
            if (!( fieldtype in TYPE_MAP))
                throw("Given schema field type is not supported for: " + k+ "("+model_schema.fields[k].type+")");
            if (!(this.is_field_default_value_valid(model_schema,k) ))
                throw("Invalid defult definition for: " + k+ "("+model_schema.fields[k].type+")");
        }

        //validate primary key
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

        if(model_schema.clustering_order) {
            if(typeof(model_schema.clustering_order) != "object")
                throw('clustering_order must be an object of clustering_key attributes');

            for(var cindex in model_schema.clustering_order) {
                if(['asc','desc'].indexOf(model_schema.clustering_order[cindex].toLowerCase()) == -1)
                    throw('clustering_order attribute values can only be ASC or DESC');
                if(model_schema.key.indexOf(cindex) < 1)
                    throw("clustering_order field attributes must be clustering keys only");

            }
        }

        //validate materialized_view
        if(model_schema.materialized_views) {
            if(typeof(model_schema.materialized_views) != "object")
                throw('materialized_views must be an object with view names as attributes');

            for(var mvindex in model_schema.materialized_views) {
                if(typeof(model_schema.materialized_views[mvindex]) != "object")
                    throw('attribute '+ mvindex +' under materialized_views must be an object');

                if(!model_schema.materialized_views[mvindex].select || !model_schema.materialized_views[mvindex].key)
                    throw("attribute "+ mvindex +" under materialized_views must have 'select' and 'key' attributes");

                if(!(model_schema.materialized_views[mvindex].select instanceof Array) || !(model_schema.materialized_views[mvindex].key instanceof Array))
                    throw("'select' and 'key' attributes must be an array under attribute "+ mvindex +" of materialized_views");

                for(var selectindex in model_schema.materialized_views[mvindex].select) {
                    if((typeof(model_schema.materialized_views[mvindex].select[selectindex]) != "string") || !(model_schema.materialized_views[mvindex].select[selectindex] in model_schema.fields || model_schema.materialized_views[mvindex].select[selectindex] == '*'))
                        throw(new Error("the select attribute under "+ mvindex +" of materialized_views must be an array of column name strings or ['*']"));

                    if(model_schema.fields[model_schema.materialized_views[mvindex].select[selectindex]] && model_schema.fields[model_schema.materialized_views[mvindex].select[selectindex]].virtual)
                        throw("the select attribute under "+ mvindex +" of materialized_views must be an array of db column names, can't contain any virtual field name");
                }

                //validate materialized_view primary key
                if( typeof(model_schema.materialized_views[mvindex].key[0]) == "string" ) {
                    if(!(model_schema.materialized_views[mvindex].key[0] in model_schema.fields))
                        throw("materialized_view "+ mvindex +": partition key string must match a column name");
                    if( model_schema.fields[model_schema.materialized_views[mvindex].key[0]].virtual )
                        throw("materialized_view "+ mvindex +": partition key must match a db column name, can't be a virtual field name");
                }
                else if(model_schema.materialized_views[mvindex].key[0] instanceof Array) {
                    if(model_schema.materialized_views[mvindex].key[0].length === 0) {
                         throw("materialized_view "+ mvindex +": partition key array can't be empty");
                    }
                    for(var j in model_schema.materialized_views[mvindex].key[0]) {
                        if((typeof(model_schema.materialized_views[mvindex].key[0][j]) != "string") || !(model_schema.materialized_views[mvindex].key[0][j] in model_schema.fields))
                            throw("materialized_view "+ mvindex +": partition key array must contain only column names");
                        if( model_schema.fields[model_schema.materialized_views[mvindex].key[0][j]].virtual )
                            throw("materialized_view "+ mvindex +": partition key array must contain only db column names, can't contain virtual field names");
                    }
                }
                else {
                    throw("materialized_view "+ mvindex +": partition key must be a column name string, or array of");
                }

                for(var i in model_schema.materialized_views[mvindex].key){
                    if(i>0){
                        if((typeof(model_schema.materialized_views[mvindex].key[i]) != "string") || !(model_schema.materialized_views[mvindex].key[i] in model_schema.fields))
                            throw("materialized_view "+ mvindex +": clustering keys must match column names");
                        if( model_schema.fields[model_schema.materialized_views[mvindex].key[i]].virtual )
                            throw("materialized_view "+ mvindex +": clustering keys must match db column names, can't be virtual field names");
                    }
                }
                if(model_schema.materialized_views[mvindex].clustering_order) {
                    if(typeof(model_schema.materialized_views[mvindex].clustering_order) != "object")
                        throw('materialized_view '+ mvindex +': clustering_order must be an object of clustering_key attributes');

                    for(var cindex in model_schema.materialized_views[mvindex].clustering_order) {
                        if(['asc','desc'].indexOf(model_schema.materialized_views[mvindex].clustering_order[cindex].toLowerCase()) == -1)
                            throw('materialized_view '+ mvindex +': clustering_order attribute values can only be ASC or DESC');
                        if(model_schema.materialized_views[mvindex].key.indexOf(cindex) < 1)
                            throw("materialized_view "+ mvindex +": clustering_order field attributes must be clustering keys only");

                    }
                }

            }
        }

        //validate indexes
        if(model_schema.indexes) {
            if(!(model_schema.indexes instanceof Array))
                throw("indexes must be an array of column name strings");
            for(var l in model_schema.indexes) {
                if(typeof model_schema.indexes[l] != "string")
                    throw("indexes must be an array of strings");

                var index_name_list = model_schema.indexes[l].replace(/["\s]/g,'').split(/[\(\)]/g);
                if(index_name_list.length > 1) {
                    index_name_list[0] = index_name_list[0].toLowerCase();
                    if(['entries','keys','values','full'].indexOf(index_name_list[0]) < 0) {
                        throw("index " + model_schema.indexes[l] + " is not defined properly");
                    }
                    if(!(index_name_list[1] in model_schema.fields)) {
                        throw(index_name_list[1] + " is not a column field, indexes must be defined on column names");
                    }
                    if( model_schema.fields[index_name_list[1]].virtual ) {
                        throw("indexes must be an array of db column names, can't contain virtual field names");
                    }
                }
                else {
                    if(!(index_name_list[0] in model_schema.fields)) {
                        throw(index_name_list[0] + " is not a column field, indexes must be defined on column names");
                    }
                    if( model_schema.fields[index_name_list[0]].virtual ) {
                        throw("indexes must be an array of db column names, can't contain virtual field names");
                    }
                }
            }
        }

        if(model_schema.custom_index) {
            if(typeof(model_schema.custom_index) != "object")
                throw('custom_index must be an object with proper indexing attributes');
            if((typeof(model_schema.custom_index.on) != "string") || !(model_schema.custom_index.on in model_schema.fields))
                throw("custom_index must have an 'on' attribute with string value and value must be a valid column name");
            if(model_schema.fields[model_schema.custom_index.on].virtual)
                throw("custom_index 'on' attribute must be a db column name, can't contain virtual field name");
            if(typeof(model_schema.custom_index.using) != "string")
                throw("custom_index must have a 'using' attribute with string value");
            if(!model_schema.custom_index.options)
                throw("custom_index must have an 'options' attribute, it cannot be undefined");
        }
    },

    get_field_type: function(model_schema, fieldname){
        var fieldob = model_schema.fields[fieldname];

        if(typeof fieldob == 'string')
            return fieldob;
        else if(typeof fieldob == 'object'){
            return fieldob.type;
        }
        else {
            throw("Field type not defined for '" + fieldname + "'");
        }
    },

    is_field_default_value_valid: function(model_schema, fieldname){
        if (typeof model_schema.fields[fieldname] == 'object' && model_schema.fields[fieldname].default){
            /* jshint sub: true */
            if(typeof model_schema.fields[fieldname].default == 'object' && !(model_schema.fields[fieldname].default['$db_function'])){
                if(['map','list','set','frozen'].indexOf(model_schema.fields[fieldname].type) > -1) return true;
                else return false;
            }
            else
                return true;
        }
        else
            return true;
    }

};

module.exports = schemer;
