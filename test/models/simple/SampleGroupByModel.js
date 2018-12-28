module.exports = {
  fields: {
    project_id: 'int',
    job_id: 'int',
    combination_id: 'int',
    threads: 'int',
  },
  key: [['project_id'], 'job_id', 'combination_id'],
  clustering_order: { job_id: 'desc', combination_id: 'desc' },
};
