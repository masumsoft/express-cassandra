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
    if(!connection) throw "Data connection configuration undefined";
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
        var copy_fields = ['contactPoints', 'protocolOptions'],
            temp_connection = {},
            connection = this._connection;

        for(var fk in copy_fields){
            temp_connection[copy_fields[fk]] = connection[copy_fields[fk]];
        }
        return new cql.Client(temp_connection);
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

        var client = this._get_system_client();
        var keyspace_name = this._connection.keyspace,
            replication_text = '',
            options = this._options;

        replication_text = this._generate_replication_text(options.defaultReplicationStrategy);

        var query = util.format(
            "CREATE KEYSPACE IF NOT EXISTS %s WITH REPLICATION = %s;",
            keyspace_name,
            replication_text
        );
        client.execute(query, function(err,result){
            client.shutdown(function(){
                callback(err,result);
            });
        });
    },

    _set_client : function(client){
        var define_connection_options = lodash.clone(this._connection);

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
        var on_keyspace = function(err){
            if(err){ return callback(err);}
            this._set_client(new cql.Client(this._connection));
            callback(err, this);
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
            dropTableOnSchemaChange: this._options.dropTableOnSchemaChange
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
