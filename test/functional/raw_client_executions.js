const models = require('../../lib/expressCassandra');

module.exports = (eventID) => {
  describe('#find with raw driver', () => {
    it('should not through any errors', (done) => {
      models.instance.Person.get_cql_client((err, clientDriver) => {
        if (err) done(err);
        // eslint-disable-next-line max-nested-callbacks
        clientDriver.eachRow('Select * from person limit 10', [], { autoPage: true }, () => {}, (err1) => {
          if (err1) done(err1);
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
        if (err) done(err);
        // eslint-disable-next-line max-nested-callbacks
        cqlClient.batch(queries, { prepare: true }, (err1) => {
          if (err1) done(err1);
          done();
        });
      });
    });
  });

  describe('#find after raw batch events', () => {
    it('should find the event with email and timeuuid in query', (done) => {
      models.instance.Event.findOneAsync({ email: 'hello1@h.com', id: eventID })
        .then((event) => models.instance.Event.findOneAsync({ email: 'hello1@h.com', id: event.id }))
        .then((event1) => {
          event1.body.should.equal('hello1');
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });
};
