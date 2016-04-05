var util = require('util'),
    build_error = require('./apollo_error.js'),
    cql = require('cassandra-driver'),
    schemer = require('./apollo_schemer'),
    async = require('async'),
    lodash = require('lodash'),
    debug = require('debug')('express-cassandra');


var TYPE_MAP = require('./cassandra_types');
var check_db_tablename = function (obj){
    return ( typeof obj == 'string' && /^[a-zA-Z]+[a-zA-Z0-9_]*/.test(obj) );
};

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

    for(var fields_keys = Object.keys(fields), i = 0, len = fields_keys.length; i < len; i++) {
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

BaseModel._properties = {
    name : null,
    schema : null
};

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

    var validators = [];
    var type_fieldvalidator = TYPE_MAP.generic_type_validator(fieldtype);
    if(type_fieldvalidator) validators.push(type_fieldvalidator);

    var field = this._properties.schema.fields[fieldname];
    if( typeof field.rule != 'undefined' ) {
        if( typeof field.rule === 'function') {
            field.rule = {
                validator : field.rule,
                message   : generic_validator_message_func
            };
        }
        else {
            if( typeof field.rule != 'object' || typeof field.rule.validator == 'undefined' ) {
                throw 'Invalid validator';
            }
            if(!field.rule.message) {
                field.rule.message = generic_validator_message_func
            }
            else if( typeof field.rule.message == 'string' ) {
                field.rule.message = function(message, value, prop_name, fieldtype){return util.format(message, value, prop_name, fieldtype); }.bind(null, field.rule.message);
            }
            else if( typeof field.rule.message != 'function' ) {
                throw 'Invalid validator message';
            }
        }
        validators.push(field['rule']);
    }

    return validators;
}

BaseModel._ensure_connected = function(callback) {
    if(!this._properties.cql) {
        this._properties.connect(callback);
    }
    else {
        callback();
    }
};

BaseModel._execute_definition_query = function(query, params, callback) {
    this._ensure_connected(function(err) {
        if(err){
            return callback(err);
        }
        var properties = this._properties,
            conn = properties.define_connection;
        conn.execute(query, params, {'prepare': false, 'fetchSize': 0}, callback);
    }.bind(this));
};

BaseModel._execute_batch = function(queries, options, callback){
    this._ensure_connected(function(err){
        if(err) return callback(err);
        debug('executing batch queries: %j', queries);
        this._properties.cql.batch(queries, options, callback);
    }.bind(this));
};

BaseModel.execute_batch = function(queries, options, callback){
    if(arguments.length == 2){
        callback = options;
        options = {'prepare': true};
    }
    this._execute_batch(queries, options, callback);
};

BaseModel.get_cql_client = function(callback){
    this._ensure_connected(function(err){
        if(err) return callback(err);
        callback(null, this._properties.cql);
    }.bind(this));
};

