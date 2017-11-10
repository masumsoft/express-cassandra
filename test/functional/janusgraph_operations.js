const chai = require('chai');

const models = require('../../lib/expressCassandra');

const should = chai.should();

module.exports = () => {
  describe('#janusgraph operations', () => {
    let vertex;
    it('should create a vertex without error', function f(done) {
      this.timeout(5000);
      this.slow(1000);
      models.instance.Person.createVertex({ userId: 1234, name: 'john', age: 32 }, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        vertex = response;
        done();
      });
    });
    it('should get the vertex without error', (done) => {
      models.instance.Person.getVertex(vertex.id, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.should.deep.equal(vertex);
        done();
      });
    });
    it('should update the vertex without error', (done) => {
      models.instance.Person.updateVertex(vertex.id, { age: 33 }, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.id.should.equal(vertex.id);
        response.properties.name[0].value.should.equal(vertex.properties.name[0].value);
        response.properties.age[0].value.should.equal(33);
        done();
      });
    });
    it('should get the updated vertex without error', (done) => {
      models.instance.Person.getVertex(vertex.id, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.id.should.equal(vertex.id);
        response.properties.name[0].value.should.equal(vertex.properties.name[0].value);
        response.properties.age[0].value.should.equal(33);
        done();
      });
    });
    it('should delete the vertex without error', function f(done) {
      this.timeout(5000);
      this.slow(1000);
      models.instance.Person.deleteVertex(vertex.id, (err) => {
        if (err) {
          done(err);
          return;
        }
        done();
      });
    });
    it('should find the vertex deleted without error', (done) => {
      models.instance.Person.getVertex(vertex.id, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        should.not.exist(response);
        done();
      });
    });
    it('should create vertices using promise without error', function f(done) {
      this.timeout(10000);
      this.slow(5000);
      models.instance.Person.createVertexAsync({ userId: 1, name: 'john', age: 32 })
        .then(() => models.instance.Person.createVertexAsync({ userId: 2, name: 'harry', age: 24 }))
        .then(() => models.instance.Person.createVertexAsync({ userId: 3, name: 'jenny', age: 55 }))
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });

    let johnVertex;
    let harryVertex;
    let jennyVertex;
    it('should search the graph to find the vertices without error', (done) => {
      models.instance.Person.graphQueryAsync('vertices.has("userId", userId)', { userId: 1 })
        .then((response) => {
          johnVertex = response[0];
          johnVertex.properties.userId[0].value.should.equal(1);
          johnVertex.properties.name[0].value.should.equal('john');
          johnVertex.properties.age[0].value.should.equal(32);
          return models.instance.Person.graphQueryAsync('vertices.has("name", name)', { name: 'harry' });
        })
        .then((response) => {
          harryVertex = response[0];
          harryVertex.properties.userId[0].value.should.equal(2);
          harryVertex.properties.name[0].value.should.equal('harry');
          harryVertex.properties.age[0].value.should.equal(24);
          return models.instance.Person.graphQueryAsync('vertices.has("age", age)', { age: 55 });
        })
        .then((response) => {
          jennyVertex = response[0];
          jennyVertex.properties.userId[0].value.should.equal(3);
          jennyVertex.properties.name[0].value.should.equal('jenny');
          jennyVertex.properties.age[0].value.should.equal(55);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    let followEdge;
    let motherEdge;
    it('should create edges among vertices without error', (done) => {
      models.instance.Person.createEdgeAsync('follow', johnVertex.id, harryVertex.id, { followedAt: 123456 })
        .then((response) => {
          followEdge = response;
          return models.instance.Person.createEdgeAsync('mother', johnVertex.id, jennyVertex.id);
        })
        .then((response) => {
          motherEdge = response;
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should find john in followers of harry without error', (done) => {
      models.instance.Person.graphQueryAsync('vertices.has("name", name).in("follow")', { name: 'harry' })
        .then((response) => {
          const followers = response;
          followers[0].properties.userId[0].value.should.equal(1);
          followers[0].properties.name[0].value.should.equal('john');
          followers[0].properties.age[0].value.should.equal(32);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should find jenny to be mother of john without error', (done) => {
      models.instance.Person.graphQueryAsync('vertices.has("name", name).out("mother")', { name: 'john' })
        .then((response) => {
          const followers = response;
          followers[0].properties.userId[0].value.should.equal(3);
          followers[0].properties.name[0].value.should.equal('jenny');
          followers[0].properties.age[0].value.should.equal(55);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should get the edge without error', (done) => {
      models.instance.Person.getEdge(followEdge.id, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.should.deep.equal(followEdge);
        done();
      });
    });
    it('should update the edge properties without error', (done) => {
      models.instance.Person.updateEdge(followEdge.id, { followedAt: 1234567 }, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.id.should.equal(followEdge.id);
        response.properties.followedAt.should.equal(1234567);
        done();
      });
    });
    it('should get the updated edge without error', (done) => {
      models.instance.Person.getEdge(followEdge.id, (err, response) => {
        if (err) {
          done(err);
          return;
        }
        response.id.should.equal(followEdge.id);
        response.properties.followedAt.should.equal(1234567);
        done();
      });
    });
    it('should delete the edges without error', (done) => {
      models.instance.Person.deleteEdgeAsync(followEdge.id)
        .then(() => models.instance.Person.deleteEdgeAsync(motherEdge.id))
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should find the edges deleted without error', (done) => {
      models.instance.Person.getEdgeAsync(followEdge.id)
        .then((response) => {
          should.not.exist(response);
          return models.instance.Person.getEdgeAsync(motherEdge.id);
        })
        .then((response) => {
          should.not.exist(response);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should find john no longer following harry without error', (done) => {
      models.instance.Person.graphQueryAsync('vertices.has("name", name).in("follow")', { name: 'harry' })
        .then((response) => {
          const followers = response;
          followers.length.should.equal(0);
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
    it('should cleanup remaining vertices without error', function f(done) {
      this.timeout(5000);
      this.slow(1000);
      models.instance.Person.deleteVertexAsync(johnVertex.id)
        .then(() => models.instance.Person.deleteVertexAsync(harryVertex.id))
        .then(() => models.instance.Person.deleteVertexAsync(jennyVertex.id))
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });
};
