var util = require('util'),
    build_error = require('./apollo_error.js'),
    cql = require('cassandra-driver'),
    schemer = require('./apollo_schemer'),
    async = require('async'),
    lodash = require('lodash');


var TYPE_MAP = require('./cassandra_types');
var check_db_tablename = function (obj){
    return ( typeof obj == 'string' && /^[a-z]+[a-z0-9_]*/.test(obj) );
};

var noop = function(){};

/**
 * Build a row (a model instance) for this model
 * @param {object} instance_values Key/value object containing values of the row
 * @class
 * @classdesc Base class for generated models
 */
var BaseModel = function(instance_values){
    instance_values = instance_values || {};
    var _field_values = {};
    var fields = this.constructor._properties.schema.fields;
    var self = this;
    var default_setter = function(prop_name, new_value){
            this[prop_name] = new_value;
        },
        default_getter = function(prop_name){
            return this[prop_name];
        };

    this._validators = {};

    for(var fields_keys = Object.keys(fields), i = 0, len = fields_keys.length; i < len; i++){
        var property_name = fields_keys[i],
            field = fields[fields_keys[i]];

        this._validators[property_name] = this.constructor._get_validators(property_name);

        var setter = default_setter.bind(_field_values, property_name),
            getter = default_getter.bind(_field_values, property_name);

        if(field['virtual'] && typeof field['virtual']['set'] === 'function'){
            setter = field['virtual']['set'].bind(_field_values);
        }

        if(field['virtual'] && typeof field['virtual']['get'] === 'function'){
            getter = field['virtual']['get'].bind(_field_values);
        }

        var descriptor = {
            enumerable: true,
            set : setter,
            get : getter
        };

        Object.defineProperty(this, property_name, descriptor);
        if(!field['virtual']){
            this[property_name] = instance_values[property_name];
        }
    }

};

/* Static Private ---------------------------------------- */

/**
 * Properties of the model
 * @protected
 * @abstract
 * @type {Object}
 */
BaseModel._properties = {
    name : null,
    schema : null
};

/**
 * Set properties for the model. Creation of Model constructor use this method to set internal properties
 * @param {object} properties Properties object
 * @protected
 */
BaseModel._set_properties = function(properties){
    var schema = properties.schema,
        cql = properties.cql,
        table_name = schema.table_name || properties.name;

    if(!check_db_tablename(table_name)){
        throw(build_error('model.tablecreation.invalidname',table_name));
    }

    var qualified_table_name = properties.keyspace + '.' + table_name;

    this._properties = properties;
    this._properties.table_name = table_name;
    this._properties.qualified_table_name = qualified_table_name;
};

/**
 * Calls a list of validator on a value
 * @param  {array} validators - Array of validation functions
 * @param  {*} value      - The value to validate
 * @return {(boolean|function)}            True or a function which generate validation message
 * @protected
 */
BaseModel._validate = function(validators, value){
    if( typeof value == 'undefined' || value == null || (typeof value == 'object' && value['$db_function']))
        return true;
    for(var v in validators){
        if(!validators[v].validator(value)){
            return validators[v].message;
        }
    }
    return true;
}

BaseModel._get_validators = function(fieldname){
    var generic_validator_message_func = function(value, prop_name, fieldtype){
        return util.format('Invalid Value: "%s" for Field: %s (Type: %s)', value, prop_name, fieldtype);
    };
    var fieldtype = schemer.get_field_type(this._properties.schema, fieldname);

    var type_fieldvalidator = TYPE_MAP.generic_type_validator(TYPE_MAP[fieldtype].validator);
    var validators = [type_fieldvalidator];

    var field = this._properties.schema.fields[fieldname];
    if( typeof field.rule != 'undefined' ){
        if( typeof field.rule === 'function'){
            field.rule = {
                validator : field.rule,
                message   : generic_validator_message_func
            };
        }else{
            if( typeof field.rule != 'object' || typeof field.rule.validator == 'undefined' ){
                throw 'Invalid validator';
            }
            if(!field.rule.message){
                field.rule.message = generic_validator_message_func
            }else if( typeof field.rule.message == 'string' ){
                field.rule.message = function(message, value, prop_name, fieldtype){return util.format(message, value, prop_name, fieldtype); }.bind(null, field.rule.message);
            }else if( typeof field.rule.message != 'function' ){
                throw 'Invalid validator message';
            }
        }
        validators.push(field['rule']);
    }

    return validators;
}