BaseModel._create_table = function(callback){
    var properties = this._properties,
        table_name = properties.table_name,
        model_schema = properties.schema,
        dropTableOnSchemaChange = properties.dropTableOnSchemaChange,
        cql = properties.cql;

    //check for existence of table on DB and if it matches this model's schema
    this._get_db_table_schema(function(err,db_schema){

        if(err) return callback(err);

        var after_customindex = function(err, result){
            if (err) return callback(build_error('model.tablecreation.dbindex', err));
            //materialized view creation
            if(model_schema.materialized_views){
                async.eachSeries(Object.keys(model_schema.materialized_views), function(view_name,next){
                    this._execute_definition_query(this._create_materialized_view_query(table_name,view_name,model_schema.materialized_views[view_name]), [], function(err, result){
                        if (err) next(build_error('model.tablecreation.matview', err));
                        else
                            next(null,result);
                    });
                }.bind(this),callback);
            }
            else
                callback();

        }.bind(this);

        var after_dbindex = function(err, result){
            if (err) return callback(build_error('model.tablecreation.dbindex', err));
            //custom index creation
            if(model_schema.custom_index){
                this._execute_definition_query(this._create_custom_index_query(table_name, model_schema.custom_index), [], function(err, result){
                    if (err) after_customindex(build_error('model.tablecreation.dbindex', err));
                    else
                        after_customindex(null,result);
                });
            }
            else
                after_customindex();

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

        if (db_schema) {
            var normalized_model_schema = schemer.normalize_model_schema(model_schema),
                normalized_db_schema = schemer.normalize_model_schema(db_schema);

            if (lodash.isEqual(normalized_model_schema, normalized_db_schema)) {
                callback();
            }
            else {
                if(dropTableOnSchemaChange) {
                    if(normalized_db_schema.materialized_views) {
                        var mviews = Object.keys(normalized_db_schema.materialized_views);

                        this.drop_mviews(mviews, function(err,result) {
                            if (err) return callback(build_error('model.tablecreation.dbcreate', err));

                            this.drop_table(function(err,result){
                                if (err) return callback(build_error('model.tablecreation.dbcreate', err));
                                var  create_query = this._create_table_query(table_name,model_schema);
                                this._execute_definition_query(create_query, [], after_dbcreate);

                            }.bind(this));

                        }.bind(this));
                    }
                    else {
                        this.drop_table(function(err,result){
                            if (err) return callback(build_error('model.tablecreation.dbcreate', err));
                            var  create_query = this._create_table_query(table_name,model_schema);
                            this._execute_definition_query(create_query, [], after_dbcreate);

                        }.bind(this));
                    }
                }
                else {
                    return callback(build_error('model.tablecreation.schemamismatch', table_name));
                }
            }
        }
        else {  // if not existing, it's created
            var  create_query = this._create_table_query(table_name,model_schema);
            this._execute_definition_query(create_query, [], after_dbcreate);
        }
    }.bind(this));
};

BaseModel._create_table_query = function(table_name,schema){
    var rows = [],
        field_type;
    for(var k in schema.fields) {
        if(schema.fields[k].virtual) {
            continue;
        }
        field_type = schemer.get_field_type(schema, k);
        if(schema.fields[k].typeDef) {
            rows.push(util.format('"%s" %s%s',k,field_type,schema.fields[k].typeDef));
        }
        else rows.push(util.format('"%s" %s',k,field_type));
    }

    var partition_key = schema.key[0],
        clustering_key = schema.key.slice(1,schema.key.length),
        clustering_order = [];

    for(var field in clustering_key) {
        if(schema.clustering_order && schema.clustering_order[clustering_key[field]] && schema.clustering_order[clustering_key[field]].toLowerCase()=='desc') {
            clustering_order.push('"' + clustering_key[field] + '" DESC');
        }
        else {
            clustering_order.push('"' + clustering_key[field] + '" ASC');
        }
    }

    var clustering_order_query = (clustering_order.length > 0) ? util.format(' WITH CLUSTERING ORDER BY (%s)',clustering_order.toString()) : '';

    partition_key  = partition_key instanceof Array ? partition_key.map(function(v){return util.format('"%s"',v); }).join(",") : util.format('"%s"',partition_key);
    clustering_key = clustering_key.length ? ','+clustering_key.map(function(v){return util.format('"%s"',v); }).join(",") : '';

    query = util.format(
        'CREATE TABLE IF NOT EXISTS "%s" (%s , PRIMARY KEY((%s)%s))%s;',
        table_name,
        rows.join(" , "),
        partition_key,
        clustering_key,
        clustering_order_query
    );

    return query;
};

BaseModel._create_materialized_view_query = function(table_name, view_name, view_schema){
    var rows = [];
    for(var k in view_schema.select){
        rows.push(util.format('"%s"',view_schema.select[k]));
    }

    var partition_key = view_schema.key[0],
        clustering_key = view_schema.key.slice(1,view_schema.key.length),
        clustering_order = [];

    for(var field in clustering_key) {
        if(view_schema.clustering_order && view_schema.clustering_order[clustering_key[field]] && view_schema.clustering_order[clustering_key[field]].toLowerCase()=='desc') {
            clustering_order.push('"' + clustering_key[field] + '" DESC');
        }
        else {
            clustering_order.push('"' + clustering_key[field] + '" ASC');
        }
    }

    var clustering_order_query = (clustering_order.length > 0) ? util.format(' WITH CLUSTERING ORDER BY (%s)',clustering_order.toString()) : '';

    partition_key  = partition_key instanceof Array ? partition_key.map(function(v){return util.format('"%s"',v); }).join(",") : util.format('"%s"',partition_key);
    clustering_key = clustering_key.length ? ','+clustering_key.map(function(v){return util.format('"%s"',v); }).join(",") : '';

    var where_clause = partition_key.split(',').join(' IS NOT NULL AND ');
    if(clustering_key) where_clause += clustering_key.split(',').join(' IS NOT NULL AND ');
    where_clause += ' IS NOT NULL';

    query = util.format(
        'CREATE MATERIALIZED VIEW IF NOT EXISTS "%s" AS SELECT %s FROM "%s" WHERE %s PRIMARY KEY((%s)%s)%s;',
        view_name,
        rows.join(" , "),
        table_name,
        where_clause,
        partition_key,
        clustering_key,
        clustering_order_query
    );

    return query;
};

BaseModel._create_index_query = function(table_name, index_name){
    var query = util.format(
        'CREATE INDEX IF NOT EXISTS ON "%s" ("%s");',
        table_name,
        index_name
    );
    return query;
};

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

BaseModel._get_db_table_schema = function (callback){
    var self = this;

    var table_name = this._properties.table_name,
        keyspace = this._properties.keyspace;

    var query = "SELECT * FROM system_schema.columns WHERE table_name = ? AND keyspace_name = ?;";

    self.execute_query(query,[table_name,keyspace], function(err, result) {
        if (err) return callback(build_error('model.tablecreation.dbschemaquery', err));

        if(!result.rows || result.rows.length === 0)
            return callback(null, null);

        var db_schema = {fields:{},typeMaps:{}};
        for(var r in result.rows){
            var row = result.rows[r];
            db_schema.fields[row.column_name] = TYPE_MAP.extract_type(row.type);

            if(['map','list','set'].indexOf(db_schema.fields[row.column_name]) > -1) {
                db_schema.typeMaps[row.column_name] = TYPE_MAP.extract_typeMap(row.type);
            }

            if(row.kind == 'partition_key'){
                if(!db_schema.key)
                    db_schema.key = [[]];
                db_schema.key[0][row.position] = row.column_name;
            }
            else if(row.kind == 'clustering'){
                if(!db_schema.key)
                    db_schema.key = [[]];
                if(!db_schema.clustering_order)
                    db_schema.clustering_order = {};

                db_schema.key[row.position+1] = row.column_name;
                if(row.clustering_order && row.clustering_order.toLowerCase() == 'desc') {
                    db_schema.clustering_order[row.column_name] = "DESC";
                }
                else {
                    db_schema.clustering_order[row.column_name] = "ASC";
                }
            }
        }

        query = "SELECT * FROM system_schema.indexes WHERE table_name = ? AND keyspace_name = ?;";

        self.execute_query(query,[table_name,keyspace], function(err, result) {
            if (err) return callback(build_error('model.tablecreation.dbschemaquery', err));

            for(var r in result.rows) {
                var row = result.rows[r];
                if(row.index_name) {
                    var index_options = row.options;
                    var target = index_options.target;
                    target = target.replace(/"/g,'');
                    delete index_options.target;
                    if(row.kind == 'CUSTOM') {
                        var using = index_options.class_name;
                        delete index_options.class_name;

                        db_schema.custom_index = {
                            on: target,
                            using: using,
                            options: index_options
                        };
                    }
                    else {
                        if(!db_schema.indexes)
                            db_schema.indexes = [];
                        db_schema.indexes.push(target);
                    }
                }
            }

            query = "SELECT view_name,base_table_name FROM system_schema.views WHERE keyspace_name=?;";

            self.execute_query(query,[keyspace], function(err, result) {
                if (err) return callback(build_error('model.tablecreation.dbschemaquery', err));

                for(var r in result.rows) {
                    var row = result.rows[r];
                    if(row.base_table_name == table_name) {
                        if(!db_schema.materialized_views)
                            db_schema.materialized_views = {};
                        db_schema.materialized_views[row.view_name] = {};
                    }
                }

                if(db_schema.materialized_views) {
                    query = "SELECT * FROM system_schema.columns WHERE keyspace_name=? and table_name IN ?;";

                    self.execute_query(query,[keyspace, Object.keys(db_schema.materialized_views)], function(err, result) {
                        if (err) return callback(build_error('model.tablecreation.dbschemaquery', err));

                        for(var r in result.rows) {
                            var row = result.rows[r];
                            if(!db_schema.materialized_views[row.table_name].select)
                                db_schema.materialized_views[row.table_name].select = [];
                            db_schema.materialized_views[row.table_name].select.push(row.column_name);

                            if(row.kind == 'partition_key'){
                                if(!db_schema.materialized_views[row.table_name].key)
                                    db_schema.materialized_views[row.table_name].key = [[]];
                                db_schema.materialized_views[row.table_name].key[0][row.position] = row.column_name;
                            }
                            else if(row.kind == 'clustering'){
                                if(!db_schema.materialized_views[row.table_name].key)
                                    db_schema.materialized_views[row.table_name].key = [[]];
                                if(!db_schema.materialized_views[row.table_name].clustering_order)
                                    db_schema.materialized_views[row.table_name].clustering_order = {};

                                db_schema.materialized_views[row.table_name].key[row.position+1] = row.column_name;
                                if(row.clustering_order && row.clustering_order.toLowerCase() == 'desc') {
                                    db_schema.materialized_views[row.table_name].clustering_order[row.column_name] = "DESC";
                                }
                                else {
                                    db_schema.materialized_views[row.table_name].clustering_order[row.column_name] = "ASC";
                                }
                            }
                        }

                        callback(null,db_schema);
                    });
                }
                else {
                    callback(null,db_schema);
                }

            });

        });
    }.bind(this));

};

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

BaseModel._get_db_value_expression = function(fieldname, fieldvalue) {
    if(typeof fieldvalue === "undefined" || fieldvalue === null || fieldvalue === cql.types.unset)
        return {query_segment: '?', parameter: fieldvalue};

    if(typeof fieldvalue == 'object'){
        if(fieldvalue['$db_function'])
            return fieldvalue['$db_function'];
    }

    var fieldtype = schemer.get_field_type(this._properties.schema, fieldname);
    var validators = this._get_validators(fieldname);

    if(fieldvalue instanceof Array && fieldtype!='list' && fieldtype!='set') {
        var val = fieldvalue.map(function(v) {
            var db_val = this._get_db_value_expression(fieldname, v);
            if(typeof db_val === 'object') return db_val.parameter;
            else return db_val;
        }.bind(this));
        return {query_segment: '?', parameter: val};
    }

    if( this._validate(validators, fieldvalue) !== true )
        throw(build_error('model.value.invalidvalue',fieldvalue,fieldname,fieldtype));

    switch(fieldtype) {
        case 'counter':
            var counter_query_segment = '"' + fieldname + '"';
            if(fieldvalue >= 0) {
                counter_query_segment += " + ?";
            }
            else {
                counter_query_segment += " - ?";
            }
            fieldvalue = Math.abs(fieldvalue);
            return {query_segment: counter_query_segment, parameter: fieldvalue};
        default:
            return {query_segment: '?', parameter: fieldvalue};
    }
};

BaseModel._create_where_clause = function(query_ob) {
    var query_relations = [];
    var query_params = [];
    for(var k in query_ob){
        if( k.indexOf('$') === 0 ){
            if(k=='$expr') {
                if(query_ob[k].index && query_ob[k].query) {
                    query_relations.push(util.format(
                        "expr(%s,'%s')",
                        query_ob[k].index,query_ob[k].query
                    ));
                }
                else {
                    throw(build_error('model.find.invalidexpr'));
                }
            }
            continue;
        }
        var where_object = query_ob[k];
        //Array of operators
        if(!(where_object instanceof Array))
            where_object = [where_object];
        for (var fk in where_object) {
            var field_relation = where_object[fk];

            if(typeof field_relation !== 'object' || field_relation instanceof cql.types.Long || field_relation instanceof cql.types.LocalDate || field_relation instanceof cql.types.BigDecimal || field_relation instanceof cql.types.InetAddress || field_relation instanceof cql.types.LocalTime || field_relation instanceof Date || field_relation instanceof cql.types.TimeUuid || field_relation instanceof cql.types.Uuid || field_relation instanceof cql.types.Integer) {
                field_relation = {'$eq': field_relation};
            }

            var cql_ops = {'$eq':'=', '$gt':'>', '$lt':'<', '$gte':'>=', '$lte':'<=', '$in':'IN', '$token':'token'};

            var rel_keys = Object.keys(field_relation);
            for(var rk in rel_keys) {
                var first_key = rel_keys[rk],
                    first_value = field_relation[first_key];
                if(first_key.toLowerCase() in cql_ops){
                    first_key = first_key.toLowerCase();
                    var op = cql_ops[first_key];

                    if(first_key == '$in' && !(first_value instanceof Array))
                        throw(build_error('model.find.invalidinop'));
                    if(first_key == '$token' && !(first_value instanceof Object))
                        throw(build_error('model.find.invalidtoken'));

                    var where_template = '"%s" %s %s';
                    if(first_key == '$token') {
                        where_template = 'token("%s") %s token(%s)';

                        var token_rel_keys = Object.keys(first_value);
                        for(var token_rk in token_rel_keys) {
                            var token_first_key = token_rel_keys[token_rk];
                            var token_first_value = first_value[token_first_key];
                            token_first_key = token_first_key.toLowerCase();
                            if((token_first_key in cql_ops) && token_first_key!='$token' && token_first_key!='$in'){
                                op = cql_ops[token_first_key];
                            }
                            else {
                                throw(build_error('model.find.invalidop',token_first_key));
                            }

                            if(token_first_value instanceof Array) {
                                var token_k = k.split(',');
                                for(var token_index=0;token_index<token_first_value.length;token_index++) {
                                    token_k[token_index] = token_k[token_index].trim();
                                    var db_val = this._get_db_value_expression(token_k[token_index], token_first_value[token_index]);
                                    if(typeof db_val === 'object') {
                                        token_first_value[token_index] = db_val.query_segment;
                                        query_params.push(db_val.parameter);
                                    }
                                    else {
                                        token_first_value[token_index] = db_val;
                                    }
                                }
                                query_relations.push( util.format(
                                    where_template,
                                    token_k.join('","'),op,token_first_value.toString()
                                ));
                            }
                            else {
                                var db_val = this._get_db_value_expression(k,token_first_value);
                                if(typeof db_val === 'object') {
                                    query_relations.push( util.format(
                                        where_template,
                                        k,op,db_val.query_segment
                                    ));
                                    query_params.push(db_val.parameter);
                                }
                                else {
                                    query_relations.push( util.format(
                                        where_template,
                                        k,op,db_val
                                    ));
                                }
                            }
                        }
                    }
                    else {
                        var db_val = this._get_db_value_expression(k,first_value);
                        if(typeof db_val === 'object') {
                            query_relations.push( util.format(
                                where_template,
                                k,op,db_val.query_segment
                            ));
                            query_params.push(db_val.parameter);
                        }
                        else {
                            query_relations.push( util.format(
                                where_template,
                                k,op,db_val
                            ));
                        }
                    }
                }
                else {
                    throw(build_error('model.find.invalidop',first_key));
                }
            }
        }
    }
    return {query: (query_relations.length > 0 ? util.format('WHERE %s',query_relations.join(' AND ')) : ''), params: query_params};
};

BaseModel._create_find_query = function(query_ob, options){
    var order_keys = [],
        limit = null;

    for(var k in query_ob) {
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
            }
            else {
                throw(build_error('model.find.invalidordertype', order_item[order_item_keys[0]]));
            }
        }
        else if(k.toLowerCase() === '$limit') {
            if(typeof query_item !== 'number')
                throw(build_error('model.find.limittype'));
            limit = query_item;
        }
    }

    var where_clause = this._create_where_clause(query_ob);

    var select = '*';
    if(options.select && lodash.isArray(options.select) && options.select.length > 0) {
        var select_array = [];
        for(var i=0; i<options.select.length; i++) {
            //separate the aggregate function and the column name if select is an aggregate function
            var selection = options.select[i].split(/[( )]/g).filter(function(e){return e;});
            if(selection.length == 1) {
                select_array.push('"' + selection[0] + '"');
            }
            else if(selection.length == 2 || selection.length == 4) {
                var function_clause = selection[0]+'("'+selection[1]+'")';
                if(selection[2]) function_clause += ' ' + selection[2];
                if(selection[3]) function_clause += ' ' + selection[3];

                select_array.push(function_clause);
            }
            else if(selection.length == 3) {
                select_array.push('"' + selection[0] + '" ' + selection[1] + ' ' + selection[2]);
            }
            else {
                select_array.push('*');
            }
        }
        select = select_array.join(',');
    }

    var query = util.format(
        'SELECT %s %s FROM "%s" %s %s %s',
        (options.distinct ? "DISTINCT" : ""),
        select,
        options.materialized_view ? options.materialized_view : this._properties.table_name,
        where_clause.query,
        order_keys.length ? 'ORDER BY '+ order_keys.join(', '):' ',
        limit ? 'LIMIT '+limit : ' '
    );

    if(options.allow_filtering) query += ' ALLOW FILTERING;';
    else query += ';';

    return {query: query, params: where_clause.params};
};

