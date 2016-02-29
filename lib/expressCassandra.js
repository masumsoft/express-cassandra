"use strict";
var fs = require('fs');
var async = require('async');
var cql = require('cassandra-driver');
var orm = require('./orm/apollo');
class CassandraClient {
 
    constructor(options) {
        var self = this;
        self.modelInstance = {};
        self.orm = new orm(options.clientOptions, options.ormOptions);
    }

    static createClient(options) {
        return new CassandraClient(options);
    }

    setDirectory(directory) {
        this.directory = directory;
        return this;
    }

    bind(options, cb) {
        var self = CassandraClient.createClient(options);
        self.orm.connect(function(err){
            if(err) {
                if(cb) cb(err);
                return;
            }

            fs.readdir(self.directory, function(err, list) {
                if(err) {
                    if(cb) cb(err);
                    return;
                }

                async.each(list, function(file, callback) {

                    var fileName = self.directory + '/' + file;
                    if(fileName.indexOf('Model') == -1) {
                        callback();
                        return;
                    }

                    var modelName = self._translateFileNameToModelName(file);

                    if(modelName) {
                        var modelSchema = require(fileName);
                        self.modelInstance[modelName] = self.orm.add_model(
                            modelName.toLowerCase(),
                            modelSchema,
                            function(err, result){
                                if(err) {
                                    callback(err);
                                }
                                else callback();
                            }
                        );
                    }
                    else {
                        callback();
                    }

                }, function(err){

                    if(err) {
                        if(cb) cb(err);
                    }
                    else {
                        if(cb) cb();
                    }

                });

            });

        });
    }

    connect(callback) {
        var self = this;
        self.orm.connect(callback);
    }

    loadSchema (modelName, modelSchema, callback) {
        var self = this;
        self.modelInstance[modelName] = self.orm.add_model(
            modelName.toLowerCase(),
            modelSchema,
            callback
        );
        return self.modelInstance[modelName];
    }

    timeuuid(date, maxOrMin) {
        var timeuuid;
        if(date) {
            if(date instanceof Date) {
                timeuuid = cql.types.TimeUuid.fromDate(date);
            } else if(date instanceof String) {
                timeuuid = cql.types.TimeUuid.fromString(date);
            } else {
                throw("Invalid date provided to timeuuid");
            }
        } else {
            timeuuid = cql.types.TimeUuid.now();
        }

        if(maxOrMin) {
            switch(maxOrMin.toLowerCase) {
                case "min":
                    timeuuid = timeuuid.min();
                break;
                case "max":
                    timeuuid = timeuuid.max();
            }
        }

        return timeuuid.toString();
    }

    maxTimeuuid(date) {
        return this.timeuuid(date, "max");
    }

    minTimeuuid(date) {
        return this.timeuuid(date, "min");
    }

    static uuid() {
        var uuid = cql.types.Uuid.random();
        return uuid.toString();
    }

    static uuidFromString(string) {
        return cql.types.Uuid.fromString(string);
    }

    doBatch(queries, callback) {
        var randomModel = this.modelInstance[Object.keys(this.modelInstance)[0]];
        var builtQueries = [];
        for(var i=0;i<queries.length;i++) {
            builtQueries.push({
                query: queries[i],
                params: []
            });
        }
        randomModel.execute_batch(builtQueries, function(err){
            if(err) callback(err);
            else callback();
        });
    }

    static get consistencies() {
        return cql.types.consistencies;
    }

    static get datatypes() {
        return cql.types;
    }

    get instance() {
        return this.modelInstance;
    }

    get close() {
        return this.orm.close;
    }

    _translateFileNameToModelName (fileName) {
        return fileName
            .slice(	0,
                    //Get everything before the last dot
                    fileName.lastIndexOf('.'))
            .replace('Model', '');
    }
};

CassandraClient.prototype.uuid = CassandraClient.uuid;
CassandraClient.prototype.uuidFromString = CassandraClient.uuidFromString;
CassandraClient.prototype.consistencies = CassandraClient.consistencies;
CassandraClient.prototype.datatypes = CassandraClient.datatypes;

module.exports = CassandraClient;
