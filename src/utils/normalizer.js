const _ = require('lodash');
const util = require('util');

const parser = require('./parser');

const arraySort = (a, b) => {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
};

const normalizeTypeDef = (typeDef) => {
  const formattedTypeDef = typeDef.replace(/[\s]/g, '').replace(/varchar/g, 'text').replace(/frozen/ig, 'frozen');
  const frozenMatch = formattedTypeDef.match(/frozen</g);
  if (frozenMatch && frozenMatch.length) return formattedTypeDef.replace(/frozen</g, '').slice(0, -1 * frozenMatch.length);
  return formattedTypeDef;
};

const normalizer = {
  normalize_replication_option(replicationOptions) {
    const normalizedReplicationOptions = replicationOptions;
    Object.keys(normalizedReplicationOptions).forEach((key) => {
      if (key === 'class') {
        normalizedReplicationOptions[key] = normalizedReplicationOptions[key].replace('org.apache.cassandra.locator.', '');
        return;
      }
      normalizedReplicationOptions[key] = parseInt(normalizedReplicationOptions[key], 10);
    });
    return normalizedReplicationOptions;
  },

  normalize_query_option(options) {
    const queryOptions = { prepare: options.prepare };
    if (options.consistency) queryOptions.consistency = options.consistency;
    if (options.fetchSize) queryOptions.fetchSize = options.fetchSize;
    if (options.autoPage) queryOptions.autoPage = options.autoPage;
    if (options.hints) queryOptions.hints = options.hints;
    if (options.pageState) queryOptions.pageState = options.pageState;
    if (options.retry) queryOptions.retry = options.retry;
    if (options.serialConsistency) queryOptions.serialConsistency = options.serialConsistency;
    if (options.customPayload) queryOptions.customPayload = options.customPayload;
    if (options.isIdempotent) queryOptions.isIdempotent = options.isIdempotent;
    if (options.readTimeout) queryOptions.readTimeout = options.readTimeout;
    if (options.retry) queryOptions.retry = options.retry;
    if (options.retryOnTimeout) queryOptions.retryOnTimeout = options.retryOnTimeout;
    if (options.routingIndexes) queryOptions.routingIndexes = options.routingIndexes;
    if (options.routingKey) queryOptions.routingKey = options.routingKey;
    if (options.routingNames) queryOptions.routingNames = options.routingNames;
    if (options.timestamp) queryOptions.timestamp = options.timestamp;
    return queryOptions;
  },

  normalize_user_defined_type(fieldType) {
    return normalizeTypeDef(fieldType);
  },

  normalize_primary_key(outputSchema) {
    if (outputSchema.key && typeof outputSchema.key[0] === 'string') {
      outputSchema.key[0] = [outputSchema.key[0]];
    }

    if (outputSchema.key && outputSchema.key.length) {
      for (let i = 1; i < outputSchema.key.length; i++) {
        if (!outputSchema.clustering_order) outputSchema.clustering_order = {};
        if (!outputSchema.clustering_order[outputSchema.key[i]]) {
          outputSchema.clustering_order[outputSchema.key[i]] = 'ASC';
        }

        // eslint-disable-next-line max-len
        outputSchema.clustering_order[outputSchema.key[i]] = outputSchema.clustering_order[outputSchema.key[i]].toUpperCase();
      }
    }
  },

  normalize_fields(modelSchema, outputSchema) {
    Object.keys(outputSchema.fields).forEach((fieldName) => {
      if (typeof (outputSchema.fields[fieldName]) === 'string') {
        outputSchema.fields[fieldName] = { type: outputSchema.fields[fieldName] };
      }

      if (fieldName === 'solr_query' || outputSchema.fields[fieldName].virtual) {
        delete outputSchema.fields[fieldName];
        return;
      }

      if (outputSchema.fields[fieldName].typeDef) {
        outputSchema.fields[fieldName] = {
          type: outputSchema.fields[fieldName].type,
          typeDef: outputSchema.fields[fieldName].typeDef,
        };
      } else {
        outputSchema.fields[fieldName] = { type: outputSchema.fields[fieldName].type };
      }

      if (outputSchema.fields[fieldName].type === 'varchar') {
        outputSchema.fields[fieldName].type = 'text';
      }

      if (['map', 'list', 'set', 'frozen'].includes(outputSchema.fields[fieldName].type)) {
        if (modelSchema.typeMaps && modelSchema.typeMaps[fieldName]) {
          outputSchema.fields[fieldName].typeDef = normalizeTypeDef(modelSchema.typeMaps[fieldName]);
        } else {
          outputSchema.fields[fieldName].typeDef = normalizeTypeDef(outputSchema.fields[fieldName].typeDef);
        }
      }

      if (modelSchema.staticMaps && modelSchema.staticMaps[fieldName] === true) {
        outputSchema.fields[fieldName].static = true;
      } else if (modelSchema.fields[fieldName].static) {
        outputSchema.fields[fieldName].static = true;
      }
    });
  },

  normalize_materialized_views(outputSchema) {
    if (!outputSchema.materialized_views) {
      outputSchema.materialized_views = {};
    }

    Object.keys(outputSchema.materialized_views).forEach((materializedViewName) => {
      const outputMView = outputSchema.materialized_views[materializedViewName];
      // make parition key an array
      if (outputMView.key && typeof outputMView.key[0] === 'string') {
        outputMView.key[0] = [outputMView.key[0]];
      }

      // add clustering_order for all clustering keys
      if (outputMView.key && outputMView.key.length) {
        for (let i = 1; i < outputMView.key.length; i++) {
          if (!outputMView.clustering_order) {
            outputMView.clustering_order = {};
          }
          if (!outputMView.clustering_order[outputMView.key[i]]) {
            outputMView.clustering_order[outputMView.key[i]] = 'ASC';
          }
          // eslint-disable-next-line max-len
          outputMView.clustering_order[outputMView.key[i]] = outputMView.clustering_order[outputMView.key[i]].toUpperCase();
        }
      }

      // add all non existent primary key items to select and sort them
      for (let pkeyIndex = 0; pkeyIndex < outputMView.key.length; pkeyIndex++) {
        if (pkeyIndex === 0) {
          for (let partitionIndex = 0; partitionIndex < outputMView.key[pkeyIndex].length; partitionIndex++) {
            if (!outputMView.select.includes(outputMView.key[pkeyIndex][partitionIndex])) {
              outputMView.select.push(outputMView.key[pkeyIndex][partitionIndex]);
            }
          }
        } else if (!outputMView.select.includes(outputMView.key[pkeyIndex])) {
          outputMView.select.push(outputMView.key[pkeyIndex]);
        }
      }

      // check if select has * and then add all fields to select
      if (outputMView.select[0] === '*') {
        outputMView.select = Object.keys(outputSchema.fields);
      }

      outputMView.select.sort(arraySort);

      if (!outputMView.where_clause) {
        outputMView.where_clause = parser.get_mview_where_clause(outputSchema, outputMView);
      } else {
        outputMView.where_clause = outputMView.where_clause.replace(/IS NOT null/g, 'IS NOT NULL');
      }
      
      if (_.isPlainObject(outputMView.filters)) {
        delete outputMView.filters;
      }
    });
  },

  normalize_indexes(outputSchema) {
    if (!outputSchema.indexes) {
      outputSchema.indexes = [];
    }
    for (let i = 0; i < outputSchema.indexes.length; i++) {
      const indexNameList = outputSchema.indexes[i].replace(/["\s]/g, '').split(/[()]/g);
      if (indexNameList.length > 1) {
        indexNameList[0] = indexNameList[0].toLowerCase();
        if (indexNameList[0] === 'values') outputSchema.indexes[i] = indexNameList[1];
        else outputSchema.indexes[i] = util.format('%s(%s)', indexNameList[0], indexNameList[1]);
      } else {
        outputSchema.indexes[i] = indexNameList[0];
      }
    }
    outputSchema.indexes.sort(arraySort);
  },

  normalize_custom_indexes(outputSchema) {
    if (outputSchema.custom_index) {
      outputSchema.custom_indexes = [outputSchema.custom_index];
      delete outputSchema.custom_index;
    }

    if (outputSchema.custom_indexes) {
      const customArraySort = (a, b) => {
        if (a.on > b.on) return 1;
        if (a.on < b.on) return -1;

        if (a.using > b.using) return 1;
        if (a.using < b.using) return -1;

        if (a.options > b.options) return 1;
        if (a.options < b.options) return -1;

        return 0;
      };

      outputSchema.custom_indexes.sort(customArraySort);
    } else {
      outputSchema.custom_indexes = [];
    }

    outputSchema.custom_indexes = _.remove(outputSchema.custom_indexes, (cindex) => (cindex.on !== 'solr_query'));
  },

  normalize_model_schema(modelSchema) {
    const outputSchema = _.cloneDeep(modelSchema, true);
    const normalizableSchemaProperties = [
      'fields', 'key', 'clustering_order', 'materialized_views', 'indexes', 'custom_index', 'custom_indexes',
    ];

    Object.keys(outputSchema).forEach((schemaProperty) => {
      if (!normalizableSchemaProperties.includes(schemaProperty)) {
        delete outputSchema[schemaProperty];
      }
    });

    this.normalize_fields(modelSchema, outputSchema);
    this.normalize_primary_key(outputSchema);
    this.normalize_materialized_views(outputSchema);
    this.normalize_indexes(outputSchema);
    this.normalize_custom_indexes(outputSchema);

    return outputSchema;
  },

  remove_dependent_views_from_normalized_schema(normalizedDBSchema, dbSchema, fieldName) {
    const dependentViews = [];
    Object.keys(normalizedDBSchema.materialized_views).forEach((dbViewName) => {
      if (normalizedDBSchema.materialized_views[dbViewName].select.includes(fieldName)) {
        dependentViews.push(dbViewName);
      } else if (normalizedDBSchema.materialized_views[dbViewName].select[0] === '*') {
        dependentViews.push(dbViewName);
      } else if (normalizedDBSchema.materialized_views[dbViewName].key.includes(fieldName)) {
        dependentViews.push(dbViewName);
      } else if (_.isArray(normalizedDBSchema.materialized_views[dbViewName].key[0])
                  && normalizedDBSchema.materialized_views[dbViewName].key[0].includes(fieldName)) {
        dependentViews.push(dbViewName);
      }
    });
    dependentViews.forEach((viewName) => {
      normalizedDBSchema.materialized_views[viewName] = {};
    });
  },
};

module.exports = normalizer;
