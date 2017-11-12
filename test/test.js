const semver = require('semver');
const models = require('../lib/expressCassandra');
const testSchemaLoadAndSync = require('./functional/schema_load_sync');
const testDataTypeValidations = require('./functional/datatype_validations');
const testCrudOperations = require('./functional/crud_operations');
const testCounterOperations = require('./functional/counter_operations');
const testRawClients = require('./functional/raw_client_executions');
const testCustomIndexOperations = require('./functional/custom_index_operations');
const testMaterializedViews = require('./functional/materialized_views');
const testOrmBatches = require('./functional/orm_batch_operations');
const testFixtures = require('./functional/fixture_import_export');
const testElassandra = require('./functional/elassandra_operations');
const testJanusGraph = require('./functional/janusgraph_operations');
const testCloseConnections = require('./functional/close_connections');

const eventID = models.timeuuid();

describe('Functional Tests', () => {
  testSchemaLoadAndSync();
  testDataTypeValidations();
  testCrudOperations();
  testCounterOperations();
  testRawClients(eventID);
  testCustomIndexOperations();
  testMaterializedViews(eventID);
  testOrmBatches(eventID);
  testFixtures();
  testElassandra();
  if (semver.satisfies(process.version, '>=6.0.0')) {
    // gremlin client only support node versions >=6
    testJanusGraph();
  }
  testCloseConnections();
});
