const chai = require('chai');

const models = require('../../lib/expressCassandra');

const should = chai.should();

module.exports = (eventID) => {
  describe('#orm batch queries', () => {
    it('should pass blank queries without error', (done) => {
      const queries = [];

      models.doBatch(queries, (err) => {
        if (err) done(err);
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
        if (err) done(err);
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
        { return_query: true },
      ));
      queries.push(models.instance.Event.delete({ email: 'hello2@h.com', id: eventID }, { return_query: true }));

      models.doBatchAsync(queries)
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#find with distinct set to true', () => {
    it('should find distinct data as saved without errors', (done) => {
      models.instance.Event.find({}, { select: ['email'], distinct: true }, (err, event) => {
        if (err) done(err);
        event.length.should.equal(2);
        done();
      });
    });
  });

  describe('#verify orm batch modifications on table and materialized view', () => {
    it('should find modifications reflected in events', (done) => {
      models.instance.Event.find({ $limit: 10 }, (err, events) => {
        if (err) done(err);
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
          if (err) done(err);
          events.length.should.equal(2);
          events[0].body.should.equal('hello1 updated again');
          events[1].body.should.equal('hello3');
          done();
        },
      );
    });
  });

  describe('#multipleorderby tests', () => {
    it('should insert and delete one entry to multipleorderby table', (done) => {
      const expectedRes = '{"user_id":"1234","status":"verified","timestamp":333,"first_name":"John"}';
      const usr = new models.instance.MultipleOrderBy({
        user_id: '1234',
        status: 'verified',
        timestamp: 333,
        first_name: 'John',
      });

      usr.saveAsync()
        .then(() => models.instance.MultipleOrderBy.findOneAsync({}))
        .then((multipleorderby) => {
          multipleorderby.toJSON().should.deep.eq({
            user_id: '1234',
            status: 'verified',
            timestamp: 333,
            first_name: 'John',
          });

          JSON.stringify(multipleorderby).should.eq(expectedRes);
          should.exist(multipleorderby._validators);
          return multipleorderby.deleteAsync();
        })
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });

    it('should insert data into batch', (done) => {
      const queries = [];
      const options = {
        return_query: true,
      };

      const template = {
        user_id: '1234',
        status: 'verified',
        timestamp: 333,
        first_name: 'John',
      };

      const usr1 = new models.instance.MultipleOrderBy(template);

      template.status = 'unverified';
      template.timestamp = 334;
      const usr2 = new models.instance.MultipleOrderBy(template);

      queries.push(usr1.save(options), usr2.save(options));

      models.doBatch(queries, (err1) => {
        if (err1) done(err1);
        done();
      });
    });

    it('should find data with multiple order by', (done) => {
      const query = {
        user_id: '1234',
        $orderby: {
          $asc: 'status',
          $desc: 'timestamp',
        },
      };

      models.instance.MultipleOrderBy.find(query, (err, results) => {
        if (err) done(err);

        const expectedRes1 = '{"user_id":"1234","status":"unverified","timestamp":334,"first_name":"John"}';
        const expectedRes2 = '{"user_id":"1234","status":"verified","timestamp":333,"first_name":"John"}';
        const length = results.length;

        length.should.eq(2);

        JSON.stringify(results[0]).should.eq(expectedRes1);
        JSON.stringify(results[1]).should.eq(expectedRes2);

        done();
      });
    });
  });

  describe('#find all remaining events and delete using orm batch', () => {
    it('should find remaining events and delete them', (done) => {
      models.instance.Event.findAsync({ $limit: 10 })
        .then((events) => {
          const queries = [];
          for (let i = 0; i < events.length; i++) {
            queries.push(events[i].delete({ return_query: true }));
          }
          return models.doBatchAsync(queries);
        })
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#verify all events are deleted', () => {
    it('should find all the events deleted from table', (done) => {
      models.instance.Event.find({ $limit: 10 }, (err, events) => {
        if (err) done(err);
        events.length.should.equal(0);
        done();
      });
    });
  });

  describe('#verify events are deleted from materialized view', () => {
    it('should find all the events deleted from materialized view', (done) => {
      models.instance.Event.find({ id: eventID }, { materialized_view: 'event_by_id' }, (err, events) => {
        if (err) done(err);
        events.length.should.equal(0);
        done();
      });
    });
  });
};
