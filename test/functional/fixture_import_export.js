const models = require('../../lib/expressCassandra');

module.exports = () => {
  describe('#fixture data export import', () => {
    it('should export all table data without errors', (done) => {
      models.exportAsync('test/fixtures')
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should import all table data without errors', (done) => {
      models.importAsync('test/fixtures')
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });
};
