const models = require('../lib/expressCassandra');
const path = require('path');
const chai = require('chai');

const should = chai.should();
const currentTime = Date.now();
const eventID = models.timeuuid();
let client;

describe('Unit Tests', () => {
  describe('#modelsync', () => {
    it('should connect and sync with db without errors', function f(done) {
      this.timeout(20000);
      this.slow(10000);
      models.setDirectory(path.join(__dirname, '/models')).bind(
        {
          clientOptions: {
            contactPoints: ['127.0.0.1'],
            keyspace: 'express_cassandra_tests_kspc1',
            queryOptions: { consistency: models.consistencies.one },
          },
          ormOptions: {
            defaultReplicationStrategy: {
              class: 'SimpleStrategy',
              replication_factor: 1,
            },
            migration: 'alter',
            createKeyspace: true,
            disableTTYConfirmation: true,
            udts: {
              phone: {
                alias: 'text',
                phone_number: 'text',
                country_code: 'int',
              },
              Address: {
                street: 'text',
                city: 'text',
                state: 'text',
                zip: 'int',
                phones: 'set<frozen<phone>>',
              },
            },
            udfs: {
              fLog: {
                language: 'java',
                code: 'return Double.valueOf(Math.log(input.doubleValue()));',
                returnType: 'double',
                inputs: {
                  input: 'double',
                },
              },
              avgState: {
                language: 'java',
                code: 'if (val !=null) {' +
                        'state.setInt(0, state.getInt(0)+1);' +
                        'state.setLong(1,state.getLong(1)+val.intValue());' +
                      '}' +
                      'return state;',
                returnType: 'tuple<int, bigint>',
                inputs: {
                  state: 'tuple<int, bigint>',
                  val: 'int',
                },
              },
              avgFinal: {
                language: 'java',
                code: 'double r = 0;' +
                      'if (state.getInt(0) == 0) return null;' +
                      'r = state.getLong(1);' +
                      'r/= state.getInt(0);' +
                      'return Double.valueOf(r);',
                returnType: 'double',
                inputs: {
                  state: 'tuple<int,bigint>',
                },
              },
              maxI: {
                language: 'java',
                code: 'if (current == null) return candidate;' +
                      'else return Math.max(current, candidate);',
                returnType: 'int',
                inputs: {
                  current: 'int',
                  candidate: 'int',
                },
              },
              state_group_and_count: {
                language: 'java',
                code: 'Integer count = (Integer) state.get(type);' +
                      'if (count == null) count = 1;' +
                      'else count++;' +
                      'state.put(type, count);' +
                      'return state;',
                returnType: 'map<text, int>',
                inputs: {
                  state: 'map<text, int>',
                  type: 'text',
                },
              },
              state_group_and_total: {
                language: 'java',
                code: 'Integer count = (Integer) state.get(type);' +
                      'if (count == null) count = amount;' +
                      'else count = count + amount;' +
                      'state.put(type, count);' +
                      'return state;',
                returnType: 'map<text, int>',
                inputs: {
                  state: 'map<text, int>',
                  type: 'text',
                  amount: 'int',
                },
              },
            },
            udas: {
              average: {
                input_types: ['int'],
                sfunc: 'avgState',
                stype: 'tuple<int,bigint>',
                finalfunc: 'avgFinal',
                initcond: '(0,0)',
              },
              maxAgg: {
                input_types: ['int'],
                sfunc: 'maxI',
                stype: 'int',
              },
              group_and_count: {
                input_types: ['text'],
                sfunc: 'state_group_and_count',
                stype: 'map<text, int> ',
                initcond: '{}',
              },
              group_and_total: {
                input_types: ['text', 'int'],
                sfunc: 'state_group_and_total',
                stype: 'map<text, int>',
                initcond: '{}',
              },
            },
          },
        },
        (err) => {
          if (err) throw err;
          else done();
        }
      );
    });
  });

  describe('#multiple connections', () => {
    it('should create a new cassandra client', function f(done) {
      this.timeout(20000);
      this.slow(10000);
      client = models.createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1'],
          keyspace: 'express_cassandra_tests_kspc1',
          queryOptions: { consistency: models.consistencies.one },
        },
        ormOptions: {
          defaultReplicationStrategy: {
            class: 'SimpleStrategy',
            replication_factor: 1,
          },
          dropTableOnSchemaChange: true,
          createKeyspace: true,
        },
      });

      client.connect((err) => {
        if (err) throw err;
        else done();
      });
    });
  });

  describe('#arbitrarily load schemas', () => {
    after(() => {
      client.close();
    });
    it('should load a schema from an object', (done) => {
      const tmp = client.loadSchema('tempSchema', {
        fields: {
          email: 'text',
          name: 'text',
        },
        key: ['email'],
      }, (err) => {
        if (err) throw err;
        tmp.should.equal(client.instance.tempSchema);
        done();
      });
    });
  });

  describe('#datatype validations', () => {
    it('should generate datatypes properly from utility functions', (done) => {
      const uuid = models.uuid();
      uuid.should.be.an.instanceof(models.datatypes.Uuid);
      const uuidFromStr = models.uuidFromString('003e073d-ec76-4dac-8b99-867a65db49cf');
      uuidFromStr.should.be.an.instanceof(models.datatypes.Uuid);
      uuidFromStr.equals(models.datatypes.Uuid.fromString('003e073d-ec76-4dac-8b99-867a65db49cf')).should.equal(true);
      const timeuuid = models.timeuuid();
      timeuuid.should.be.an.instanceof(models.datatypes.TimeUuid);
      const timeuuidFromDate = models.timeuuidFromDate(new Date('2013-01-01 00:05+0000'));
      timeuuidFromDate.should.be.an.instanceof(models.datatypes.TimeUuid);
      timeuuidFromDate.getDate().getTime().should.equal(new Date('2013-01-01 00:05+0000').getTime());
      const timeuuidFromStr = models.timeuuidFromString('50554d6e-29bb-11e5-b345-feff819cdc9f');
      timeuuidFromStr.should.be.an.instanceof(models.datatypes.TimeUuid);
      timeuuidFromStr.equals(models.datatypes.TimeUuid.fromString('50554d6e-29bb-11e5-b345-feff819cdc9f'))
        .should.equal(true);
      const minTimeuuid = models.minTimeuuid(new Date('2013-01-01 00:05+0000'));
      minTimeuuid.should.be.an.instanceof(models.datatypes.TimeUuid);
      minTimeuuid.toString().should.equal('e23f1e02-53a6-11e2-8080-808080808080');
      const maxTimeuuid = models.maxTimeuuid(new Date('2013-01-01 00:05+0000'));
      maxTimeuuid.should.be.an.instanceof(models.datatypes.TimeUuid);
      maxTimeuuid.toString().should.equal('e23f1e03-53a6-11e2-bf7f-7f7f7f7f7f7f');
      done();
    });
  });


  describe('#save', () => {
    it('should save data to without errors', function f(done) {
      this.timeout(5000);
      this.slow(1000);
      const revtimeMap = {};
      revtimeMap[new Date(currentTime)] = 'one';
      revtimeMap['2014-10-2 12:00'] = 'two';
      const alex = new models.instance.Person({
        userID: 1234,
        Name: 'Mahafuzur',
        age: -32,
        timeId: models.timeuuid(),
        info: { hello: 'world' },
        phones: ['123456', '234567'],
        emails: ['a@b.com', 'c@d.com'],
        timeMap: { one: currentTime, two: '2014-10-2 12:00' },
        revtimeMap,
        intMap: { one: 1, two: 2, three: 3 },
        stringMap: { one: '1', two: '2', three: '3' },
        timeList: [currentTime, '2014-10-2 12:00'],
        intList: [1, 2, 3],
        stringList: ['one', 'two', 'three'],
        timeSet: [currentTime],
        intSet: [1, 2, 3, 3],
        stringSet: ['one', 'two', 'three', 'three'],
        address: {
          city: 'Santa Clara',
          state: 'CA',
          street: '3975 Freedom Circle',
          zip: 95054,
          phones: [
            {
              alias: 'Masum',
              phone_number: '650-389-6000',
              country_code: 1,
            },
          ],
        },
        frozenMap: {
          hello: {
            city: 'Santa Clara',
            state: 'CA',
            street: '3975 Freedom Circle',
            zip: 95054,
            phones: [
              {
                alias: 'Masum',
                phone_number: '650-389-6000',
                country_code: 1,
              },
            ],
          },
        },
        active: true,
      });
      alex.save((err) => {
        if (err) {
          err.name.should.equal('apollo.model.save.invalidvalue');
          alex.age = 32;
          alex.save((err1) => {
            if (err1) {
              err1.name.should.equal('apollo.model.save.unsetrequired');
              alex.points = 64.0;
              alex.save((err2) => {
                if (err2) throw err2;
                done();
              });
            } else done(new Error('required rule is not working properly'));
          });
        } else done(new Error('validation rule is not working properly'));
      });
    });
  });

  describe('#find after save', () => {
    it('should find data as model instances without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        const person = people[0];
        person.Name.should.equal('Mahafuzur');
        person.surname.should.equal('no surname provided');
        person.completeName.should.equal('Mahafuzur');
        person.info.hello.should.equal('world');
        person.phones.length.should.equal(2);
        person.phones[0].should.equal('123456');
        person.phones[1].should.equal('234567');
        person.emails.length.should.equal(2);
        person.emails[0].should.equal('a@b.com');
        person.emails[1].should.equal('c@d.com');
        person.address.city.should.equal('Santa Clara');
        person.address.state.should.equal('CA');
        person.address.street.should.equal('3975 Freedom Circle');
        person.address.zip.should.equal(95054);
        person.address.phones[0].alias.should.equal('Masum');
        person.address.phones[0].phone_number.should.equal('650-389-6000');
        person.address.phones[0].country_code.should.equal(1);
        person.frozenMap.hello.phones[0].country_code.should.equal(1);
        person.active.should.equal(true);
        person.points.should.approximately(64.0, 0.1);
        person.uniId.toString().length.should.equal(36);
        person.timeId.toString().length.should.equal(36);
        should.exist(person.createdAt);
        // test virtual field
        person.ageString.should.equal('32');
        person.ageString = '50';
        person.age.should.equal(50);
        // test composite types
        person.timeMap.one.should.deep.equal(new Date(currentTime));
        person.revtimeMap[new Date(currentTime).toString()].should.equal('one');
        person.timeList[0].should.deep.equal(new Date(currentTime));
        person.timeSet.should.have.deep.members([new Date(currentTime)]);
        person.intMap.should.deep.equal({ one: 1, two: 2, three: 3 });
        person.stringMap.should.deep.equal({ one: '1', two: '2', three: '3' });
        person.intList.should.have.members([1, 2, 3]);
        person.stringList.should.have.members(['one', 'two', 'three']);
        person.intSet.should.have.members([1, 2, 3]);
        person.stringSet.should.have.members(['one', 'two', 'three']);
        should.exist(person._validators);
        // test composite defaults
        person.intMapDefault.should.deep.equal({ one: 1, two: 2 });
        person.stringListDefault.should.have.members(['one', 'two']);
        person.intSetDefault.should.have.members([1, 2]);
        done();
      });
    });
  });

  describe('#find with raw set to true', () => {
    it('should find raw data as saved without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, { raw: true }, (err, people) => {
        if (err) throw err;
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

  describe('#findOne after save', () => {
    it('should find a single data object without errors', (done) => {
      models.instance.Person.findOne({ userID: 1234, age: 32 }, (err, user) => {
        if (err) throw err;
        user.Name.should.equal('Mahafuzur');
        user.info.hello.should.equal('world');
        user.phones[1].should.equal('234567');
        user.emails[1].should.equal('c@d.com');
        done();
      });
    });
  });

  describe('#findOne with selected columns', () => {
    it('should find a row with only selected columns', (done) => {
      models.instance.Person.findOne({ userID: 1234, age: 32 }, { select: ['Name as name', 'info'] }, (err, user) => {
        if (err) throw err;
        user.name.should.equal('Mahafuzur');
        user.info.hello.should.equal('world');
        should.not.exist(user.phones);
        should.not.exist(user.emails);
        done();
      });
    });
  });

  describe('#findOne with udf, uda and builtin aggregate functions', () => {
    it('should find a row with only selected columns', (done) => {
      models.instance.Person.findOne(
        { userID: 1234 },
        { select: ['fLog(points)', 'sum(age)', 'average(age)'] },
        (err, user) => {
          if (err) throw err;
          user['express_cassandra_tests_kspc1.flog(points)'].should.approximately(4.16, 0.01);
          user['system.sum(age)'].should.equal(32);
          user['express_cassandra_tests_kspc1.average(age)'].should.equal(32);
          done();
        });
    });
  });

  describe('#find with $gt and $lt operator', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: { $gt: 31, $lt: 35 } }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        done();
      });
    });
  });

  describe('#find with $in operator', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find({ userID: { $in: [1234, 1235] }, age: 32 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        done();
      });
    });
  });

  describe('#find with $token operator', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find({ userID: { $token: { $gt: 1235, $lte: 1234 } }, $limit: 1 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        done();
      });
    });
  });

  describe('#find with $token operator for composite key', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find(
        { 'userID,age': { $token: { $gte: [1234, 32] } } },
        { materialized_view: 'mat_view_composite', raw: true },
        (err, people) => {
          if (err) throw err;
          people.length.should.equal(1);
          people[0].Name.should.equal('Mahafuzur');
          done();
        });
    });
  });

  describe('#find with raw driver', () => {
    it('should not through any errors', (done) => {
      models.instance.Person.get_cql_client((err, clientDriver) => {
        if (err) throw err;
        clientDriver.eachRow('Select * from person limit 10', [], { autoPage: true }, () => {}, (err1) => {
          if (err1) throw err1;
          done();
        });
      });
    });
  });

  describe('#find using secondary index', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find({ Name: 'Mahafuzur' }, { raw: true }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
  });

  describe('#find using indexed collections', () => {
    it('should find data in a list using $contains', (done) => {
      models.instance.Person.find({ phones: { $contains: '234567' } }, { raw: true }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a set using $contains', (done) => {
      models.instance.Person.find({ emails: { $contains: 'c@d.com' } }, { raw: true }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a map using $contains_key', (done) => {
      models.instance.Person.find({ info: { $contains_key: 'hello' } }, { raw: true }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a map using $contains entries', (done) => {
      models.instance.Person.find({ info: { $contains: { hello: 'world' } } }, { raw: true }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a map using $contains values', (done) => {
      models.instance.Person.find({ info: { $contains: 'world' } }, { raw: true }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a frozen map using full index', (done) => {
      models.instance.Person.find({
        frozenMap: {
          hello: {
            city: 'Santa Clara',
            state: 'CA',
            street: '3975 Freedom Circle',
            zip: 95054,
            phones: [
              {
                alias: 'Masum',
                phone_number: '650-389-6000',
                country_code: 1,
              },
            ],
          },
        },
      }, { raw: true }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
  });

  describe('#find using stream', () => {
    it('should stream data without errors', (done) => {
      models.instance.Person.stream({ Name: 'Mahafuzur' }, (reader) => {
        let row = reader.readRow();
        while (row) {
          row.Name.should.equal('Mahafuzur');
          row = reader.readRow();
        }
      }, (err) => {
        if (err) throw err;
        done();
      });
    });

    it('should stream data from materialized_view without errors', (done) => {
      models.instance.Person.stream(
        { userID: 1234, age: 32, active: true },
        { materialized_view: 'mat_view_composite' }, (reader) => {
          let row = reader.readRow();
          while (row) {
            row.Name.should.equal('Mahafuzur');
            row = reader.readRow();
          }
        }, (err) => {
          if (err) throw err;
          done();
        });
    });
  });

  describe('#find using eachRow', () => {
    it('should stream data using eachRow without errors', (done) => {
      models.instance.Person.eachRow({ Name: 'Mahafuzur' }, { fetchSize: 100 }, (n, row) => {
        row.Name.should.equal('Mahafuzur');
      }, (err, result) => {
        if (err) throw err;
        if (result.nextPage) {
          result.nextPage();
        } else done();
      });
    });

    it('should stream data using eachRow from materialized view without errors', (done) => {
      models.instance.Person.eachRow(
        { userID: 1234, age: 32, active: true },
        { fetchSize: 100, materialized_view: 'mat_view_composite' }, (n, row) => {
          row.Name.should.equal('Mahafuzur');
        }, (err, result) => {
          if (err) throw err;
          if (result.nextPage) {
            result.nextPage();
          } else done();
        });
    });
  });

  describe('#update', () => {
    it('should update data on db without errors', (done) => {
      models.instance.Person.update(
        { userID: 1234, age: 32 },
        { Name: 1, info: { new: 'addition' }, phones: ['56788'], emails: ['c@d.com'] },
        (err) => {
          if (err) {
            err.name.should.equal('apollo.model.update.invalidvalue');
            models.instance.Person.update(
              { userID: 1234, age: 32 },
              {
                Name: 'Stupid',
                timeId: models.timeuuid(),
                info: { new: 'addition' },
                phones: ['56788'],
                emails: ['c@d.com'],
                active: false,
              },
              (err1) => {
                if (err1) throw err1;
                done();
              }
            );
          } else done(new Error('validation rule is not working properly'));
        });
    });
  });

  describe('#find after update', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        const person = people[0];
        person.Name.should.equal('Stupid');
        should.not.exist(person.info.hello);
        person.info.new.should.equal('addition');
        person.phones.length.should.equal(1);
        person.phones[0].should.equal('56788');
        person.emails.length.should.equal(1);
        person.emails[0].should.equal('c@d.com');
        person.active.should.equal(false);
        person.timeId.toString().length.should.equal(36);
        should.exist(person.intSetDefault);
        done();
      });
    });
  });

  describe('#update using null', () => {
    it('should update data on db without errors', (done) => {
      models.instance.Person.update(
        { userID: 1234, age: 32 },
        { intSetDefault: null },
        (err) => {
          if (err) throw err;
          done();
        });
    });
  });

  describe('#find after update with null', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        const person = people[0];
        should.not.exist(person.intSetDefault);
        done();
      });
    });
  });

  describe('#update collections with $add', () => {
    it('should update data on db without errors', (done) => {
      models.instance.Person.update(
        { userID: 1234, age: 32 },
        { info: { $add: { new2: 'addition2' } }, phones: { $add: ['12345'] }, emails: { $add: ['e@f.com'] } },
        (err) => {
          if (err) throw err;
          done();
        });
    });
  });

  describe('#find after update collections with $add', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].info.new.should.equal('addition');
        people[0].info.new2.should.equal('addition2');
        people[0].phones.length.should.equal(2);
        people[0].phones[0].should.equal('56788');
        people[0].phones[1].should.equal('12345');
        people[0].emails.length.should.equal(2);
        people[0].emails[0].should.equal('c@d.com');
        people[0].emails[1].should.equal('e@f.com');
        done();
      });
    });
  });

  describe('#update list with $prepend', () => {
    it('should update data on db without errors', (done) => {
      models.instance.Person.update({ userID: 1234, age: 32 }, { phones: { $prepend: ['654532'] } }, (err) => {
        if (err) throw err;
        done();
      });
    });
  });

  describe('#find after update list with $prepend', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].phones.length.should.equal(3);
        people[0].phones[0].should.equal('654532');
        people[0].phones[1].should.equal('56788');
        people[0].phones[2].should.equal('12345');
        done();
      });
    });
  });

  describe('#update collections with $replace', () => {
    it('should update data on db without errors', (done) => {
      models.instance.Person.update(
        { userID: 1234, age: 32 },
        { info: { $replace: { new: 'addition_replaced' } }, phones: { $replace: [1, '23456'] } },
        (err) => {
          if (err) throw err;
          done();
        });
    });
  });

  describe('#find after update collections with $replace', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        people[0].info.new.should.equal('addition_replaced');
        people[0].phones[1].should.equal('23456');
        done();
      });
    });
  });

  describe('#update collections with $remove', () => {
    it('should update data on db without errors', (done) => {
      models.instance.Person.update(
        { userID: 1234, age: 32 },
        { info: { $remove: { new2: '' } }, phones: { $remove: ['23456'] }, emails: { $remove: ['e@f.com'] } },
        (err) => {
          if (err) throw err;
          done();
        });
    });
  });

  describe('#find after update collections with $remove', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(1);
        const person = people[0];
        person.info.new.should.equal('addition_replaced');
        should.not.exist(person.info.new2);
        person.phones.length.should.equal(2);
        person.phones[0].should.equal('654532');
        person.phones[1].should.equal('12345');
        person.emails.length.should.equal(1);
        person.emails[0].should.equal('c@d.com');
        done();
      });
    });
  });

  describe('#instance update after find', () => {
    it('should find and update single data object without errors', (done) => {
      models.instance.Person.findOne({ userID: 1234, age: 32 }, (err, user) => {
        if (err) throw err;
        user.Name = 'Updated Stupid';
        user.timeId = models.timeuuid();
        user.timeMap.three = currentTime;
        user.save((err1) => {
          if (err1) throw err1;
          models.instance.Person.findOne({ userID: 1234, age: 32 }, (err2, userNew) => {
            if (err2) throw err2;
            userNew.Name.should.equal('Updated Stupid');
            userNew.timeMap.three.should.deep.equal(new Date(currentTime));
            userNew.timeId.toString().length.should.equal(36);
            done();
          });
        });
      });
    });
  });

  describe('#instance delete after find', () => {
    it('should find and delete single data object without errors', (done) => {
      models.instance.Person.findOne({ userID: 1234, age: 32 }, (err, user) => {
        if (err) throw err;
        user.delete((err1) => {
          if (err1) throw err1;
          models.instance.Person.findOne({ userID: 1234, age: 32 }, (err2, userNew) => {
            if (err2) throw err2;
            should.not.exist(userNew);
            done();
          });
        });
      });
    });
  });

  describe('#delete', () => {
    it('should cleanup the db without errors', (done) => {
      models.instance.Person.delete({ userID: 1234, age: 32 }, (err) => {
        if (err) throw err;
        done();
      });
    });
  });

  describe('#find after delete', () => {
    it('should find all data as deleted', (done) => {
      models.instance.Person.find({ userID: 1234 }, (err, people) => {
        if (err) throw err;
        people.length.should.equal(0);
        done();
      });
    });
  });

  describe('#update counter column', () => {
    it('should increment the counter to 2', (done) => {
      models.instance.Counter.update(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visit_count: models.datatypes.Long.fromInt(2) },
        (err) => {
          if (err) throw err;
          models.instance.Counter.findOne({ user_id: models.datatypes.Long.fromInt(1234) }, (err1, stats) => {
            if (err1) throw err1;
            stats.visit_count.toString().should.equal('2');
            done();
          });
        });
    });

    it('should keep the counter unchanged', (done) => {
      models.instance.Counter.update(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visit_count: models.datatypes.Long.fromInt(0) },
        (err) => {
          if (err) throw err;
          models.instance.Counter.findOne({ user_id: models.datatypes.Long.fromInt(1234) }, (err1, stats) => {
            if (err1) throw err1;
            stats.visit_count.toString().should.equal('2');
            done();
          });
        });
    });

    it('should decrement the counter to 0', (done) => {
      models.instance.Counter.update(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visit_count: models.datatypes.Long.fromInt(-2) },
        (err) => {
          if (err) throw err;
          models.instance.Counter.findOne({ user_id: models.datatypes.Long.fromInt(1234) }, (err1, stats) => {
            if (err1) throw err1;
            stats.visit_count.toString().should.equal('0');
            done();
          });
        });
    });

    it('should increment the counter visitCount to 2', (done) => {
      models.instance.Counter.update(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visitCount: models.datatypes.Long.fromInt(2) },
        (err) => {
          if (err) throw err;
          models.instance.Counter.findOne({ user_id: models.datatypes.Long.fromInt(1234) }, (err1, stats) => {
            if (err1) throw err1;
            stats.visitCount.toString().should.equal('2');
            done();
          });
        });
    });

    it('should decrement the counter visitCount to 0', (done) => {
      models.instance.Counter.update(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visitCount: models.datatypes.Long.fromInt(-2) },
        (err) => {
          if (err) throw err;
          models.instance.Counter.findOne({ user_id: models.datatypes.Long.fromInt(1234) }, (err1, stats) => {
            if (err1) throw err1;
            stats.visitCount.toString().should.equal('0');
            done();
          });
        });
    });
  });

  describe('#raw batch queries', () => {
    it('should insert data properly', (done) => {
      const queries = [
        {
          query: 'INSERT INTO event (email, id, body, extra) VALUES (?, ?, ?, ?)',
          params: ['hello1@h.com', eventID, 'hello1', 'extra1'],
        },
        {
          query: 'INSERT INTO event (email, id, body, extra) VALUES (?, ?, ?, ?)',
          params: ['hello2@h.com', eventID, 'hello2', 'extra2'],
        },
      ];

      models.instance.Event.get_cql_client((err, cqlClient) => {
        if (err) throw err;
        cqlClient.batch(queries, { prepare: true }, (err1) => {
          if (err1) throw err1;
          done();
        });
      });
    });
  });

  describe('#find after raw batch events', () => {
    it('should find the event with email and timeuuid in query', (done) => {
      models.instance.Event.findOne({ email: 'hello1@h.com', id: eventID }, (err, event) => {
        if (err) throw err;
        models.instance.Event.findOne({ email: 'hello1@h.com', id: event.id }, (err1, event1) => {
          if (err1) throw err1;
          event1.body.should.equal('hello1');
          done();
        });
      });
    });
  });

  describe('#find using $like query on SASI index', () => {
    it('should find the events with like query', (done) => {
      models.instance.Event.find({ body: { $like: '%ello%' } }, (err, events) => {
        if (err) throw err;
        events[0].body.should.equal('hello1');
        events.length.should.equal(2);
        models.instance.Event.find({ extra: { $like: 'extra%' } }, (err1, events1) => {
          if (err1) throw err1;
          events1[0].extra.should.equal('extra1');
          events1.length.should.equal(2);
          done();
        });
      });
    });
  });

  describe('#find using $expr query on custom index', () => {
    it('should wait for 3 seconds while lucene index builds', function f(done) {
      this.timeout(5000);
      this.slow(4000);
      setTimeout(() => {
        done();
      }, 3000);
    });
    it('should find the events with index expression query', (done) => {
      models.instance.Event.find({ $expr: {
        index: 'event_lucene_idx',
        query: '{' +
          'filter: [' +
              '{type: "prefix", field: "body", value: "hello"}' +
          '],' +
          'query: {type: "match", field: "extra", value: "extra1"}' +
        '}',
      } }, (err, events) => {
        if (err) throw err;
        events.length.should.equal(1);
        events[0].body.should.equal('hello1');
        events[0].extra.should.equal('extra1');
        done();
      });
    });
    it('index expression query should escape properly in presense of single quote', (done) => {
      models.instance.Event.find({ $expr: {
        index: 'event_lucene_idx',
        query: '{' +
          'filter: [' +
              '{type: "prefix", field: "body", value: "hello"}' +
          '],' +
          'query: {type: "phrase", field: "extra", value: "extra1\'s"}' +
        '}',
      } }, (err, events) => {
        if (err) throw err;
        events.length.should.equal(0);
        done();
      });
    });
  });

  describe('#verify if all inserted events went to the materialized view', () => {
    it('should find all the events filtered by id from materialized view', (done) => {
      models.instance.Event.find({ id: eventID }, { materialized_view: 'event_by_id' }, (err, events) => {
        if (err) throw err;
        events.length.should.equal(2);
        done();
      });
    });
  });

  describe('#testing instance update for an event object taken from materialized view', () => {
    it('should get an event by id and email from materialized view and instance update it', (done) => {
      models.instance.Event.findOne(
        { id: eventID, email: 'hello1@h.com' },
        { materialized_view: 'event_by_id' },
        (err, event) => {
          if (err) throw err;
          event.body = 'hello1 updated';
          event.save(() => {
            models.instance.Event.findOne({ id: eventID, email: 'hello1@h.com' }, (err1, eventUpdated) => {
              if (err1) throw err1;
              eventUpdated.body.should.equal('hello1 updated');
              // check if the extra section that is not part of the materialized view
              // is kept intact by the save operation
              eventUpdated.extra.should.equal('extra1');

              // check also if the materialized view has updated
              models.instance.Event.findOne(
                { id: eventID, email: 'hello1@h.com' },
                { materialized_view: 'event_by_id' },
                (err2, eventUpdated1) => {
                  if (err2) throw err2;
                  eventUpdated1.body.should.equal('hello1 updated');
                  done();
                });
            });
          });
        });
    });
  });

  describe('#orm batch queries', () => {
    it('should pass blank queries without error', (done) => {
      const queries = [];

      models.doBatch(queries, (err) => {
        if (err) throw err;
        done();
      });
    });
    it('should pass single query without error', (done) => {
      const queries = [];

      const event = new models.instance.Event({
        email: 'hello3@h.com',
        id: eventID,
        body: 'hello3',
        tupletest: new models.datatypes.Tuple(3, 'bar', 2.1),
      });

      queries.push(event.save({ return_query: true }));

      models.doBatch(queries, (err) => {
        if (err) throw err;
        done();
      });
    });
    it('should save, update and delete in batch properly', (done) => {
      const queries = [];

      const event = new models.instance.Event({
        email: 'hello3@h.com',
        id: eventID,
        body: 'hello3',
        tupletest: new models.datatypes.Tuple(3, 'bar', 2.1),
      });

      queries.push(event.save({ return_query: true }));
      queries.push(models.instance.Event.update(
        { email: 'hello1@h.com', id: eventID },
        { body: 'hello1 updated again' },
        { return_query: true })
      );
      queries.push(models.instance.Event.delete({ email: 'hello2@h.com', id: eventID }, { return_query: true }));

      models.doBatch(queries, (err) => {
        if (err) throw err;
        done();
      });
    });
  });

  describe('#find with distinct set to true', () => {
    it('should find distinct data as saved without errors', (done) => {
      models.instance.Event.find({}, { select: ['email'], distinct: true }, (err, event) => {
        if (err) throw err;
        event.length.should.equal(2);
        done();
      });
    });
  });

  describe('#verify orm batch modifications on table and materialized view', () => {
    it('should find modifications reflected in events', (done) => {
      models.instance.Event.find({ $limit: 10 }, (err, events) => {
        if (err) throw err;
        events.length.should.equal(2);
        events[0].body.should.equal('hello1 updated again');
        events[1].body.should.equal('hello3');

        const tupleValues = events[1].tupletest.values();
        tupleValues[0].should.equal(3);
        tupleValues[1].should.equal('bar');
        tupleValues[2].should.approximately(2.1, 0.1);

        done();
      });
    });

    it('should find modifications reflected in materialized view', (done) => {
      models.instance.Event.find(
        { id: eventID, $orderby: { $asc: 'email' } },
        { materialized_view: 'event_by_id', raw: true }, (err, events) => {
          if (err) throw err;
          events.length.should.equal(2);
          events[0].body.should.equal('hello1 updated again');
          events[1].body.should.equal('hello3');

          done();
        });
    });
  });

  describe('#find all remaining events and delete using orm batch', () => {
    it('should find remaining events and delete them', (done) => {
      models.instance.Event.find({ $limit: 10 }, (err, events) => {
        if (err) throw err;

        const queries = [];

        for (let i = 0; i < events.length; i++) {
          queries.push(events[i].delete({ return_query: true }));
        }

        models.doBatch(queries, (err1) => {
          if (err1) throw err1;
          done();
        });
      });
    });
  });

  describe('#verify all events are deleted', () => {
    it('should find all the events deleted from table', (done) => {
      models.instance.Event.find({ $limit: 10 }, (err, events) => {
        if (err) throw err;
        events.length.should.equal(0);
        done();
      });
    });
  });

  describe('#verify events are deleted from materialized view', () => {
    it('should find all the events deleted from materialized view', (done) => {
      models.instance.Event.find({ id: eventID }, { materialized_view: 'event_by_id' }, (err, events) => {
        if (err) throw err;
        events.length.should.equal(0);
        done();
      });
    });
  });

  describe('#toJSON returns object with model fields only', () => {
    it('should return the object for new model instance', () => {
      const simple = new models.instance.Simple({ foo: 'bar' });
      simple.toJSON().should.deep.eq({
        foo: 'bar',
        bar: 'baz',
      });
      JSON.stringify(simple).should.eq('{"foo":"bar","bar":"baz"}');
      should.exist(simple._validators);
    });

    it('should return the object for fetched model', (done) => {
      const simple = new models.instance.Simple({ foo: 'bar' });
      simple.save((err) => {
        if (err) throw err;
        models.instance.Simple.findOne({}, (err1, simpleModel) => {
          if (err1) throw err1;
          simpleModel.toJSON().should.deep.eq({
            foo: 'bar',
            bar: 'baz',
          });
          JSON.stringify(simpleModel).should.eq('{"foo":"bar","bar":"baz"}');
          should.exist(simpleModel._validators);
          simpleModel.delete((err2) => {
            if (err2) throw err2;
            done();
          });
        });
      });
    });
  });

  describe('#close cassandra connection', () => {
    it('should close connection to cassandra without errors', (done) => {
      models.close((err) => {
        if (err) throw err;
        done();
      });
    });
  });
});
