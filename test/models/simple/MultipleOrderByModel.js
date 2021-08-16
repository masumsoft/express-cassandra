export default {
  fields: {
    user_id: 'varchar',
    status: 'varchar',
    timestamp: 'int',
    first_name: 'text',
  },
  key: [['user_id'], 'status', 'timestamp'],
  clustering_order: {
    status: 'asc',
    timestamp: 'desc',
  },
  es_index_mapping: {
    discover: '.*',
  },
};
