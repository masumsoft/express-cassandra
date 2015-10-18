var models = require('../index');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

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
            var alex = new models.instance.Person({
                userID:1234,
                Name:"Mahafuzur",
                age:-32,
                uniId: models.uuid(),
                info:{'hello':'world'},
                phones:['123456','234567'],
                emails:['a@b.com','c@d.com'],
                intMap: {'one':1, 'two':2, 'three':3},
                stringMap: {'one':'1', 'two':'2', 'three':'3'},
                intList: [1, 2, 3],
                stringList: ['one', 'two', 'three'],
                intSet: [1, 2, 3, 3],
                stringSet: ['one', 'two', 'three', 'three']
            });
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

    describe('#find after save',function(){
        it('should find data as model instances without errors', function(done) {
            models.instance.Person.find({userID:1234, age:32}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                people[0].Name.should.equal('Mahafuzur');
                people[0].info.hello.should.equal('world');
                people[0].phones[1].should.equal('234567');
                people[0].emails[1].should.equal('c@d.com');
                expect(people[0].uniId.toString().length).to.be.equal(36);
                expect(people[0].createdAt).to.exist;
                // test virtual field
                people[0].ageString.should.equal('32');
                people[0].ageString = '50';
                people[0].age.should.equal(50);
                // test composite types
                people[0].intMap.should.deep.equal({"one": 1, "two": 2, "three": 3});
                people[0].stringMap.should.deep.equal({"one": '1', "two": '2', "three": '3'});
                expect(people[0].intList).to.have.members([1, 2, 3]);
                expect(people[0].stringList).to.have.members(['one', 'two', 'three']);
                expect(people[0].intSet).to.have.members([1, 2, 3]);
                expect(people[0].stringSet).to.have.members(['one', 'two', 'three']);
                should.exist(people[0]._validators);
                done();
            });
        });
    });

    describe('#find with raw set to true',function(){
        it('should find raw data as saved without errors', function(done) {
            models.instance.Person.find({userID:1234, age:32}, {raw: true}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                people[0].Name.should.equal('Mahafuzur');
                people[0].info.hello.should.equal('world');
                people[0].phones[1].should.equal('234567');
                people[0].emails[1].should.equal('c@d.com');
                should.not.exist(people[0]._validators);
                done();
            });
        });
    });

    describe('#findOne after save',function(){
        it('should find a single data object without errors', function(done) {
            models.instance.Person.findOne({userID:1234, age:32}, function(err, user){
                if(err) throw err;
                user.Name.should.equal('Mahafuzur');
                user.info.hello.should.equal('world');
                user.phones[1].should.equal('234567');
                user.emails[1].should.equal('c@d.com');
                done();
            });
        });
    });

    describe('#find with $gt and $lt operator',function(){
        it('should find data as saved without errors', function(done) {
            models.instance.Person.find({userID:1234, age:{'$gt':31,'$lt':35}}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                done();
            });
        });
    });

    describe('#find with $in operator',function(){
        it('should find data as saved without errors', function(done) {
            models.instance.Person.find({userID:{'$in':[1234,1235]}, age:32}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                done();
            });
        });
    });

    describe('#find with $token operator',function(){
        it('should find data as saved without errors', function(done) {
            models.instance.Person.find({userID:{'$token':{'$gt':1235,'$lte':1234}},$limit:1}, function(err, people){
                if(err) throw err;
                people.length.should.equal(1);
                done();
            });
        });
    });

    describe('#find with raw driver',function(){
        it('should not through any errors', function(done) {
            models.instance.Person.get_cql_client(function(err, client){
                if(err) throw err;
                client.eachRow('Select * from person limit 10', [], { autoPage : true }, function(n, row) {}, function(err, result){
                    if(err) throw err;
                    done();
                });
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

    describe('#find after update',function(){
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

    describe('#instance update after find',function(){
        it('should find and update single data object without errors', function(done) {
            models.instance.Person.findOne({userID:1234, age:32}, function(err, user){
                if(err) throw err;
                user.Name = "Updated Stupid";
                user.save(function(err){
                    if(err) throw err;
                    models.instance.Person.findOne({userID:1234, age:32}, function(err, user_new){
                        if(err) throw err;
                        user_new.Name.should.equal('Updated Stupid');
                        done();
                    });
                });
            });
        });
    });

    describe('#instance delete after find',function(){
        it('should find and delete single data object without errors', function(done) {
            models.instance.Person.findOne({userID:1234, age:32}, function(err, user){
                if(err) throw err;
                user.delete(function(err){
                    if(err) throw err;
                    models.instance.Person.findOne({userID:1234, age:32}, function(err, user_new){
                        if(err) throw err;
                        expect(user_new).to.not.exist;
                        done();
                    });
                });
            });
        });
    });

    describe('#delete',function(){
        it('should cleanup the db without errors', function(done) {
            models.instance.Person.delete({userID:1234, age:32}, function(err){
                if(err) throw err;
                done();
            });
        });
    });

    describe('#find after delete',function(){
        it('should find all data as deleted', function(done) {
            models.instance.Person.find({userID: 1234}, function(err, people){
                if(err) throw err;
                people.length.should.equal(0);
                done();
            });
        });
    });

    describe('#update counter column',function(){
        it('should increment the counter to 2', function(done) {
            models.instance.Counter.update({user_id:1234}, {visit_count:2}, function(err){
                if(err) throw err;
                models.instance.Counter.findOne({user_id:1234}, function(err, stats){
                    if(err) throw err;
                    stats.visit_count.toString().should.equal('2');
                    done();
                });
            });
        });
        it('should decrement the counter to 0', function(done) {
            models.instance.Counter.update({user_id:1234}, {visit_count:-2}, function(err){
                if(err) throw err;
                models.instance.Counter.findOne({user_id:1234}, function(err, stats){
                    if(err) throw err;
                    stats.visit_count.toString().should.equal('0');
                    done();
                });
            });
        });
    });

    describe('#close cassandra connection',function(){
        it('should close connection to cassandra without errors', function(done) {
            models.close(function(err){
                if(err) throw err;
                done();
            });
        });
    });
});
