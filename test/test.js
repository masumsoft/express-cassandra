var models = require('../index');
var chai = require('chai');
chai.should();

describe('Unit Tests', function(){
    describe('#modelsync',function(done){
        it('should connect and sync with db without errors', function(done) {
            models.setDirectory( __dirname + '/models').bind(
            {
                clientOptions: {
                    contactPoints: ['127.0.0.1'],
                    keyspace: 'express_cassandra_tests_kspc1',
                    queryOptions: {consistency: models.consistencies.one}
                },
                ormOptions: {
                    defaultReplicationStrategy : {
                        class: 'SimpleStrategy',
                        replication_factor: 1
                    },
                    dropTableOnSchemaChange: true
                }
            },
            function(err) {
                if(err) throw err;
                else done();
            }
            );
        });
    });

    describe('#save',function(){
        it('should save data to without errors', function(done) {
            var alex = new models.instance.Person({userID:1234, Name:"Mahafuzur", age:-32, info:{'hello':'world'}, phones:['123456','234567'], emails:['a@b.com','c@d.com']});
            alex.save(function(err){
                if(err) {
                    err.name.should.equal('apollo.model.save.invalidvalue');
                    alex.age = 32;
                    alex.save(function(err){
                        if(err) throw err;
                        done();
                    });
                }
                else done(new Error("validation rule is not working properly"));
            });
        });
    });

    describe('#find',function(){
        it('should find data as saved without errors', function(done) {
            models.instance.Person.find({userID:1234, age:32}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                people[0].Name.should.equal('Mahafuzur');
                people[0].info.hello.should.equal('world');
                people[0].phones[1].should.equal('234567');
                people[0].emails[1].should.equal('c@d.com');
                done();
            });
        });
    });

    describe('#update',function(){
        it('should update data on db without errors', function(done) {
            models.instance.Person.update({userID:1234, age:32}, {Name:1, info:{'new':'addition'}, phones:['56788'], emails:['c@d.com']}, function(err){
                if(err) {
                    err.name.should.equal('apollo.model.update.invalidvalue');
                    models.instance.Person.update({userID:1234, age:32}, {Name:"Stupid", info:{'new':'addition'}, phones:['56788'], emails:['c@d.com']}, function(err){
                        if(err) throw err;
                        done();
                    });
                }
                else done(new Error("validation rule is not working properly"));
            });
        });
    });

    describe('#find',function(){
        it('should find data as updated without errors', function(done) {
            models.instance.Person.find({userID: 1234,age:32}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                people[0].Name.should.equal('Stupid');
                people[0].info.new.should.equal('addition');
                people[0].phones[0].should.equal('56788');
                people[0].emails[0].should.equal('c@d.com');
                people[0].emails.length.should.equal(1);
                done();
            });
        });
    });

    describe('#delete',function(){
        it('should delete data from db without errors', function(done) {
            models.instance.Person.delete({userID:1234, age:32}, function(err){
                if(err) throw err;
                done();
            });
        });
    });

    describe('#find',function(){
        it('should find data as deleted', function(done) {
            models.instance.Person.find({userID: 1234}, function(err, people){
                if(err) throw err;
                people.length.should.equal(0);
                done();
            });
        });
    });
});