BaseModel.get_table_name = function(){
    return this._properties.table_name;
};

BaseModel.is_table_ready = function(){
    return this._ready === true;
};

BaseModel.init = function(options, callback){
    if(!callback){
        callback = options;
        options = undefined;
    }

    this._ready = true;
    callback();
};

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

BaseModel.execute_query = function(query, params, options, callback){
    if(arguments.length == 3){
        callback = options;
        options = {'prepare': true};
    }

    this._ensure_connected(function(err){
        if(err) return callback(err);
        debug('executing query: %s with params: %j', query, params);
        this._properties.cql.execute(query, params, options, function(err, result){
            if(err && err.code == 8704){
                this._execute_definition_query(query, params, callback);
            }else{
                callback(err, result);
            }
        }.bind(this));
    }.bind(this));
};

BaseModel.find = function(query_ob, options, callback){
    if(arguments.length == 2){
        callback = options;
        options = {};
    }
    if(typeof callback != 'function')
        throw 'no valid callback function was provided';

    var defaults = {
        raw : false,
        prepare: true
    };

    options = lodash.defaults(options, defaults);

    //set raw true if select is used,
    //because casting to model instances may lead to problems
    if(options.select) options.raw = true;

    var query_params = [];

    var query;
    try {
        var find_query = this._create_find_query(query_ob, options);
        query = find_query.query;
        query_params = query_params.concat(find_query.params);
    }
    catch(e) {
        return callback(e);
    }

    var query_options = {prepare: options.prepare};
    if(options.consistency) query_options.consistency = options.consistency;
    if(options.fetchSize) query_options.fetchSize = options.fetchSize;
    if(options.autoPage) query_options.autoPage = options.autoPage;
    if(options.hints) query_options.hints = options.hints;
    if(options.pageState) query_options.pageState = options.pageState;
    if(options.retry) query_options.retry = options.retry;
    if(options.serialConsistency) query_options.serialConsistency = options.serialConsistency;

    this._execute_table_query(query, query_params, query_options, function(err,results){
        if(err) return callback(build_error('model.find.dberror',err));
        if(!options.raw) {
            var ModelConstructor = this._properties.get_constructor();
            results = results.rows.map(function(res){
                delete(res.columns);
                return new ModelConstructor(res);
            });
            callback(null,results);
        }
        else {
            results = results.rows.map(function(res){
                delete(res.columns);
                return res;
            });
            callback(null,results);
        }
    }.bind(this));

};

