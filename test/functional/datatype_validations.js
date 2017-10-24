const models = require('../../lib/expressCassandra');

module.exports = () => {
  describe('#datatype validations', () => {
    it('should generate datatypes properly from utility functions', (done) => {
      const uuid = models.uuid();
      uuid.should.be.an.instanceof(models.datatypes.Uuid);
      const uuidFromStr = models.uuidFromString('003e073d-ec76-4dac-8b99-867a65db49cf');
      uuidFromStr.should.be.an.instanceof(models.datatypes.Uuid);
      uuidFromStr.equals(models.datatypes.Uuid.fromString('003e073d-ec76-4dac-8b99-867a65db49cf')).should.equal(true);
      const timeuuid = models.timeuuid();
      timeuuid.should.be.an.instanceof(models.datatypes.TimeUuid);
      const timeuuidFromDate = models.timeuuidFromDate(new Date('2013-01-01 00:05+0000'));
      timeuuidFromDate.should.be.an.instanceof(models.datatypes.TimeUuid);
      timeuuidFromDate.getDate().getTime().should.equal(new Date('2013-01-01 00:05+0000').getTime());
      const timeuuidFromStr = models.timeuuidFromString('50554d6e-29bb-11e5-b345-feff819cdc9f');
      timeuuidFromStr.should.be.an.instanceof(models.datatypes.TimeUuid);
      timeuuidFromStr.equals(models.datatypes.TimeUuid.fromString('50554d6e-29bb-11e5-b345-feff819cdc9f'))
        .should.equal(true);
      const minTimeuuid = models.minTimeuuid(new Date('2013-01-01 00:05+0000'));
      minTimeuuid.should.be.an.instanceof(models.datatypes.TimeUuid);
      minTimeuuid.toString().should.equal('e23f1e02-53a6-11e2-8080-808080808080');
      const maxTimeuuid = models.maxTimeuuid(new Date('2013-01-01 00:05+0000'));
      maxTimeuuid.should.be.an.instanceof(models.datatypes.TimeUuid);
      maxTimeuuid.toString().should.equal('e23f1e03-53a6-11e2-bf7f-7f7f7f7f7f7f');
      done();
    });
  });
};