BaseModel._ensure_connected = function(callback){
    if(!this._properties.cql){
        this._properties.connect(callback);
    }else{
        callback();
    }
};

/**
 * Execute a query on a defined connection which always remain the same
 * @param  {string}                         query       Query to execute
 * @param  {object}                         options     Options for the query
 * @param  {BaseModel~GenericCallback}      callback    callback of the execution
 * @protected
 * @static
 */
BaseModel._execute_definition_query = function(query, params, callback){
    this._ensure_connected(function(err){
        if(err){
            return callback(err);
        }
        var properties = this._properties,
            conn = properties.define_connection;
        conn.execute(query, params, {'prepare': false, 'fetchSize': 0}, callback);
    }.bind(this));
};

/**
 * Execute queries in batch on A connection
 * @param  {object[]}   queries     query, params object
 * @param  {BaseModel~GenericCallback}      callback    callback of the execution
 * @protected
 * @static
 */
BaseModel._execute_batch = function(queries, callback){
    this._ensure_connected(function(err){
        if(err) return callback(err);
        this._properties.cql.batch(queries, {'prepare': false} , callback);
    }.bind(this));
};

BaseModel.execute_batch = function(queries, callback){
    this._execute_batch(queries, callback);
};

//Get the raw client interface
BaseModel.get_cql_client = function(callback){
    this._ensure_connected(function(err){
        if(err) return callback(err);
        callback(null, this._properties.cql);
    }.bind(this));
};


/**
 * Create table on cassandra for this model
 * @param  {BaseModel~GenericCallback} callback Called on creation termination
 * @protected
 * @static
 */
BaseModel._create_table = function(callback){
    var properties = this._properties,
        table_name = properties.table_name,
        model_schema = properties.schema,
        dropTableOnSchemaChange = properties.dropTableOnSchemaChange,
        cql = properties.cql;

    //check for existence of table on DB and if it matches this model's schema
    this._get_db_table_schema(function(err,db_schema){

        if(err) return callback(err);

        var after_dbindex = function(err, result){
            if (err) return callback(build_error('model.tablecreation.dbindex', err));
            //custom index creation
            if(model_schema.custom_index){
                this._execute_definition_query(this._create_custom_index_query(table_name, model_schema.custom_index), [], function(err, result){
                    if (err) callback(build_error('model.tablecreation.dbindex', err));
                    else
                        callback(null,result);
                });
            }
            else
                callback();

        }.bind(this);

        var after_dbcreate = function(err, result){
            if (err) return callback(build_error('model.tablecreation.dbcreate', err));
            //index creation
            if(model_schema.indexes instanceof Array){
                async.eachSeries(model_schema.indexes, function(idx,next){
                    this._execute_definition_query(this._create_index_query(table_name,idx), [], function(err, result){
                        if (err) next(build_error('model.tablecreation.dbindex', err));
                        else
                            next(null,result);
                    });
                }.bind(this),after_dbindex);
            }
            else
                after_dbindex();

        }.bind(this);

        if (db_schema){// check if schemas match
            var normalized_model_schema = schemer.normalize_model_schema(model_schema),
                normalized_db_schema = schemer.normalize_model_schema(db_schema);

            if (!lodash.isEqual(normalized_model_schema, normalized_db_schema)){
                if(dropTableOnSchemaChange){
                    this.drop_table(function(err,result){
                        if (err) return callback(build_error('model.tablecreation.dbcreate', err));
                        var  create_query = this._create_table_query(table_name,model_schema);
                        this._execute_definition_query(create_query, [], after_dbcreate);

                    }.bind(this));
                } else{
                    return callback(build_error('model.tablecreation.schemamismatch', table_name));
                }
            }
            else callback();
        }
        else{  // if not existing, it's created anew
            var  create_query = this._create_table_query(table_name,model_schema);
            this._execute_definition_query(create_query, [], after_dbcreate);
        }
    }.bind(this));
};