BaseModel.findOne = function(query_ob, options, callback){
    if(arguments.length == 2){
        callback = options;
        options = {};
    }
    if(typeof callback != 'function')
        throw 'no valid callback function was provided';

    this.find(query_ob, options, function(err, results){
        if(err) return callback(err);
        if(results.length > 0) {
            return callback(null, results[0]);
        }
        callback();
    });
};

BaseModel.update = function(query_ob, update_values, options, callback){
    if(arguments.length == 3 && typeof options == 'function'){
        callback = options;
        options = {};
    }

    var defaults = {
        prepare: true
    };

    options = lodash.defaults(options, defaults);

    var query_params = [];

    var update_clause_array = [];
    for(var key in update_values) {
        try {
            var db_val = this._get_db_value_expression(key,update_values[key]);
            if(typeof db_val === 'object') {
                update_clause_array.push('"' + key + '"=' + db_val.query_segment);
                query_params.push(db_val.parameter);
            }
            else {
                update_clause_array.push('"' + key + '"=' + db_val);
            }
        }
        catch(e) {
            if(typeof callback == 'function') {
                return callback(build_error('model.update.invalidvalue',update_values[key],key));
            }
            else {
                throw build_error('model.update.invalidvalue',update_values[key],key);
            }
        }
    }

    var query = 'UPDATE "%s"',
        where = '';
    if(options.ttl) query += ' USING TTL ' + options.ttl;
    query += ' SET %s %s';
    try {
        var where_clause = this._create_where_clause(query_ob);
        where = where_clause.query;
        query_params = query_params.concat(where_clause.params);
    }
    catch(e) {
        if(typeof callback == 'function') {
            return callback(e);
        }
        else throw e;
    }
    query = util.format(query, this._properties.table_name, update_clause_array.join(', '), where);

    if(options.conditions) {
        var update_conditions_array = [];
        for(var key in options.conditions) {
            try {
                var db_val = this._get_db_value_expression(key,options.conditions[key]);
                if(typeof db_val === 'object') {
                    update_conditions_array.push('"' + key + '"=' + db_val.query_segment);
                    query_params.push(db_val.parameter);
                }
                else {
                    update_conditions_array.push('"' + key + '"=' + db_val);
                }
            }
            catch(e) {
                if(typeof callback == 'function') {
                    return callback(build_error('model.update.invalidvalue',options.conditions[key],key));
                }
                else {
                    throw build_error('model.update.invalidvalue',options.conditions[key],key);
                }
            }
        }
        query += ' IF ' + update_conditions_array.join(' AND ');
    }
    if(options.if_exists) query += ' IF EXISTS';

    query += ';';

    if(options.return_query) {
        return {query: query, params: query_params};
    }

    var query_options = {prepare: options.prepare};
    if(options.consistency) query_options.consistency = options.consistency;
    if(options.fetchSize) query_options.fetchSize = options.fetchSize;
    if(options.autoPage) query_options.autoPage = options.autoPage;
    if(options.hints) query_options.hints = options.hints;
    if(options.pageState) query_options.pageState = options.pageState;
    if(options.retry) query_options.retry = options.retry;
    if(options.serialConsistency) query_options.serialConsistency = options.serialConsistency;

    this._execute_table_query(query, query_params, query_options, function(err,results){
        if(typeof callback == 'function') {
            if(err) return callback(build_error('model.update.dberror',err));
            callback(null, results);
        }
        else if(err) {
            throw build_error('model.update.dberror',err);
        }
    });

};

