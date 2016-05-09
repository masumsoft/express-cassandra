"use strict";
var fs = require('fs');
var async = require('async');
var cql = require('cassandra-driver');
var orm = require('./orm/apollo');
var CassandraClient = function (options) {
    var self = this;
    self.modelInstance = {};
    self.orm = new orm(options.clientOptions, options.ormOptions);
};

CassandraClient.createClient = function (options) {
    return new CassandraClient(options);
};

CassandraClient.setDirectory = function (directory) {
    CassandraClient.directory = directory;
    return CassandraClient;
};

CassandraClient.bind = function (options, cb) {
    var self = CassandraClient;
    self.modelInstance = {};
    self.orm = new orm(options.clientOptions, options.ormOptions);
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
};

CassandraClient.prototype.connect = function (callback) {
    var self = this;
    self.orm.connect(callback);
};

CassandraClient.prototype.loadSchema = function (modelName, modelSchema, callback) {
    var self = this;
    self.modelInstance[modelName] = self.orm.add_model(
            modelName.toLowerCase(),
            modelSchema,
            callback
            );
    return self.modelInstance[modelName];
};

CassandraClient.timeuuid = function (date, maxOrMin) {
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

    return timeuuid;
};

CassandraClient.uuid = function () {
    return cql.types.Uuid.random();
};

CassandraClient.uuidFromString = function (string) {
    return cql.types.Uuid.fromString(string);
};

CassandraClient.prototype.doBatch = function (queries, options, callback) {
    var randomModel = this.modelInstance[Object.keys(this.modelInstance)[0]];
    var builtQueries = [];
    for(var i=0;i<queries.length;i++) {
        builtQueries.push({
            query: queries[i].query,
            params: queries[i].params
        });
    }
    randomModel.execute_batch(builtQueries, options, function(err){
        if(err) callback(err);
        else callback();
    });
};

CassandraClient.doBatch = function (queries, options, callback) {
    if(arguments.length == 2){
        callback = options;
        options = {'prepare': true};
    }
    CassandraClient.prototype.doBatch.call(CassandraClient, queries, options, callback);
};

CassandraClient.maxTimeuuid = function (date) {
    return CassandraClient.timeuuid(date, "max");
};

CassandraClient.minTimeuuid = function (date) {
    return CassandraClient.timeuuid(date, "min");
};

CassandraClient.prototype.maxTimeuuid = function (date) {
    return this.timeuuid(date, "max");
};

CassandraClient.prototype.minTimeuuid = function (date) {
    return this.timeuuid(date, "min");
};


CassandraClient._translateFileNameToModelName = function (fileName) {
    return fileName.slice(0, fileName.lastIndexOf('.')).replace('Model', '');
};


Object.defineProperties(CassandraClient, {
    consistencies: {
        get: function () {
            return cql.types.consistencies;
        }
    },
    datatypes: {
        get: function () {
            return cql.types;
        }
    },
    instance: {
        get: function () {
            return CassandraClient.modelInstance;
        }
    },
    close: {
        get: function () {
            return CassandraClient.orm.close;
        }
    }
});


Object.defineProperties(CassandraClient.prototype, {
    consistencies: {
        get: function () {
            return cql.types.consistencies;
        }
    },
    datatypes: {
        get: function () {
            return cql.types;
        }
    },
    instance: {
        get: function () {
            return this.modelInstance;
        }
    },
    close: {
        get: function () {
            return this.orm.close;
        }
    }
});



CassandraClient.prototype.uuid = CassandraClient.uuid;
CassandraClient.prototype.uuidFromString = CassandraClient.uuidFromString;
CassandraClient.prototype.timeuuid = CassandraClient.timeuuid;
CassandraClient.prototype._translateFileNameToModelName = CassandraClient._translateFileNameToModelName;

module.exports = CassandraClient;