/**
 * Generate a query to create this model table
 * @param  {string} table_name Model table name
 * @param  {object} schema     Schema of the model
 * @return {string}            The creation query
 * @protected
 */
BaseModel._create_table_query = function(table_name,schema){
    //creazione tabella
    var rows = [],
        field_type;
    for(var k in schema.fields){
        if(schema.fields[k].virtual){
            continue;
        }
        field_type = schemer.get_field_type(schema, k);
        if(schema.fields[k].typeDef) {
            rows.push(util.format('"%s" %s%s',k,field_type,schema.fields[k].typeDef));
        }
        else rows.push(util.format('"%s" %s',k,field_type));
    }

    var partition_key = schema.key[0],
        clustering_key = schema.key.slice(1,schema.key.length);

    partition_key  = partition_key instanceof Array ? partition_key.map(function(v){return util.format('"%s"',v); }).join(",") : util.format('"%s"',partition_key);
    clustering_key = clustering_key.length ? ','+clustering_key.map(function(v){return util.format('"%s"',v); }).join(",") : '';

    query = util.format(
        'CREATE TABLE IF NOT EXISTS  "%s" (%s , PRIMARY KEY((%s)%s));',
        table_name,
        rows.join(" , "),
        partition_key,
        clustering_key
    );

    return query;
};


/**
 * Create the query to generate table index
 * @param  {string} table_name Name of the table
 * @param  {string} index_name Name of the field to index
 * @return {string}            The index creation query
 * @protected
 */
BaseModel._create_index_query = function(table_name, index_name){
    var query = util.format(
        'CREATE INDEX IF NOT EXISTS ON "%s" ("%s");',
        table_name,
        index_name
    );
    return query;
};


/**
 * Create the query to generate custom table index
 * @param  {string} table_name Name of the table
 * @param  {Object} custom_index custom index object
 * @return {string} The index creation query
 * @protected
 */
BaseModel._create_custom_index_query = function(table_name, custom_index){
    var query = util.format(
        'CREATE CUSTOM INDEX IF NOT EXISTS ON "%s" ("%s") USING \'%s\'',
        table_name,
        custom_index.on,
        custom_index.using
    );
    if(custom_index.options) {
        query += " WITH OPTIONS = {";
        for(var key in custom_index.options) {
            query += "'"+key+"': '"+custom_index.options[key]+"', ";
        }
        query = query.slice(0,-2);
        query += "}";
    }

    query += ";";

    return query;
};


/**
 * Get the schema from an existing table on Cassandra
 * @param  {BaseModel~GetDbSchema} callback - The callback populated with the retrieved schema
 * @protected
 */
BaseModel._get_db_table_schema = function (callback){
    var table_name = this._properties.table_name,
        keyspace = this._properties.keyspace;

    var query = "SELECT * FROM system.schema_columns WHERE columnfamily_name = ? AND keyspace_name = ?;";

    this.execute_query(query,[table_name,keyspace], function(err, result) {
        if (err) return callback(build_error('model.tablecreation.dbschemaquery', err));

        if(!result.rows || result.rows.length === 0)
            return callback(null, null);

        var db_schema = {fields:{}};
        for(var r in result.rows){
            var row = result.rows[r];
            db_schema.fields[row.column_name] = TYPE_MAP.find_type_by_dbvalidator(row.validator);
            if(row.type == 'partition_key'){
                if(!db_schema.key)
                    db_schema.key = [[]];
                db_schema.key[0][row.component_index||0] = row.column_name;
            }
            else if(row.type == 'clustering_key'){
                if(!db_schema.key)
                    db_schema.key = [[]];
                db_schema.key[row.component_index+1] = row.column_name;
            }
            if(row.index_name){
                if(row.index_type == 'CUSTOM') {
                    var index_options = JSON.parse(row.index_options);
                    var using = index_options.class_name;
                    delete index_options.class_name;

                    db_schema.custom_index = {
                        on: row.column_name,
                        using: using,
                        options: index_options
                    };
                }
                else {
                    if(!db_schema.indexes)
                        db_schema.indexes = [];
                    db_schema.indexes.push(row.column_name);
                }
            }
        }

        callback(null,db_schema);
    }.bind(this));

};