BaseModel.delete = function(query_ob, options, callback){
    if(arguments.length == 2 && typeof options == 'function'){
        callback = options;
        options = {};
    }

    var defaults = {
        prepare: true
    };

    options = lodash.defaults(options, defaults);

    var query_params = [];

    var query = 'DELETE FROM "%s" %s;',
        where = '';
    try {
        var where_clause = this._create_where_clause(query_ob);
        where = where_clause.query;
        query_params = query_params.concat(where_clause.params);
    }
    catch(e) {
        if(typeof callback == 'function') {
            return callback(e);
        }
        else throw e;
    }

    query = util.format(query, this._properties.table_name, where);

    if(options.return_query) {
        return {query: query, params: query_params};
    }

    var query_options = {prepare: options.prepare};
    if(options.consistency) query_options.consistency = options.consistency;
    if(options.fetchSize) query_options.fetchSize = options.fetchSize;
    if(options.autoPage) query_options.autoPage = options.autoPage;
    if(options.hints) query_options.hints = options.hints;
    if(options.pageState) query_options.pageState = options.pageState;
    if(options.retry) query_options.retry = options.retry;
    if(options.serialConsistency) query_options.serialConsistency = options.serialConsistency;

    this._execute_table_query(query, query_params, query_options, function(err,results){
        if(typeof callback == 'function') {
            if(err) return callback(build_error('model.delete.dberror',err));
            callback(null, results);
        }
        else if(err) {
            throw build_error('model.delete.dberror',err);
        }
    });

};

