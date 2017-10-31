const models = require('../../lib/expressCassandra');

module.exports = () => {
  describe('#find with elassandra elastic client', () => {
    it('should wait for 3 seconds while elassandra index builds', function f(done) {
      this.timeout(5000);
      this.slow(4000);
      setTimeout(() => {
        done();
      }, 3000);
    });
    it('should find docs using elassandra index', (done) => {
      const esClient = models.instance.MultipleOrderBy.get_es_client();
      esClient.search({
        index: models.instance.MultipleOrderBy.get_keyspace_name(),
        type: models.instance.MultipleOrderBy.get_table_name(),
        q: 'first_name:John',
      }, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.hits.total.should.equal(2);
        done();
      });
    });
  });
};