/**
 * Execute a query which involves the model table
 * @param  {string}   query     The query to execute
 * @param  {BaseModel~QueryExecution} callback  Callback with err and result
 * @protected
 */
BaseModel._execute_table_query = function(query, params, options, callback){
    if(arguments.length == 3){
        callback = options;
        options = {'prepare': true};
    }

    var do_execute_query = function(doquery,docallback){
        this.execute_query(doquery, params, options, docallback);
    }.bind(this,query);

    if(this.is_table_ready()){
        do_execute_query(callback);
    }
    else{
        this.init(function(err){
            if(err){
                return callback(err);
            }
            do_execute_query(callback);
        });
    }

};


/**
 * Given a field name and a value, format the query portion regarding that value
 * @param  {string} fieldname  Name of the field
 * @param  {string} fieldvalue Value of the field
 * @return {string}            String to be used in query
 * @protected
 * @throws Error if invalid field value given its type
 *
 */
BaseModel._get_db_value_expression = function(fieldname, fieldvalue){
    /* jshint sub: true */

    var fieldtype = schemer.get_field_type(this._properties.schema, fieldname);

    var validators = this._get_validators(fieldname);

    if(fieldvalue === null){
        return 'NULL';
    }

    if(typeof fieldvalue == 'object'){
        if(fieldvalue['$db_function'])
            return fieldvalue['$db_function'];
    }

    if(fieldvalue instanceof Array && fieldtype!='list' && fieldtype!='set'){
        var val = fieldvalue.map(function(v){
                return this._get_db_value_expression(fieldname, v);
            }.bind(this)).join(', ');
        return util.format('(%s)',val);
    }

    if( this._validate(validators, fieldvalue) !== true )
        throw(build_error('model.value.invalidvalue',fieldvalue,fieldname,fieldtype));

    if( typeof fieldvalue === "undefined" )
        throw(build_error('model.value.invalidvalue',fieldvalue,fieldname,fieldtype));

    switch(fieldtype){
        case 'text':
        case 'varchar':
        case 'ascii':
            return util.format("'%s'",fieldvalue.replace(/'/g, "''"));
        case 'inet':
            return util.format("'%s'",fieldvalue);
        case 'timestamp':
            if( !(fieldvalue instanceof Date) )
                fieldvalue = new Date(fieldvalue);
            if( isNaN( fieldvalue.getTime() ) )
                throw(build_error('model.value.invalidvalue',fieldvalue,fieldname,fieldtype));

            return ("\'" + fieldvalue.toISOString().replace(/\..+/, '') + "\'");
        case 'blob':
            return util.format("textAsBlob('%s')",fieldvalue.toString());
        case 'uuid':
        case 'timeuuid':
            return util.format("%s",fieldvalue.toString());
        case 'map':
            var retvalmap = "{";
            for(key in fieldvalue) {
                if(typeof fieldvalue[key] === "string"){
                    retvalmap += "'"+key+"':'"+fieldvalue[key]+"',";
                } else {
                    retvalmap += "'"+key+"':"+fieldvalue[key]+",";
                }
            }
            //remove the final comma
            if(retvalmap.length > 1) retvalmap = retvalmap.slice(0,retvalmap.length-1);
            retvalmap += "}";
            return retvalmap;
        case 'list':
            var retvallist = "[";
            for(key in fieldvalue) {
                if(typeof fieldvalue[key] === "string"){
                    retvallist += "'"+fieldvalue[key]+"',";
                } else {
                    retvallist += fieldvalue[key]+",";
                }
            }
            //remove the final comma
            if(retvallist.length > 1) retvallist = retvallist.slice(0,retvallist.length-1);
            retvallist += "]";
            return retvallist;
        case 'set':
            var retvalset = "{";
            for(key in fieldvalue) {
                if(typeof fieldvalue[key] === "string"){
                    retvalset += "'"+fieldvalue[key]+"',";
                } else {
                    retvalset += fieldvalue[key]+",";
                }
            }
            //remove the final comma
            if(retvalset.length > 1) retvalset = retvalset.slice(0,retvalset.length-1);
            retvalset += "}";
            return retvalset;
        case 'counter':
            var retvalcounter = fieldname;
            if(fieldvalue > 0) {
                retvalcounter += " + " + fieldvalue;
            }
            else if(fieldvalue < 0) {
                retvalcounter += " - " + Math.abs(fieldvalue);
            }
            else {
                throw(build_error('model.value.invalidvalue',fieldvalue,fieldname,fieldtype));
            }
            return retvalcounter;
        default:
            return fieldvalue;
    }
};

/**
 * Given a complete query object, generate the where clause part
 * @param  {object} query_ob Object representing the query
 * @return {string}          Where clause
 * @protected
 */
BaseModel._create_where_clause = function(query_ob){
    var query_relations = [];
    for(var k in query_ob){
        if( k.indexOf('$') === 0 ){
            continue;
        }
        var where_object = query_ob[k];
        //Array of operators
        if( !(where_object instanceof Array))
            where_object = [where_object];
        for (var fk in where_object){
            var field_relation = where_object[fk];
            if(typeof field_relation == 'number' || typeof field_relation == 'string' || typeof field_relation == 'boolean' )
                field_relation = {'$eq': field_relation};
            else if(typeof field_relation != 'object')
                throw(build_error('model.find.invalidrelob', k, field_relation));

            var cql_ops = {'$eq':'=', '$gt':'>', '$lt':'<', '$gte':'>=', '$lte':'<=', '$in':'IN', '$token':'token'};

            var rel_keys = Object.keys(field_relation);
            for(var rk in rel_keys) {
                var first_key = rel_keys[rk],
                    first_value = field_relation[first_key];
                if(first_key.toLowerCase() in cql_ops){
                    first_key = first_key.toLowerCase();
                    var op = cql_ops[first_key];

                    if(first_key == '$in' && !(first_value instanceof Array))
                        throw(build_error('model.find.invalidinset'));
                    if(first_key == '$token' && !(first_value instanceof Object))
                        throw(build_error('model.find.invalidinset'));

                    var where_template = '"%s" %s %s';
                    if(first_key == '$token') {
                        where_template = 'token("%s") %s token(%s)';

                        var token_rel_keys = Object.keys(first_value);
                        for(var token_rk in token_rel_keys) {
                            var token_first_key = token_rel_keys[token_rk];
                            var token_first_value = first_value[token_first_key];
                            if((token_first_key.toLowerCase() in cql_ops) && token_first_key.toLowerCase()!='$token' && token_first_key.toLowerCase()!='$in'){
                                token_first_key = token_first_key.toLowerCase();
                                op = cql_ops[token_first_key];
                            }
                            else {
                                throw(build_error('model.find.invalidop',token_first_key));
                            }
                            query_relations.push( util.format(
                                where_template,
                                k,op,this._get_db_value_expression(k,token_first_value)
                            ));
                        }
                    }
                    else {
                        query_relations.push( util.format(
                            where_template,
                            k,op,this._get_db_value_expression(k,first_value)
                        ));
                    }
                }
                else {
                    throw(build_error('model.find.invalidop',first_key));
                }
            }
        }
    }
    return query_relations.length > 0 ? util.format('WHERE %s',query_relations.join(' AND ')) : '';
};

/**
 * Given a complete query object, generate the SELECT query
 * @param  {object} query_ob Object representing the query
 * @param  {object} options  Options for the query. Unused right now
 * @return {string}          Select statement
 * @protected
 */
BaseModel._create_find_query = function(query_ob, options){
    var query_relations = [],
        order_keys = [],
        limit = null;

    for(var k in query_ob){
        var query_item = query_ob[k];
        if(k.toLowerCase() === '$orderby'){
            if(!(query_item instanceof Object)){
                throw(build_error('model.find.invalidorder'));
            }
            var order_item_keys = Object.keys(query_item);
            if(order_item_keys.length > 1)
                throw(build_error('model.find.multiorder'));

            var cql_orderdir = {'$asc':'ASC', '$desc':'DESC'};
            if(order_item_keys[0].toLowerCase() in cql_orderdir){

                var order_fields = query_item[order_item_keys[0]];

                if(!(order_fields instanceof Array))
                    order_fields = [order_fields];

                for(var i in order_fields){
                    order_keys.push(util.format(
                        '"%s" %s',
                        order_fields[i], cql_orderdir[order_item_keys[0]]
                    ));
                }
            }else{
                throw(build_error('model.find.invalidordertype', order_item[order_item_keys[0]]));
            }
        }
        else if(k.toLowerCase() === '$limit'){
            if(typeof query_item !== 'number')
                throw(build_error('model.find.limittype'));
            limit = query_item;
        }
    }
    var where = this._create_where_clause(query_ob);

    var select = '*';
    if(options.select && lodash.isArray(options.select) && options.select.length > 0) {
        select = '"' + options.select.join('","') + '"';
    }

    var query = util.format(
        'SELECT %s FROM "%s" %s %s %s',
        select,
        this._properties.table_name,
        where,
        order_keys.length ? 'ORDER BY '+ order_keys.join(', '):' ',
        limit ? 'LIMIT '+limit : ' '
    );

    if(options.allow_filtering) query += ' ALLOW FILTERING;';
    else query += ';';

    return query;
};


/* Static Public ---------------------------------------- */

/**
 * Restituisce il nome della tabella usato dal modello
 * @return {string} Nome della tabella
 */
BaseModel.get_table_name = function(){
    return this._properties.table_name;
};

/**
 * Return true if data related to model is initialized on cassandra
 * @return {Boolean} The ready state
 * @public
 */
BaseModel.is_table_ready = function(){
    return this._ready === true;
};

/**
 * Initialize model
 * @param  {object}   options  Options
 * @param  {BaseModel~QueryExecution} callback Called on init end
 */
BaseModel.init = function(options, callback){
    if(!callback){
        callback = options;
        options = undefined;
    }

    this._ready = true;
    callback();
};

/**
 * Sync model definitions with cassandra table
 */
BaseModel.syncDefinition = function(callback) {
    var self = this;

    var after_create = function(err, result){
        if(err) callback(err);
        else {
            this._ready = true;
            callback(null, result);
        }
    }.bind(this);

    this._create_table(after_create);
};

/**
 * Execute a generic query
 * @param  {string}                         query - Query to execute
 * @param  {BaseModel~QueryExecution}       callback - Called on execution end
 */
BaseModel.execute_query = function(query, params, options, callback){
    if(arguments.length == 3){
        callback = options;
        options = {'prepare': true};
    }

    this._ensure_connected(function(err){
        if(err) return callback(err);
        this._properties.cql.execute(query, params, options, function(err, result){
            if(err && err.code == 8704){
                this._execute_definition_query(query, params, callback);
            }else{
                callback(err, result);
            }
        }.bind(this));
    }.bind(this));
};


/**
 * Execute a search on Cassandra for row of this Model
 * @param  {object}                   query_ob - The query objcet
 * @param  {BaseModel~find_options}   [options] - Option for this find query
 * @param  {BaseModel~QueryExecution} callback - Data retrieved
 */
BaseModel.find = function(query_ob, options, callback){
    if(arguments.length == 2){
        callback = options;
        options = {};
    }
    if(!callback)
        throw 'Callback needed!';

    var defaults = {
        raw : false,
        prepare: true
    };

    options = lodash.defaults(options, defaults);

    var query;
    try{
        query = this._create_find_query(query_ob, options);
    }
    catch(e){
        return callback(e);
    }

    this._execute_table_query(query, null, {prepare: options.prepare}, function(err,results){
        if(err) return callback(build_error('model.find.dberror',err));
        if(!options.raw){
            var ModelConstructor = this._properties.get_constructor();
            results = results.rows.map(function(res){
                delete(res.columns);
                return new ModelConstructor(res);
            });
            callback(null,results);
        }else{
            results = results.rows.map(function(res){
                delete(res.columns);
                return res;
            });
            callback(null,results);
        }
    }.bind(this));

};

/**
 * Execute a search on Cassandra for a single row of this Model
 * @param  {object}                   query_ob - The query objcet
 * @param  {BaseModel~find_options}   [options] - Option for this find query
 * @param  {BaseModel~QueryExecution} callback - Data retrieved
 */
BaseModel.findOne = function(query_ob, options, callback){
    if(arguments.length == 2){
        callback = options;
        options = {};
    }
    if(!callback)
        throw 'Callback needed!';

    this.find(query_ob, options, function(err, results){
        if(err) return callback(err);
        if(results.length > 0) {
            return callback(null, results[0]);
        }
        callback();
    });
};

/**
 * Update entry on database
 * @param  {object}                     query_ob - The query object for update
 * @param {object}                      update_values - The column values to be updated
 * @param  {BaseModel~update_options}   [options] - Option for this update query
 * @param  {BaseModel~GenericCallback}  callback - Data retrieved
 */
BaseModel.update = function(query_ob, update_values, options, callback){
    if(arguments.length == 3){
        callback = options;
        options = {};
    }
    if(!callback)
        throw 'Callback needed!';

    var defaults = {
        prepare: true
    };

    options = lodash.defaults(options, defaults);

    var update_clause_array = [];
    for(var key in update_values) {
        try{
            update_clause_array.push('"' + key + '"=' + this._get_db_value_expression(key,update_values[key]));
        }
        catch(e){
            return callback(build_error('model.update.invalidvalue',update_values[key],key));
        }
    }

    var query = 'UPDATE "%s"',
        where = '';
    if(options.ttl) query += ' USING TTL ' + options.ttl;
    query += ' SET %s %s';
    try{
        where = this._create_where_clause(query_ob);
    }
    catch(e){
        return callback(e);
    }
    query = util.format(query, this._properties.table_name, update_clause_array.join(', '), where);

    if(options.conditions) {
        var update_conditions_array = [];
        for(var key in options.conditions) {
            try{
                update_conditions_array.push('"' + key + '"=' + this._get_db_value_expression(key,options.conditions[key]));
            }
            catch(e){
                return callback(build_error('model.update.invalidvalue',options.conditions[key],key));
            }
        }
        query += ' IF ' + update_conditions_array.join(' AND ');
    }
    if(options.if_exists) query += ' IF EXISTS';

    query += ';';

    this._execute_table_query(query, null, {prepare: options.prepare}, function(err,results){
        if(err) return callback(build_error('model.update.dberror',err));
        callback(null, results);
    });

};

/**
 * Delete entry on database
 * @param  {object}                     query_ob - The query object for deletion
 * @param  {BaseModel~delete_options}   [options] - Option for this delete query
 * @param  {BaseModel~GenericCallback}  callback - Data retrieved
 */
BaseModel.delete = function(query_ob, options, callback){
    if(arguments.length == 2){
        callback = options;
        options = {};
    }
    if(!callback)
        throw 'Callback needed!';

    var defaults = {
        prepare: true
    };

    options = lodash.defaults(options, defaults);

    var query = 'DELETE FROM "%s" %s;',
        where = '';
    try{
        where = this._create_where_clause(query_ob);
    }
    catch(e){
        return callback(e);
    }
    query = util.format(query, this._properties.table_name, where);
    this._execute_table_query(query, null, {prepare: options.prepare}, function(err,results){
        if(err) return callback(build_error('model.delete.dberror',err));
        callback(null, results);
    });

};


/**
 * Drop table related to this model
 * @param  {BaseModel~GenericCallback} callback in case of error returns it
 */
BaseModel.drop_table = function(callback){
    var properties = this._properties,
        table_name = properties.table_name,
        cql = properties.cql;

    var query = util.format('DROP TABLE IF EXISTS "%s";', table_name);
    this._execute_definition_query(query,[],callback);
};


/* Instance Private --------------------------------------------- */

/**
 * Set of validators for fields
 * @private
 * @type {Object}
 */
//BaseModel.prototype._validators = {};


BaseModel.prototype._get_default_value = function(fieldname){
    var properties = this.constructor._properties,
        schema = properties.schema,
        fieldtype = schemer.get_field_type(schema, fieldname);

    if (typeof schema.fields[fieldname] == 'object' && schema.fields[fieldname].default !== undefined){
        if(typeof schema.fields[fieldname].default == 'function'){
            return schema.fields[fieldname].default.call(this);
        }
        else
            return schema.fields[fieldname].default;
    }
    else
        return undefined;
};




/* Instance Public --------------------------------------------- */


/**
 * Validate a property given its name
 * @param  {string} property_name - Name of the property to validate
 * @param  {*} [value=this[property_name]] - Value to validate. If not provided the current instance value
 * @return {boolean}              False if validation fails
 */
BaseModel.prototype.validate = function( property_name, value ){
    value = value || this[property_name];
    this._validators = this._validators || {};
    return this.constructor._validate(this._validators[property_name] || [], value);
}

/**
 * Save this instance of the model
 * @param  {BaseModel~save_options}     [options] - options for the query
 * @param  {BaseModel~QueryExecution}   callback - Result of the save or an error eventually
 * @instance
 */
BaseModel.prototype.save = function(options, callback){
    if(arguments.length == 1){
        callback = options;
        options = {};
    }

    var identifiers = [], values = [],
        properties = this.constructor._properties,
        schema = properties.schema,
        defaults = {
            prepare: true
        };

    options = lodash.defaults(options, defaults);

    for(var f in schema.fields){
        if(schema.fields[f]['virtual'])
            continue;

        // check field value
        var fieldtype = schemer.get_field_type(schema,f),
            fieldvalue = this[f];

        if (fieldvalue === undefined){
            fieldvalue = this._get_default_value(f);
            if(fieldvalue === undefined){
                if(schema.key.indexOf(f) >= 0 || schema.key[0].indexOf(f) >= 0)
                    return callback(build_error('model.save.unsetkey',f));
                else
                    continue;
            } else if(!schema.fields[f].rule || !schema.fields[f].rule.ignore_default){ //did set a default value, ignore default is not set
                if( this.validate( f, fieldvalue ) !== true ){
                    return callback(build_error('model.save.invaliddefaultvalue',fieldvalue,f,fieldtype));
                }
            }
        }

        if(fieldvalue === null){
            if(schema.key.indexOf(f) >= 0 || schema.key[0].indexOf(f) >= 0)
                return callback(build_error('model.save.unsetkey',f));
        }

        identifiers.push('"'+f+'"');

        try{
            values.push(this.constructor._get_db_value_expression(f,fieldvalue));
        }
        catch(e){
            return callback(build_error('model.save.invalidvalue',fieldvalue,f,fieldtype));
        }
    }

    var query = util.format(
        'INSERT INTO "%s" ( %s ) VALUES ( %s )',
        properties.table_name,
        identifiers.join(" , "),
        values.join(" , ")
    );

    if(options.if_not_exist) query += " IF NOT EXISTS";
    if(options.ttl) query += " USING TTL " + options.ttl;

    query += ";";

    this.constructor._execute_table_query(query, null, {prepare: options.prepare}, function(err, result){
        if(err) return callback(build_error('model.save.dberror',err));
        callback(null, result);
    });
};

/**
 * Delete this entry on database
 * @param  {BaseModel~delete_options}   [options={}] - Option for this delete query
 * @param  {BaseModel~GenericCallback}  callback - Data retrieved
 */
BaseModel.prototype.delete = function(options, callback){
    if(arguments.length == 1){
        callback = options;
        options = {};
    }
    var schema = this.constructor._properties.schema;
    var delete_query = {};

    for(var i in schema.key){
        var field_key = schema.key[i];
        var field_value = this[field_key];
        var field_type = schemer.get_field_type(schema,field_key);

        try{
            delete_query[field_key] = this.constructor._get_db_value_expression(field_key,field_value);
        }
        catch(e){
            return callback(build_error('model.delete.invalidvalue',field_value,field_key,field_type));
        }
    }
    this.constructor.delete(delete_query, options, callback);
};

module.exports = BaseModel;

/**
 * Generic callback with just error parameter.
 * @callback BaseModel~GenericCallback
 * @param {object} err
 */

/**
 * Generic callback with just error parameter.
 * @callback BaseModel~GetDbSchema
 * @param {object} err - Eventually the error
 * @param {object} schema - The schema retrieved
 */

/**
 * Generic callback with just error parameter.
 * @callback BaseModel~QueryExecution
 * @param {object} err - Eventually the error
 * @param {object} result - The data retrieved
 */

/**
* Options for find operation
* @typedef {Object} BaseModel~find_options
* @property {boolean} [raw=false] - Returns raw result instead of instances of your model
*/

/**
* Options for delete operation
* @typedef {Object} BaseModel~delete_options
*/

/**
* Options for save operation
* @typedef {Object} BaseModel~save_options
*/