BaseModel.drop_mviews = function(mviews, callback){
    var properties = this._properties,
        table_name = properties.table_name,
        cql = properties.cql;
    var self = this;

    async.each(mviews, function(view, viewCallback) {

        var query = util.format('DROP MATERIALIZED VIEW IF EXISTS "%s";', view);
        self._execute_definition_query(query,[],viewCallback);

    }, function(err){
        if(err) callback(err);
        else callback();
    });
};

BaseModel.drop_table = function(callback){
    var properties = this._properties,
        table_name = properties.table_name,
        cql = properties.cql;

    var query = util.format('DROP TABLE IF EXISTS "%s";', table_name);
    this._execute_definition_query(query,[],callback);
};

BaseModel.prototype._get_default_value = function(fieldname){
    var properties = this.constructor._properties,
        schema = properties.schema;

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

BaseModel.prototype.validate = function( property_name, value ){
    value = value || this[property_name];
    this._validators = this._validators || {};
    return this.constructor._validate(this._validators[property_name] || [], value);
}

BaseModel.prototype.save = function(options, callback){
    if(arguments.length == 1 && typeof options == 'function'){
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

    var query_params = [];

    for(var f in schema.fields){
        if(schema.fields[f]['virtual'])
            continue;

        // check field value
        var fieldtype = schemer.get_field_type(schema,f),
            fieldvalue = this[f];

        if (fieldvalue === undefined || fieldvalue === cql.types.unset) {
            fieldvalue = this._get_default_value(f);
            if(fieldvalue === undefined) {
                if(schema.key.indexOf(f) >= 0 || schema.key[0].indexOf(f) >= 0) {
                    if(typeof callback == 'function') {
                        return callback(build_error('model.save.unsetkey',f));
                    }
                    else {
                        throw build_error('model.save.unsetkey',f);
                    }
                }
                else
                    continue;
            }
            else if(!schema.fields[f].rule || !schema.fields[f].rule.ignore_default) { //did set a default value, ignore default is not set
                if( this.validate( f, fieldvalue ) !== true ){
                    if(typeof callback == 'function') {
                        return callback(build_error('model.save.invaliddefaultvalue',fieldvalue,f,fieldtype));
                    }
                    else {
                        throw build_error('model.save.invaliddefaultvalue',fieldvalue,f,fieldtype);
                    }
                }
            }
        }

        if(fieldvalue === null) {
            if(schema.key.indexOf(f) >= 0 || schema.key[0].indexOf(f) >= 0) {
                if(typeof callback == 'function') {
                    return callback(build_error('model.save.unsetkey',f));
                }
                else {
                    throw build_error('model.save.unsetkey',f);
                }
            }
        }

        identifiers.push('"'+f+'"');

        try {
            var db_val = this.constructor._get_db_value_expression(f,fieldvalue);
            if(typeof db_val === 'object') {
                values.push(db_val.query_segment);
                query_params.push(db_val.parameter);
            }
            else {
                values.push(db_val);
            }
        }
        catch(e) {
            if(typeof callback == 'function') {
                return callback(build_error('model.save.invalidvalue',fieldvalue,f,fieldtype));
            }
            else {
                throw build_error('model.save.invalidvalue',fieldvalue,f,fieldtype);
            }
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

    if(options.return_query) {
        return {query: query, params: query_params};
    }

    var query_options = {prepare: options.prepare};
    if(options.consistency) query_options.consistency = options.consistency;
    if(options.fetchSize) query_options.fetchSize = options.fetchSize;
    if(options.autoPage) query_options.autoPage = options.autoPage;
    if(options.hints) query_options.hints = options.hints;
    if(options.pageState) query_options.pageState = options.pageState;
    if(options.retry) query_options.retry = options.retry;
    if(options.serialConsistency) query_options.serialConsistency = options.serialConsistency;

    this.constructor._execute_table_query(query, query_params, query_options, function(err, result) {
        if(typeof callback == 'function') {
            if(err) return callback(build_error('model.save.dberror',err));
            callback(null, result);
        }
        else if(err) {
            throw build_error('model.save.dberror',err);
        }
    });
};

BaseModel.prototype.delete = function(options, callback){
    if(arguments.length == 1 && typeof options == 'function'){
        callback = options;
        options = {};
    }

    var schema = this.constructor._properties.schema;
    var delete_query = {};

    for(var i in schema.key) {
        var field_key = schema.key[i];
        if(field_key instanceof Array) {
            for(var j in field_key) {
                delete_query[field_key[j]] = this[field_key[j]];
            }
        }
        else {
            delete_query[field_key] = this[field_key];
        }
    }

    return this.constructor.delete(delete_query, options, callback);
};

module.exports = BaseModel;
