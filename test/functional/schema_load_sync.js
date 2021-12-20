const path = require('path');
const semver = require('semver');

const models = require('../../lib/expressCassandra');

let client;

const config = {
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'express_cassandra_tests_kspc1',
    queryOptions: { consistency: models.consistencies.one },
    socketOptions: { readTimeout: 60000 },
  },
  ormOptions: {
    defaultReplicationStrategy: {
      class: 'NetworkTopologyStrategy',
      datacenter1: 1,
    },
    migration: 'alter',
    manageESIndex: true,
    manageGraphs: true,
    disableTTYConfirmation: true,
    udts: {
      phone: {
        alias: 'text',
        phone_number: 'varchar',
        country_code: 'int',
      },
      Address: {
        street: 'text',
        city: 'text',
        state: 'text',
        zip: 'int',
        phones: 'set<frozen<phone>>',
      },
    },
    udfs: {
      fLog: {
        language: 'java',
        code: 'return Double.valueOf(Math.log(input.doubleValue()));',
        returnType: 'double',
        inputs: {
          input: 'double',
        },
      },
      udfSum: {
        language: 'java',
        code: 'return Double.valueOf(a.doubleValue() + b.doubleValue());',
        returnType: 'double',
        inputs: {
          a: 'double',
          b: 'int',
        },
      },
      avgState: {
        language: 'java',
        code: 'if (val !=null) {' +
                'state.setInt(0, state.getInt(0)+1);' +
                'state.setLong(1,state.getLong(1)+val.intValue());' +
              '}' +
              'return state;',
        returnType: 'tuple<int, bigint>',
        inputs: {
          state: 'tuple<int, bigint>',
          val: 'int',
        },
      },
      avgFinal: {
        language: 'java',
        code: 'double r = 0;' +
              'if (state.getInt(0) == 0) return null;' +
              'r = state.getLong(1);' +
              'r/= state.getInt(0);' +
              'return Double.valueOf(r);',
        returnType: 'double',
        inputs: {
          state: 'tuple<int,bigint>',
        },
      },
      maxI: {
        language: 'java',
        code: 'if (current == null) return candidate;' +
              'else return Math.max(current, candidate);',
        returnType: 'int',
        inputs: {
          current: 'int',
          candidate: 'int',
        },
      },
      state_group_and_count: {
        language: 'java',
        code: 'Integer count = (Integer) state.get(type);' +
              'if (count == null) count = 1;' +
              'else count++;' +
              'state.put(type, count);' +
              'return state;',
        returnType: 'map<text, int>',
        inputs: {
          state: 'map<text, int>',
          type: 'text',
        },
      },
      state_group_and_total: {
        language: 'java',
        code: 'Integer count = (Integer) state.get(type);' +
              'if (count == null) count = amount;' +
              'else count = count + amount;' +
              'state.put(type, count);' +
              'return state;',
        returnType: 'map<text, int>',
        inputs: {
          state: 'map<text, int>',
          type: 'text',
          amount: 'int',
        },
      },
    },
    udas: {
      average: {
        input_types: ['int'],
        sfunc: 'avgState',
        stype: 'tuple<int,bigint>',
        finalfunc: 'avgFinal',
        initcond: '(0,0)',
      },
      maxAgg: {
        input_types: ['int'],
        sfunc: 'maxI',
        stype: 'int',
      },
      group_and_count: {
        input_types: ['text'],
        sfunc: 'state_group_and_count',
        stype: 'map<text, int> ',
        initcond: '{}',
      },
      group_and_total: {
        input_types: ['text', 'int'],
        sfunc: 'state_group_and_total',
        stype: 'map<text, int>',
        initcond: '{}',
      },
    },
  },
};

if (!semver.satisfies(process.version, '>=6.0.0')) {
  // gremlin client does not support node versions less than 6
  config.ormOptions.manageGraphs = false;
}

module.exports = () => {
  describe('#modelsync', () => {
    it('should connect and sync with db without errors', function f(done) {
      this.timeout(90000);
      this.slow(30000);
      models.setDirectory(path.join(__dirname, '../models')).bindAsync(config)
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#multiple connections', () => {
    it('should create a new express-cassandra client', function f(done) {
      this.timeout(20000);
      this.slow(10000);
      client = models.createClient({
        clientOptions: {
          contactPoints: ['127.0.0.1'],
          localDataCenter: 'datacenter1',
          keyspace: 'express_cassandra_tests_kspc1',
          queryOptions: { consistency: models.consistencies.one },
          socketOptions: { readTimeout: 60000 },
        },
        ormOptions: {
          defaultReplicationStrategy: {
            class: 'NetworkTopologyStrategy',
            datacenter1: 1,
          },
          dropTableOnSchemaChange: true,
          createKeyspace: false,
        },
      });

      client.initAsync()
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });
  });

  describe('#custom load and sync schema api', () => {
    after(() => {
      client.close();
    });

    it('should load a schema from an object and syncDB', function f(done) {
      this.timeout(20000);
      this.slow(10000);
      const myTempModel = client.loadSchema('TempSchema', {
        fields: {
          firstname: 'text',
          name: 'text',
        },
        key: ['firstname'],
      });
      myTempModel.should.equal(client.instance.TempSchema);
      myTempModel.syncDB((err) => {
        if (err) {
          done(err);
          return;
        }
        done();
      });
    });

    it('should insert into custom schema without error', (done) => {
      const tempItem = new client.instance.TempSchema({ firstname: 'John' });
      tempItem.save((err) => {
        if (err) {
          done(err);
          return;
        }
        done();
      });
    });
  });
};
