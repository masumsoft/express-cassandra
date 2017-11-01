const models = require('../../lib/expressCassandra');

module.exports = () => {
  describe('#fixture data export import', () => {
    it('should export all table data without errors', function f(done) {
      this.timeout(20000);
      this.slow(10000);
      models.exportAsync('test/fixtures')
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should import all table data without errors', function f(done) {
      this.timeout(20000);
      this.slow(10000);
      models.importAsync('test/fixtures', { batchSize: 10 })
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });
};
