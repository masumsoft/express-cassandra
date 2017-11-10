module.exports = {
  fields: {
    email: { type: 'text' },
    id: { type: 'timeuuid' },
    body: { type: 'text' },
    extra: { type: 'text' },
    tupletest: {
      type: 'frozen',
      typeDef: '<tuple<int, text, float>>',
    },
    statictest: {
      type: 'text',
      static: true,
    },
    lucene: 'text',
  },
  key: [['email'], 'id'],
  clustering_order: { id: 'desc' },
  materialized_views: {
    event_by_id: {
      select: ['body'],
      key: ['id', 'email'],
      clustering_order: { email: 'desc' },
    },
  },
  custom_indexes: [
    {
      on: 'body',
      using: 'org.apache.cassandra.index.sasi.SASIIndex',
      options: { mode: 'CONTAINS' },
    },
    {
      on: 'extra',
      using: 'org.apache.cassandra.index.sasi.SASIIndex',
      options: {},
    },
    /*
    {
      on: 'lucene',
      using: 'com.stratio.cassandra.lucene.Index',
      options: {
        refresh_seconds: '1',
        schema: '{' +
          'fields: {' +
            'id: {type : "uuid"},' +
            'email: {type : "text"},' +
            'body: {type : "text"},' +
            'extra : {type : "text"}' +
          '}' +
        '}',
      },
    },
    */
  ],
};

