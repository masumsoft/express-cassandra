const models = require('../../lib/expressCassandra');

module.exports = (eventID) => {
  describe('#verify if all inserted events went to the materialized view', () => {
    it('should find all the events filtered by id from materialized view', (done) => {
      models.instance.Event.find({ id: eventID }, { materialized_view: 'event_by_id' }, (err, events) => {
        if (err) done(err);
        events.length.should.equal(2);
        done();
      });
    });
  });

  describe('#testing instance update for an event object taken from materialized view', () => {
    it('should get an event by id and email from materialized view and instance update it', (done) => {
      models.instance.Event.findOneAsync(
        { id: eventID, email: 'hello1@h.com' },
        { materialized_view: 'event_by_id' },
      )
        .then((event) => {
          event.body = 'hello1 updated';
          return event.saveAsync();
        })
        .then(() => models.instance.Event.findOneAsync({ id: eventID, email: 'hello1@h.com' }))
        .then((eventUpdated) => {
          eventUpdated.body.should.equal('hello1 updated');
          // check if the extra section that is not part of the materialized view
          // is kept intact by the save operation
          eventUpdated.extra.should.equal('extra1');

          // check also if the materialized view has updated
          return models.instance.Event.findOneAsync(
            { id: eventID, email: 'hello1@h.com' },
            { materialized_view: 'event_by_id' },
          );
        })
        .then((eventUpdated1) => {
          eventUpdated1.body.should.equal('hello1 updated');
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });
};
