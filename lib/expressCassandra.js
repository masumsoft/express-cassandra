var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var cql = require('cassandra-driver');

var orm = require('./orm/apollo');

module.exports = {

    setDirectory : function(directory) {
        this.directory = directory;
        this.modelInstance = {};
        return this;
    },

    bind : function(options, cb) {
        var self = this;

        self.orm = new orm(options.clientOptions, options.ormOptions);
        self.orm.connect(function(err){
            if(err) {
                console.error(err);
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
                                    console.error(err);
                                }
                                callback();
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
    },

    timeuuid: function() {
        var timeuuid = cql.types.TimeUuid.now();
        return timeuuid.toString();
    },

    uuid: function() {
        var uuid = cql.types.Uuid.random();
        return uuid.toString();
    },

    get instance() {
        return this.modelInstance;
    },

    get close() {
        return this.orm.close;
    },

    get consistencies() {
        return cql.types.consistencies;
    },

    get datatypes() {
        return cql.types;
    },

    _translateFileNameToModelName : function(fileName) {
        return fileName
            .slice(	0,
                    //Get everything before the last dot
                    fileName.lastIndexOf('.'))
            .replace('Model', '');
    }
};
