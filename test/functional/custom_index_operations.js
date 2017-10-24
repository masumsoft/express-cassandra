const models = require('../../lib/expressCassandra');

module.exports = () => {
  describe('#find using $like query on SASI index', () => {
    it('should find the events with like query', (done) => {
      models.instance.Event.findAsync({ body: { $like: '%ello%' } })
        .then((events) => {
          events[0].body.should.equal('hello1');
          events.length.should.equal(2);
          return models.instance.Event.findAsync({ extra: { $like: 'extra%' } });
        })
        .then((events1) => {
          events1[0].extra.should.equal('extra1');
          events1.length.should.equal(2);
          done();
        })
        .catch((err) => {
          done(err);
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
      models.instance.Event.find({
        $expr: {
          index: 'event_lucene_idx',
          query: '{' +
            'filter: [' +
                '{type: "prefix", field: "body", value: "hello"}' +
            '],' +
            'query: {type: "match", field: "extra", value: "extra1"}' +
          '}',
        },
      }, (err, events) => {
        if (err) done(err);
        events.length.should.equal(1);
        events[0].body.should.equal('hello1');
        events[0].extra.should.equal('extra1');
        done();
      });
    });
    it('index expression query should escape properly in presense of single quote', (done) => {
      models.instance.Event.find({
        $expr: {
          index: 'event_lucene_idx',
          query: '{' +
            'filter: [' +
                '{type: "prefix", field: "body", value: "hello"}' +
            '],' +
            'query: {type: "phrase", field: "extra", value: "extra1\'s"}' +
          '}',
        },
      }, (err, events) => {
        if (err) done(err);
        events.length.should.equal(0);
        done();
      });
    });
  });
};
