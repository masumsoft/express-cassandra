"use strict";
var cql = require("cassandra-driver"),
    types = cql.types,
    async = require('async'),
    util = require("util"),
    BaseModel = require('./base_model'),
    schemer = require('./apollo_schemer'),
    lodash = require("lodash");

var DEFAULT_REPLICATION_FACTOR = 1;

var noop = function(){};

var Apollo = function(connection, options){
    if(!connection) throw("Data connection configuration undefined");
    options = options || {};

    if(!options.defaultReplicationStrategy) {
        options.defaultReplicationStrategy = {
            'class' : 'SimpleStrategy',
            'replication_factor' : DEFAULT_REPLICATION_FACTOR
        };
    }

    this._options = options;
    this._models = {};
    this._keyspace = connection.keyspace;
    this._connection = connection;
    this._client = null;
};


Apollo.prototype = {

    _generate_model : function(properties, callback){

        var Model = function(instance_values){
           BaseModel.apply(this,Array.prototype.slice.call(arguments));
        };

        util.inherits(Model,BaseModel);

        for(var i in BaseModel){
            if(BaseModel.hasOwnProperty(i)){
               Model[i] = BaseModel[i];
            }
        }

        Model._set_properties(properties);
        Model.syncDefinition(function(err, result){
            if(typeof callback === 'function') {
                if(err) callback(err);
                else callback(null, result);
            }
        });

        return Model;
    },

    _get_system_client : function(){
        var connection = lodash.cloneDeep(this._connection);
        delete connection.keyspace;

        return new cql.Client(connection);
    },

    _generate_replication_text : function(replication_option){
        if( typeof replication_option == 'string'){
            return replication_option;
        }else{
            var properties = [];
            for(var k in replication_option){
                properties.push(util.format("'%s': '%s'", k, replication_option[k] ));
            }
            return util.format('{%s}', properties.join(','));
        }
    },

    _assert_keyspace : function(callback){
        var self = this;
        var client = this._get_system_client();
        var keyspace_name = this._connection.keyspace,
            replication_text = '',
            options = this._options;

        var query = util.format(
            "SELECT * FROM system_schema.keyspaces WHERE keyspace_name = '%s';",
            keyspace_name
        );
        client.execute(query, function(err,result){
            if(err) {
                return callback(err);
            }

            var create_keyspace = function() {
                replication_text = self._generate_replication_text(options.defaultReplicationStrategy);

                query = util.format(
                    'CREATE KEYSPACE IF NOT EXISTS "%s" WITH REPLICATION = %s;',
                    keyspace_name,
                    replication_text
                );
                client.execute(query, function(err,result){
                    client.shutdown(function(){
                        callback(err,result);
                    });
                });
            }

            var alter_keyspace = function() {
                replication_text = self._generate_replication_text(options.defaultReplicationStrategy);

                query = util.format(
                    'ALTER KEYSPACE "%s" WITH REPLICATION = %s;',
                    keyspace_name,
                    replication_text
                );
                client.execute(query, function(err,result){
                    client.shutdown(function(){
                        console.warn("WARN: KEYSPACE ALTERED! Run the `nodetool repair` command on each affected node.");
                        callback(err,result);
                    });
                });
            }

            if(result.rows && result.rows.length > 0) {
                var db_replication = result.rows[0].replication;
                for(var key in db_replication) {
                    if(key == 'class') db_replication[key] = db_replication[key].replace('org.apache.cassandra.locator.','');
                    else db_replication[key] = parseInt(db_replication[key]);
                }
                var orm_replication = options.defaultReplicationStrategy;
                for(var key in orm_replication) {
                    if(key == 'class') orm_replication[key] = orm_replication[key].replace('org.apache.cassandra.locator.','');
                    else orm_replication[key] = parseInt(orm_replication[key]);
                }

                if(lodash.isEqual(db_replication, orm_replication)) {
                    callback();
                }
                else {
                    alter_keyspace();
                }
            }
            else {
                create_keyspace();
            }
        });
    },

    _assert_user_defined_types : function(callback){

        var client = this._define_connection;
        var options = this._options;
        var keyspace = this._keyspace;

        if(options.udts) {
            async.eachSeries(Object.keys(options.udts), function(udt_key, udt_callback) {
                var query = util.format(
                    "SELECT * FROM system_schema.types WHERE keyspace_name = '%s' AND type_name = '%s';",
                    keyspace,
                    udt_key.toLowerCase()
                );
                client.execute(query, function(err, result){
                    if(err) {
                        return udt_callback(err);
                    }

                    var create_udt = function() {
                        var udt_fields = [];
                        for(var field in options.udts[udt_key]) {
                            udt_fields.push(util.format(
                                '"%s" %s',
                                field,
                                options.udts[udt_key][field]
                            ));
                        }
                        query = util.format(
                            "CREATE TYPE IF NOT EXISTS %s (%s);",
                            udt_key,
                            udt_fields.toString()
                        );
                        client.execute(query, function(err,result){
                            udt_callback(err);
                        });
                    };

                    if(result.rows && result.rows.length > 0) {
                        var udt_keys = Object.keys(options.udts[udt_key]);
                        var udt_values = lodash.values(options.udts[udt_key]);
                        for(var i=0;i<udt_values.length;i++) {
                            udt_values[i] = udt_values[i].replace(/[\s]/g,'');
                            if(udt_values[i].indexOf('<') > -1 && udt_values[i].indexOf('frozen<') != 0) {
                                udt_values[i] = 'frozen<' + udt_values[i] + '>';
                            }
                        }

                        var field_names = result.rows[0].field_names;
                        var field_types = result.rows[0].field_types;
                        for(var i=0;i<field_types.length;i++) {
                            field_types[i] = field_types[i].replace(/[\s]/g,'');
                            if(field_types[i].indexOf('<') > -1 && field_types[i].indexOf('frozen<') != 0) {
                                field_types[i] = 'frozen<' + field_types[i] + '>';
                            }
                        }

                        if(lodash.isEqual(udt_keys, field_names) && lodash.isEqual(udt_values, field_types)) {
                            udt_callback();
                        }
                        else {
                            throw("User defined type '"+udt_key+"' already exists but does not match the udt definition. Consider altering or droping the type.");
                        }
                    }
                    else {
                        create_udt();
                    }
                });

            }, function(err) {
                callback(err);
            });
        }
        else {
            callback();
        }
    },

    _assert_user_defined_functions : function(callback){

        var client = this._define_connection;
        var options = this._options;
        var keyspace = this._keyspace;

        if(options.udfs) {
            async.eachSeries(Object.keys(options.udfs), function(udf_key, udf_callback) {
                if(!options.udfs[udf_key].returnType) {
                    throw("No returnType defined for user defined function: "+udf_key);
                }
                if(!options.udfs[udf_key].language) {
                    throw("No language defined for user defined function: "+udf_key);
                }
                if(!options.udfs[udf_key].code) {
                    throw("No code defined for user defined function: "+udf_key);
                }
                if(options.udfs[udf_key].inputs && typeof options.udfs[udf_key].inputs != 'object') {
                    throw("inputs must be an object for user defined function: "+udf_key);
                }
                if(options.udfs[udf_key].inputs instanceof Array) {
                    throw("inputs must be an object, not an array for user defined function: "+udf_key);
                }

                var query = util.format(
                    "SELECT * FROM system_schema.functions WHERE keyspace_name = '%s' AND function_name = '%s';",
                    keyspace,
                    udf_key.toLowerCase()
                );
                client.execute(query, function(err, result){
                    if(err) {
                        return udf_callback(err);
                    }

                    var create_udf = function() {
                        var udf_inputs = [];
                        if(options.udfs[udf_key].inputs) {
                            for(var input in options.udfs[udf_key].inputs) {
                                udf_inputs.push(util.format(
                                    '%s %s',
                                    input,
                                    options.udfs[udf_key].inputs[input]
                                ));
                            }
                        }
                        query = util.format(
                            "CREATE OR REPLACE FUNCTION %s (%s) CALLED ON NULL INPUT RETURNS %s LANGUAGE %s AS '%s';",
                            udf_key,
                            udf_inputs.toString(),
                            options.udfs[udf_key].returnType,
                            options.udfs[udf_key].language,
                            options.udfs[udf_key].code
                        );
                        client.execute(query, function(err,result){
                            udf_callback(err);
                        });
                    };

                    if(result.rows && result.rows.length > 0) {
                        var udf_language = options.udfs[udf_key].language;
                        var result_language = result.rows[0].language;

                        var udf_code = options.udfs[udf_key].code;
                        var result_code = result.rows[0].body;

                        var udf_return_type = options.udfs[udf_key].returnType;
                        udf_return_type = udf_return_type.replace(/[\s]/g,'');
                        if(udf_return_type.indexOf('<') > -1 && udf_return_type.indexOf('frozen<') != 0) {
                            udf_return_type = 'frozen<' + udf_return_type + '>';
                        }
                        var result_return_type = result.rows[0].return_type;
                        result_return_type = result_return_type.replace(/[\s]/g,'');
                        if(result_return_type.indexOf('<') > -1 && result_return_type.indexOf('frozen<') != 0) {
                            result_return_type = 'frozen<' + result_return_type + '>';
                        }

                        var udf_inputs = options.udfs[udf_key].inputs ? options.udfs[udf_key].inputs : {};
                        var udf_input_keys = Object.keys(udf_inputs);
                        var udf_input_values = lodash.values(udf_inputs);
                        for(var i=0;i<udf_input_values.length;i++) {
                            udf_input_values[i] = udf_input_values[i].replace(/[\s]/g,'');
                            if(udf_input_values[i].indexOf('<') > -1 && udf_input_values[i].indexOf('frozen<') != 0) {
                                udf_input_values[i] = 'frozen<' + udf_input_values[i] + '>';
                            }
                        }
                        var result_argument_names = result.rows[0].argument_names;
                        var result_argument_types = result.rows[0].argument_types;
                        for(var i=0;i<result_argument_types.length;i++) {
                            result_argument_types[i] = result_argument_types[i].replace(/[\s]/g,'');
                            if(result_argument_types[i].indexOf('<') > -1 && result_argument_types[i].indexOf('frozen<') != 0) {
                                result_argument_types[i] = 'frozen<' + result_argument_types[i] + '>';
                            }
                        }

                        if(udf_language == result_language &&
                            udf_code == result_code &&
                            udf_return_type == result_return_type &&
                            lodash.isEqual(udf_input_keys, result_argument_names) &&
                            lodash.isEqual(udf_input_values, result_argument_types)) {
                            udf_callback();
                        }
                        else {
                            create_udf();
                        }
                    }
                    else {
                        create_udf();
                    }
                });

            }, function(err) {
                callback(err);
            });
        }
        else {
            callback();
        }
    },

    _assert_user_defined_aggregates : function(callback){

        var client = this._define_connection;
        var options = this._options;
        var keyspace = this._keyspace;

        if(options.udas) {
            async.eachSeries(Object.keys(options.udas), function(uda_key, uda_callback) {
                if(!options.udas[uda_key].input_types) {
                    throw("No input_types defined for user defined function: "+uda_key);
                }
                if(!(options.udas[uda_key].input_types instanceof Array)) {
                    throw("input_types must be an array for user defined function: "+uda_key);
                }
                if(options.udas[uda_key].input_types.length < 1) {
                    throw("input_types array cannot be blank for user defined function: "+uda_key);
                }
                if(!options.udas[uda_key].sfunc) {
                    throw("No sfunc defined for user defined aggregate: "+uda_key);
                }
                if(!options.udas[uda_key].stype) {
                    throw("No stype defined for user defined aggregate: "+uda_key);
                }
                if(!options.udas[uda_key].initcond) {
                    options.udas[uda_key].initcond = null;
                }

                var query = util.format(
                    "SELECT * FROM system_schema.aggregates WHERE keyspace_name = '%s' AND aggregate_name = '%s';",
                    keyspace,
                    uda_key.toLowerCase()
                );
                client.execute(query, function(err, result){
                    if(err) {
                        return uda_callback(err);
                    }

                    var create_uda = function() {
                        query = util.format(
                            "CREATE OR REPLACE AGGREGATE %s (%s) SFUNC %s STYPE %s",
                            uda_key,
                            options.udas[uda_key].input_types.toString(),
                            options.udas[uda_key].sfunc,
                            options.udas[uda_key].stype
                        );
                        if(options.udas[uda_key].finalfunc) query += util.format(" FINALFUNC %s",options.udas[uda_key].finalfunc);
                        query += util.format(" INITCOND %s;",options.udas[uda_key].initcond)

                        client.execute(query, function(err,result){
                            uda_callback(err);
                        });
                    };

                    if(result.rows && result.rows.length > 0) {
                        var input_types = options.udas[uda_key].input_types;
                        for(var i=0;i<input_types.length;i++) {
                            input_types[i] = input_types[i].replace(/[\s]/g,'');
                            if(input_types[i].indexOf('<') > -1 && input_types[i].indexOf('frozen<') != 0) {
                                input_types[i] = 'frozen<' + input_types[i] + '>';
                            }
                        }
                        var sfunc = options.udas[uda_key].sfunc.toLowerCase();
                        var stype = options.udas[uda_key].stype;
                        stype = stype.replace(/[\s]/g,'');
                        if(stype.indexOf('<') > -1 && stype.indexOf('frozen<') != 0) {
                            stype = 'frozen<' + stype + '>';
                        }
                        var finalfunc = options.udas[uda_key].finalfunc;
                        if(finalfunc) finalfunc = finalfunc.toLowerCase();
                        var initcond = options.udas[uda_key].initcond;
                        if(initcond) initcond = initcond.replace(/[\s]/g,'');

                        for(var i=0;i<result.rows.length;i++) {
                            var result_argument_types = result.rows[i].argument_types;
                            for(var j=0;j<result_argument_types.length;j++) {
                                result_argument_types[j] = result_argument_types[j].replace(/[\s]/g,'');
                                if(result_argument_types[j].indexOf('<') > -1 && result_argument_types[j].indexOf('frozen<') != 0) {
                                    result_argument_types[j] = 'frozen<' + result_argument_types[j] + '>';
                                }
                            }

                            var result_state_func = result.rows[i].state_func;
                            var result_state_type = result.rows[i].state_type;
                            result_state_type = result_state_type.replace(/[\s]/g,'');
                            if(result_state_type.indexOf('<') > -1 && result_state_type.indexOf('frozen<') != 0) {
                                result_state_type = 'frozen<' + result_state_type + '>';
                            }

                            var result_final_func = result.rows[i].final_func;

                            var result_initcond = result.rows[i].initcond;
                            if(result_initcond) result_initcond = result_initcond.replace(/[\s]/g,'');

                            if(sfunc == result_state_func &&
                            stype == result_state_type &&
                            finalfunc == result_final_func &&
                            initcond == result_initcond &&
                            lodash.isEqual(input_types, result_argument_types)) {
                                return uda_callback();
                            }
                        }

                        create_uda();
                    }
                    else {
                        create_uda();
                    }
                });

            }, function(err) {
                callback(err);
            });
        }
        else {
            callback();
        }
    },

    _set_client : function(client){
        var define_connection_options = lodash.cloneDeep(this._connection);

        this._client = client;
        this._define_connection = new cql.Client(define_connection_options);

        //Reset connections on all models
        for(var i in this._models){
            this._models[i]._properties.cql = this._client;
            this._models[i]._properties.define_connection = this._define_connection;
        }
    },

    uuid: function(){
        var uuid = types.Uuid.random();
        return uuid.toString();
    },

    timeuuid: function(){
        var timeuuid = types.TimeUuid.now();
        return timeuuid.toString();
    },

    connect : function(callback){
        var on_user_defined_aggregates = function(err) {
            if(err){ return callback(err);}
            callback(err, this);
        };

        var on_user_defined_functions = function(err) {
            if(err){ return callback(err);}
            this._assert_user_defined_aggregates( on_user_defined_aggregates.bind(this) );
        };

        var on_user_defined_types = function(err) {
            if(err){ return callback(err);}
            this._assert_user_defined_functions( on_user_defined_functions.bind(this) );
        };

        var on_keyspace = function(err){
            if(err){ return callback(err);}
            this._set_client(new cql.Client(this._connection));
            this._assert_user_defined_types( on_user_defined_types.bind(this) );
        };

        if(this._keyspace && this._options.createKeyspace){
            this._assert_keyspace( on_keyspace.bind(this) );
        }else{
            on_keyspace.call(this);
        }
    },

    add_model : function(model_name, model_schema, callback) {
        if(!model_name || typeof(model_name) != "string")
            throw("Model name must be a valid string");

        schemer.validate_model_schema(model_schema);

        var base_properties = {
            name : model_name,
            schema : model_schema,
            keyspace : this._keyspace,
            define_connection : this._define_connection,
            cql : this._client,
            get_constructor : this.get_model.bind(this,model_name),
            connect: this.connect.bind(this),
            dropTableOnSchemaChange: this._options.dropTableOnSchemaChange,
            migration: this._options.migration
        };

        return (this._models[model_name] = this._generate_model(base_properties, callback));
    },

    get_model : function(model_name){
        return this._models[model_name] || null;
    },

    close : function(callback){
        callback = callback || noop;

        if(!this._client){
            return callback();
        }
        this._client.shutdown(function(err){
            if(!this._define_connection){
                return callback(err);
            }
            this._define_connection.shutdown(function(derr){
                callback(err || derr);
            });
        }.bind(this));
    }
};

module.exports = Apollo;
