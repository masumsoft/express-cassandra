const models = require('../../lib/expressCassandra');

module.exports = () => {
  describe('#update counter column', () => {
    it('should increment the counter to 2', (done) => {
      models.instance.Counter.updateAsync(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visit_count: models.datatypes.Long.fromInt(2) },
      )
        .then(() => models.instance.Counter.findOneAsync({ user_id: models.datatypes.Long.fromInt(1234) }))
        .then((stats) => {
          stats.visit_count.toString().should.equal('2');
          done();
        })
        .catch((err) => {
          done(err);
        });
    });

    it('should keep the counter unchanged', (done) => {
      models.instance.Counter.updateAsync(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visit_count: models.datatypes.Long.fromInt(0) },
      )
        .then(() => models.instance.Counter.findOneAsync({ user_id: models.datatypes.Long.fromInt(1234) }))
        .then((stats) => {
          stats.visit_count.toString().should.equal('2');
          done();
        })
        .catch((err) => {
          done(err);
        });
    });

    it('should decrement the counter to 0', (done) => {
      models.instance.Counter.updateAsync(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visit_count: models.datatypes.Long.fromInt(-2) },
      )
        .then(() => models.instance.Counter.findOneAsync({ user_id: models.datatypes.Long.fromInt(1234) }))
        .then((stats) => {
          stats.visit_count.toString().should.equal('0');
          done();
        })
        .catch((err) => {
          done(err);
        });
    });

    it('should increment the counter visitCount to 2', (done) => {
      models.instance.Counter.updateAsync(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visitCount: models.datatypes.Long.fromInt(2) },
      )
        .then(() => models.instance.Counter.findOneAsync({ user_id: models.datatypes.Long.fromInt(1234) }))
        .then((stats) => {
          stats.visitCount.toString().should.equal('2');
          done();
        })
        .catch((err) => {
          done(err);
        });
    });

    it('should decrement the counter visitCount to 0', (done) => {
      models.instance.Counter.updateAsync(
        { user_id: models.datatypes.Long.fromInt(1234) },
        { visitCount: models.datatypes.Long.fromInt(-2) },
      )
        .then(() => models.instance.Counter.findOneAsync({ user_id: models.datatypes.Long.fromInt(1234) }))
        .then((stats) => {
          stats.visitCount.toString().should.equal('0');
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });
};
