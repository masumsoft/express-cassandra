export default {
  fields: {
    project_id: 'int',
    job_id: 'int',
    combinationId: 'int',
  },
  key: [['project_id'], 'job_id', 'combinationId'],
  clustering_order: { job_id: 'desc', combinationId: 'desc' },
};
