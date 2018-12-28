const chai = require('chai');

const models = require('../../lib/expressCassandra');

const currentTime = Date.now();
const should = chai.should();

module.exports = () => {
  describe('#truncate table', () => {
    it('should truncate all data in the models', function f(done) {
      this.timeout(10000);
      this.slow(5000);
      models.instance.Person.truncateAsync()
        .then(() => models.instance.Counter.truncateAsync())
        .then(() => models.instance.Event.truncateAsync())
        .then(() => models.instance.Simple.truncateAsync())
        .then(() => models.instance.MultipleOrderBy.truncateAsync())
        .then(() => models.instance.SampleGroupBy.truncateAsync())
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#save', () => {
    let alex;
    it('should throw validation error due to rule validator', function f(done) {
      this.timeout(5000);
      this.slow(1000);
      const revtimeMap = {};
      revtimeMap[new Date(currentTime)] = 'one';
      revtimeMap['2014-10-2 12:00'] = 'two';
      alex = new models.instance.Person({
        userID: 1234,
        Name: 'Mahafuzur',
        ageString: '-32',
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
        active: false,
        timestamp: { $db_function: 'toTimestamp(now())' },
      });
      alex.isModified().should.equal(true);
      alex.isModified('userID').should.equal(true);
      alex.isModified('address').should.equal(true);
      alex.isModified('someNonExistingField').should.equal(false);
      alex.save((err) => {
        if (err) {
          err.name.should.equal('apollo.model.validator.invalidvalue');
          return done();
        }
        return done(new Error('validation rule is not working properly'));
      });
    });

    it('should throw unset error due to required field', (done) => {
      alex.age = 32;
      alex.isModified().should.equal(true);
      alex.isModified('userID').should.equal(true);
      alex.isModified('address').should.equal(true);
      alex.save((err1) => {
        if (err1) {
          err1.name.should.equal('apollo.model.save.unsetrequired');
          return done();
        }
        return done(new Error('required rule is not working properly'));
      });
    });

    it('should save data without errors', (done) => {
      alex.points = 64.0;
      alex.saveAsync()
        .then(() => {
          done();
        })
        .catch((err2) => {
          done(err2);
        });
    });

    it('save should set isModified properly', (done) => {
      alex.isModified().should.equal(false);
      alex.isModified('userID').should.equal(false);
      alex.isModified('address').should.equal(false);
      alex.Name = 'Alex';
      alex.save({ if_not_exist: true }, (err3) => {
        if (err3) {
          done(err3);
        }
        alex.isModified('Name').should.equal(true);
        done();
      });
    });
  });

  describe('#find after save', () => {
    it('should find data as model instances without errors', (done) => {
      // eslint-disable-next-line max-statements
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) done(err);
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
        should.exist(person.timestamp);
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
        person.isModified().should.equal(false);
        person.Name = 'john';
        person.isModified('Name').should.equal(true);
        person.isModified('age').should.equal(false);
        person.isModified().should.equal(true);
        person.getName().should.equal('john');
        person.get_table_name().should.equal('person');
        // test auto timestamp fields
        should.exist(person.created_at);
        should.exist(person.updatedAt);
        (person.updatedAt - person.created_at).should.be.lessThan(2);
        // test auto version fields
        person.__v.toString().length.should.equal(36);
        done();
      });
    });
  });

  describe('#find with raw set to true', () => {
    it('should find raw data as saved without errors', (done) => {
      models.instance.Person.findAsync({ userID: 1234, age: 32 }, { raw: true })
        .then((people) => {
          people.length.should.equal(1);
          people[0].Name.should.equal('Mahafuzur');
          people[0].info.hello.should.equal('world');
          people[0].phones[1].should.equal('234567');
          people[0].emails[1].should.equal('c@d.com');
          should.not.exist(people[0]._validators);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#findOne after save', () => {
    it('should find a single data object without errors', (done) => {
      models.instance.Person.findOne({ userID: 1234, age: 32 }, (err, user) => {
        if (err) done(err);
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
      models.instance.Person.findOneAsync({ userID: 1234, age: 32 }, { select: ['Name as name', 'info'] })
        .then((user) => {
          user.name.should.equal('Mahafuzur');
          user.info.hello.should.equal('world');
          should.not.exist(user.phones);
          should.not.exist(user.emails);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#findOne with udf, uda and builtin aggregate functions', () => {
    it('should find a row with only selected columns', (done) => {
      models.instance.Person.findOne(
        { userID: 1234 },
        { select: ['fLog(points) as flogPoints', 'sum(age)', 'average(age)', 'udfSum(points, age)', 'udfSum(points, age) as udfsum'] },
        (err, user) => {
          if (err) done(err);
          user.flogPoints.should.approximately(4.16, 0.01);
          user['system.sum(age)'].should.equal(32);
          user['express_cassandra_tests_kspc1.average(age)'].should.equal(32);
          user['express_cassandra_tests_kspc1.udfsum(points, age)'].should.approximately(96.0, 0.01);
          user.udfsum.should.approximately(96.0, 0.01);
          done();
        },
      );
    });
  });

  describe('#find with $gt and $lt operator', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: { $gt: 31, $lt: 35 } }, (err, people) => {
        if (err) done(err);
        people.length.should.equal(1);
        done();
      });
    });
  });

  describe('#find with $in operator', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find({ userID: { $in: [1234, 1235, 0] }, age: 32 }, (err, people) => {
        if (err) done(err);
        people.length.should.equal(1);
        done();
      });
    });
  });

  describe('#find with $token operator', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find({ userID: { $token: { $gt: 1235, $lte: 1234 } }, $limit: 1 }, (err, people) => {
        if (err) done(err);
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
          if (err) done(err);
          people.length.should.equal(1);
          people[0].Name.should.equal('Mahafuzur');
          done();
        },
      );
    });
  });

  describe('#find using secondary index', () => {
    it('should find data as saved without errors', (done) => {
      models.instance.Person.find({ Name: 'Mahafuzur' }, { raw: true }, (err, people) => {
        if (err) done(err);
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
  });

  describe('#find using indexed collections', () => {
    it('should find data in a list using $contains', (done) => {
      models.instance.Person.find({ phones: { $contains: '234567' } }, { raw: true }, (err, people) => {
        if (err) done(err);
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a set using $contains', (done) => {
      models.instance.Person.find({ emails: { $contains: 'c@d.com' } }, { raw: true }, (err, people) => {
        if (err) done(err);
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a map using $contains_key', (done) => {
      models.instance.Person.find({ info: { $contains_key: 'hello' } }, { raw: true }, (err, people) => {
        if (err) done(err);
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a map using $contains entries', (done) => {
      models.instance.Person.find({ info: { $contains: { hello: 'world' } } }, { raw: true }, (err, people) => {
        if (err) done(err);
        people.length.should.equal(1);
        people[0].Name.should.equal('Mahafuzur');
        done();
      });
    });
    it('should find data in a map using $contains values', (done) => {
      models.instance.Person.find({ info: { $contains: 'world' } }, { raw: true }, (err, people) => {
        if (err) done(err);
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
        if (err) done(err);
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
        if (err) done(err);
        done();
      });
    });

    it('should stream data from materialized_view without errors', (done) => {
      models.instance.Person.streamAsync(
        { userID: 1234, age: 32, active: true },
        { materialized_view: 'mat_view_composite' }, (reader) => {
          let row = reader.readRow();
          while (row) {
            row.Name.should.equal('Mahafuzur');
            row = reader.readRow();
          }
        },
      )
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#find using eachRow', () => {
    it('should stream data using eachRow without errors', (done) => {
      models.instance.Person.eachRow({ Name: 'Mahafuzur' }, { fetchSize: 100 }, (n, row) => {
        row.Name.should.equal('Mahafuzur');
      }, (err, result) => {
        if (err) done(err);
        if (result.nextPage) {
          result.nextPage();
        } else done();
      });
    });

    it('should stream data using eachRow from materialized view without errors', (done) => {
      models.instance.Person.eachRowAsync(
        { userID: 1234, age: 32, active: true },
        { fetchSize: 100, materialized_view: 'mat_view_composite' }, (n, row) => {
          row.Name.should.equal('Mahafuzur');
        },
      )
        .then((result) => {
          if (result.nextPage) {
            result.nextPage();
          } else done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#update', () => {
    it('should throw validation error due to type validator', (done) => {
      models.instance.Person.update(
        { userID: 1234, age: 32 },
        {
          Name: 1,
          info: { new: 'addition' },
          phones: ['56788'],
          emails: ['c@d.com'],
        },
        (err) => {
          if (err) {
            err.name.should.equal('apollo.model.validator.invalidvalue');
            return done();
          }
          return done(new Error('validation rule is not working properly'));
        },
      );
    });

    it('should update data on db without errors', (done) => {
      models.instance.Person.update(
        { userID: 1234, age: 32 },
        {
          Name: 'Stupid',
          timeId: models.timeuuid(),
          info: { new: 'addition' },
          phones: ['56788'],
          emails: ['c@d.com'],
          active: false,
          timestamp: { $db_function: 'toTimestamp(now())' },
        },
        (err1) => {
          if (err1) done(err1);
          done();
        },
      );
    });
  });

  describe('#find after update', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) done(err);
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
        should.exist(person.timestamp);
        // test auto timestamp fields
        should.exist(person.created_at);
        should.exist(person.updatedAt);
        (person.updatedAt - person.created_at).should.be.greaterThan(1);
        // test auto version fields
        person.__v.toString().length.should.equal(36);
        done();
      });
    });
  });

  describe('#update using null', () => {
    it('should update data on db without errors', (done) => {
      models.instance.Person.updateAsync(
        { userID: 1234, age: 32 },
        { intSetDefault: null },
      )
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#update using conditional light weight transactions', () => {
    it('should update data using if_exists without errors', (done) => {
      models.instance.Person.updateAsync(
        { userID: 1234, age: 32 },
        { intSetDefault: null },
        { if_exists: true },
      )
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should update data using conditions without errors', (done) => {
      models.instance.Person.updateAsync(
        { userID: 1234, age: 32 },
        { intSetDefault: null },
        { conditions: { intSetDefault: { $ne: null } } },
      )
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#find after update with null', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) done(err);
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
          if (err) done(err);
          done();
        },
      );
    });
  });

  describe('#find after update collections with $add', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) done(err);
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
        if (err) done(err);
        done();
      });
    });
  });

  describe('#find after update list with $prepend', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) done(err);
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
          if (err) done(err);
          done();
        },
      );
    });
  });

  describe('#find after update collections with $replace', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) done(err);
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
          if (err) done(err);
          done();
        },
      );
    });
  });

  describe('#find after update collections with $remove', () => {
    it('should find data as updated without errors', (done) => {
      models.instance.Person.find({ userID: 1234, age: 32 }, (err, people) => {
        if (err) done(err);
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
      let previousVersion;
      let previousCreatedAt;
      let previousUpdatedAt;
      models.instance.Person.findOneAsync({ userID: 1234, age: 32 })
        .then((user) => {
          previousVersion = user.__v;
          previousCreatedAt = user.created_at;
          previousUpdatedAt = user.updatedAt;
          user.Name = 'Updated Stupid';
          user.timeId = models.timeuuid();
          user.timeMap.three = currentTime;
          return user.saveAsync();
        })
        .then(() => models.instance.Person.findOneAsync({ userID: 1234, age: 32 }))
        .then((userNew) => {
          userNew.Name.should.equal('Updated Stupid');
          userNew.timeMap.three.should.deep.equal(new Date(currentTime));
          userNew.timeId.toString().length.should.equal(36);
          // test auto timestamp fields
          userNew.created_at.should.eql(previousCreatedAt);
          (userNew.updatedAt - userNew.created_at).should.be.greaterThan(1);
          (userNew.updatedAt - previousUpdatedAt).should.be.greaterThan(1);
          // test auto version fields
          userNew.__v.toString().length.should.equal(36);
          userNew.__v.should.not.eql(previousVersion);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#instance delete after find', () => {
    it('should find and delete single data object without errors', (done) => {
      models.instance.Person.findOneAsync({ userID: 1234, age: 32 })
        .then((user) => user.deleteAsync())
        .then(() => models.instance.Person.findOneAsync({ userID: 1234, age: 32 }))
        .then((userNew) => {
          should.not.exist(userNew);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#delete', () => {
    it('should cleanup the db without errors', (done) => {
      models.instance.Person.deleteAsync({ userID: 1234, age: 32 })
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#find after delete', () => {
    it('should find all data as deleted', (done) => {
      models.instance.Person.find({ userID: 1234 }, (err, people) => {
        if (err) done(err);
        people.length.should.equal(0);
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
      simple.saveAsync()
        .then(() => models.instance.Simple.findOneAsync({}))
        .then((simpleModel) => {
          simpleModel.toJSON().should.deep.eq({
            foo: 'bar',
            bar: 'baz',
          });
          JSON.stringify(simpleModel).should.eq('{"foo":"bar","bar":"baz"}');
          should.exist(simpleModel._validators);
          return simpleModel.deleteAsync();
        })
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#find with $groupby', () => {
    let job1;
    let job2;
    let job3;

    before((done) => {
      job1 = new models.instance.SampleGroupBy({
        project_id: 1,
        job_id: 1,
        combinationId: 123,
      });

      job2 = new models.instance.SampleGroupBy({
        project_id: 1,
        job_id: 1,
        combinationId: 321,
      });

      job3 = new models.instance.SampleGroupBy({
        project_id: 1,
        job_id: 2,
        combinationId: 456,
      });

      job1.saveAsync()
        .then(() => job2.saveAsync())
        .then(() => job3.saveAsync())
        .then(() => done())
        .catch((err) => done(err));
    });

    after((done) => {
      models.instance.SampleGroupBy.truncateAsync()
        .then(() => done())
        .catch((err) => done(err));
    });

    it('should group results', (done) => {
      models.instance.SampleGroupBy.findAsync({ project_id: 1 }, {
        select: ['job_id', 'COUNT(job_id) as jcount'],
        $groupby: ['job_id'],
      })
        .then((res) => {
          res.length.should.equal(2);

          const [j1, j2] = res;

          j1.job_id.should.equal(2);
          j1.jcount.toString().should.equal('1');
          j2.job_id.should.equal(1);
          j2.jcount.toString().should.equal('2');
        })
        .then(() => done())
        .catch((err) => done(err));
    });

    it('should handle empty $groupby array', (done) => {
      models.instance.SampleGroupBy.findAsync({ project_id: 1 }, {
        select: ['job_id'],
        $groupby: [],
      })
        .then((res) => {
          res.length.should.equal(3);

          const [j1, j2, j3] = res;

          j1.job_id.should.equal(2);
          j2.job_id.should.equal(1);
          j3.job_id.should.equal(1);
        })
        .then(() => done())
        .catch((err) => done(err));
    });

    it('should handle multiple $groupby keys (including uppercased keys)', (done) => {
      models.instance.SampleGroupBy.findAsync({ project_id: 1 }, {
        select: ['job_id', 'COUNT(job_id) as jcount'],
        $groupby: ['job_id', 'combinationId'],
      })
        .then((res) => {
          res.length.should.equal(3);

          const [j1, j2, j3] = res;

          j1.job_id.should.equal(2);
          j1.jcount.toString().should.equal('1');
          j2.job_id.should.equal(1);
          j2.jcount.toString().should.equal('1');
          j3.job_id.should.equal(1);
          j3.jcount.toString().should.equal('1');
        })
        .then(() => done())
        .catch((err) => done(err));
    });
  });
};
