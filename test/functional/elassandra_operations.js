const models = require('../../lib/expressCassandra');

module.exports = () => {
  describe('#find with elassandra index', () => {
    it('should wait for 3 seconds while elassandra index builds', function f(done) {
      this.timeout(5000);
      this.slow(4000);
      setTimeout(() => {
        done();
      }, 3000);
    });
    it('should search docs using elassandra index without error', (done) => {
      models.instance.MultipleOrderBy.search({
        q: 'first_name:John',
        sort: ['timestamp:asc'],
      }, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.hits.total.should.equal(2);
        response.hits.hits[0]._source.timestamp.should.be.lessThan(response.hits.hits[1]._source.timestamp);
        done();
      });
    });
    it('should count docs using elastic client without error', (done) => {
      const esClient = models.instance.MultipleOrderBy.get_es_client();
      esClient.count({
        index: `${models.instance.MultipleOrderBy.get_keyspace_name()}_${models.instance.MultipleOrderBy.get_table_name()}`,
        type: models.instance.MultipleOrderBy.get_table_name(),
      }, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.count.should.equal(2);
        done();
      });
    });
  });
};
