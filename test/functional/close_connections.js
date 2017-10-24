const models = require('../../lib/expressCassandra');

module.exports = () => {
  describe('#close cassandra connection', () => {
    it('should close connection to cassandra without errors', (done) => {
      models.closeAsync()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });
};
