const TYPE_MAP = require('./cassandra_types');
const _ = require('lodash');
const util = require('util');

const schemer = {

  normalize_model_schema(modelSchema) {
    const outputSchema = _.cloneDeep(modelSchema, true);
    const goodFields = {
      fields: true,
      key: true,
      clustering_order: true,
      materialized_views: true,
      indexes: true,
      custom_index: true,
      custom_indexes: true,
    };

    Object.keys(outputSchema).forEach((k) => {
      if (!(k in goodFields)) delete (outputSchema[k]);
    });

    Object.keys(outputSchema.fields).forEach((k) => {
      if (typeof (outputSchema.fields[k]) === 'string') {
        outputSchema.fields[k] = { type: outputSchema.fields[k] };
      } else if (outputSchema.fields[k]) {
        if (outputSchema.fields[k].virtual) {
          delete outputSchema.fields[k];
        } else if (outputSchema.fields[k].typeDef) {
          outputSchema.fields[k] = { type: outputSchema.fields[k].type, typeDef: outputSchema.fields[k].typeDef };
        } else {
          outputSchema.fields[k] = { type: outputSchema.fields[k].type };
        }
      } else {
        throw (new Error(
          util.format('schema field "%s" is not properly defined: %s', k, outputSchema.fields[k])
        ));
      }

      if (k === 'solr_query') {
        delete outputSchema.fields[k];
      }

      if (outputSchema.fields[k] && outputSchema.fields[k].type === 'varchar') {
        outputSchema.fields[k].type = 'text';
      }

      if (outputSchema.fields[k] && ['map', 'list', 'set', 'frozen'].indexOf(outputSchema.fields[k].type) > -1) {
        if (modelSchema.typeMaps && modelSchema.typeMaps[k]) {
          outputSchema.fields[k].typeDef = modelSchema.typeMaps[k];
        } else {
          // eslint-disable-next-line max-len
          outputSchema.fields[k].typeDef = outputSchema.fields[k].typeDef.replace(/[\s]/g, '').replace(/varchar/g, 'text');
        }
      }

      if (outputSchema.fields[k]) {
        if (modelSchema.staticMaps && modelSchema.staticMaps[k] === true) {
          outputSchema.fields[k].static = true;
        } else if (modelSchema.fields[k].static) {
          outputSchema.fields[k].static = true;
        }
      }
    });

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

    const arraySort = (a, b) => {
      if (a > b) return 1;
      if (a < b) return -1;
      return 0;
    };

    if (outputSchema.materialized_views) {
      Object.keys(outputSchema.materialized_views).forEach((mvindex) => {
        const outputMView = outputSchema.materialized_views[mvindex];
        // make parition key an array
        if (outputMView.key
              && typeof outputMView.key[0] === 'string') {
          outputMView.key[0] = [outputMView.key[0]];
        }

        // add clustering_order for all clustering keys
        if (outputMView.key
              && outputMView.key.length) {
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
              if (outputMView.select.indexOf(outputMView.key[pkeyIndex][partitionIndex]) === -1) {
                outputMView.select.push(outputMView.key[pkeyIndex][partitionIndex]);
              }
            }
          } else if (outputMView.select.indexOf(outputMView.key[pkeyIndex]) === -1) {
            outputMView.select.push(outputMView.key[pkeyIndex]);
          }
        }

        // check if select has * and then add all fields to select
        if (outputMView.select[0] === '*') {
          outputMView.select = Object.keys(outputSchema.fields);
        }

        outputMView.select.sort(arraySort);
      });
    } else {
      outputSchema.materialized_views = {};
    }

    if (outputSchema.indexes) {
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
    } else {
      outputSchema.indexes = [];
    }

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

    return outputSchema;
  },

  validate_model_schema(modelSchema) {
    if (!modelSchema) throw (new Error('A schema must be specified'));

    if (!_.isPlainObject(modelSchema.fields) || Object.keys(modelSchema.fields).length === 0) {
      throw (new Error('Schema must contain a non-empty "fields" map object'));
    }

    if (!modelSchema.key || !(modelSchema.key instanceof Array)) {
      throw (new Error('Schema must contain "key" in the form: [ [partitionkey1, ...], clusteringkey1, ...]'));
    }

    Object.keys(modelSchema.fields).forEach((k) => {
      const fieldtype = this.get_field_type(modelSchema, k);
      if (!(fieldtype in TYPE_MAP)) {
        throw (new Error(
          util.format('Given schema field type is not supported for: %s(%s)', k, modelSchema.fields[k].type)
        ));
      }
      if (!(this.is_field_default_value_valid(modelSchema, k))) {
        throw (new Error(
          util.format('Invalid defult definition for: %s(%s)', k, modelSchema.fields[k].type)
        ));
      }
    });

    // validate primary key
    if (typeof (modelSchema.key[0]) === 'string') {
      if (!(modelSchema.key[0] in modelSchema.fields)) {
        throw (new Error('Partition Key must also be a valid field name'));
      }
      if (modelSchema.fields[modelSchema.key[0]].virtual) {
        throw (new Error("Partition Key must also be a db field name, can't be a virtual field name"));
      }
    } else if (modelSchema.key[0] instanceof Array) {
      if (modelSchema.key[0].length === 0) {
        throw (new Error("Partition Key array can't be empty"));
      }
      for (let j = 0; j < modelSchema.key[0].length; j++) {
        if ((typeof (modelSchema.key[0][j]) !== 'string') || !(modelSchema.key[0][j] in modelSchema.fields)) {
          throw (new Error('Partition Key array must contain only valid field names'));
        }
        if (modelSchema.fields[modelSchema.key[0][j]].virtual) {
          throw (new Error(
            "Partition Key array must contain only db field names, can't contain virtual field names"
          ));
        }
      }
    } else {
      throw (new Error('Partition Key must be a field name string, or array of field names'));
    }

    for (let i = 0; i < modelSchema.key.length; i++) {
      if (i > 0) {
        if ((typeof (modelSchema.key[i]) !== 'string') || !(modelSchema.key[i] in modelSchema.fields)) {
          throw (new Error('Clustering Keys must be valid field names'));
        }
        if (modelSchema.fields[modelSchema.key[i]].virtual) {
          throw (new Error(
            "Clustering Keys must be db field names, can't be virtual field names"
          ));
        }
      }
    }

    if (modelSchema.clustering_order) {
      if (!_.isPlainObject(modelSchema.clustering_order)) {
        throw (new Error('clustering_order must be an object of clustering_key attributes'));
      }

      Object.keys(modelSchema.clustering_order).forEach((cindex) => {
        if (['asc', 'desc'].indexOf(modelSchema.clustering_order[cindex].toLowerCase()) === -1) {
          throw (new Error('clustering_order attribute values can only be ASC or DESC'));
        }
        if (modelSchema.key.indexOf(cindex) < 1) {
          throw (new Error('clustering_order field attributes must be clustering keys only'));
        }
      });
    }

    // validate materialized_view
    if (modelSchema.materialized_views) {
      if (!_.isPlainObject(modelSchema.materialized_views)) {
        throw (new Error('materialized_views must be an object with view names as attributes'));
      }

      Object.keys(modelSchema.materialized_views).forEach((mvindex) => {
        const candidateMView = modelSchema.materialized_views[mvindex];
        if (!_.isPlainObject(candidateMView)) {
          throw (new Error(
            util.format('attribute "%s" under materialized_views must be an object', mvindex)
          ));
        }

        if (!candidateMView.select || !candidateMView.key) {
          throw (new Error(
            util.format('materialized_view "%s" must have "select" and "key" attributes', mvindex)
          ));
        }

        if (!(candidateMView.select instanceof Array) || !(candidateMView.key instanceof Array)) {
          throw (new Error(
            util.format(
              '"select" and "key" attributes must be an array under attribute %s of materialized_views', mvindex
            )
          ));
        }

        for (let selectindex = 0; selectindex < candidateMView.select.length; selectindex++) {
          if ((typeof (candidateMView.select[selectindex]) !== 'string')
                || !(candidateMView.select[selectindex] in modelSchema.fields
                || candidateMView.select[selectindex] === '*')) {
            throw (new Error(
              util.format(
                'the select attribute under materialized_view %s must be an array of field name strings or ["*"]',
                mvindex
              )
            ));
          }

          if (modelSchema.fields[candidateMView.select[selectindex]]
              && modelSchema.fields[candidateMView.select[selectindex]].virtual) {
            throw (new Error(
              util.format(
                'the select attribute under %s of materialized_views must be an array of db field names, ' +
                'cannot contain any virtual field name',
                mvindex
              )
            ));
          }
        }

        // validate materialized_view primary key
        if (typeof (candidateMView.key[0]) === 'string') {
          if (!(candidateMView.key[0] in modelSchema.fields)) {
            throw (new Error(
              util.format('materialized_view %s: partition key string must match a valid field name', mvindex)
            ));
          }
          if (modelSchema.fields[candidateMView.key[0]].virtual) {
            throw (new Error(
              util.format(
                'materialized_view %s: partition key must match a db field name, cannot be a virtual field name',
                mvindex
              )
            ));
          }
        } else if (candidateMView.key[0] instanceof Array) {
          if (candidateMView.key[0].length === 0) {
            throw (new Error(
              util.format('materialized_view %s: partition key array cannot be empty', mvindex)
            ));
          }
          for (let j = 0; j < candidateMView.key[0].length; j++) {
            if ((typeof (candidateMView.key[0][j]) !== 'string') || !(candidateMView.key[0][j] in modelSchema.fields)) {
              throw (new Error(
                util.format('materialized_view %s: partition key array must contain only valid field names', mvindex)
              ));
            }
            if (modelSchema.fields[candidateMView.key[0][j]].virtual) {
              throw (new Error(
                util.format(
                  'materialized_view %s: partition key array must contain only db field names, ' +
                  'cannot contain virtual field names',
                  mvindex
                )
              ));
            }
          }
        } else {
          throw (new Error(
            util.format(
              'materialized_view %s: partition key must be a field name string, or array of field names',
              mvindex
            )
          ));
        }

        for (let i = 0; i < candidateMView.key.length; i++) {
          if (i > 0) {
            if ((typeof (candidateMView.key[i]) !== 'string') || !(candidateMView.key[i] in modelSchema.fields)) {
              throw (new Error(
                util.format('materialized_view %s: clustering keys must be valid field names', mvindex)
              ));
            }
            if (modelSchema.fields[candidateMView.key[i]].virtual) {
              throw (new Error(
                util.format(
                  'materialized_view %s: clustering keys must be db field names, cannot contain virtual fields',
                  mvindex
                )
              ));
            }
          }
        }

        if (candidateMView.clustering_order) {
          if (!_.isPlainObject(candidateMView.clustering_order)) {
            throw (new Error(
              util.format(
                'materialized_view %s: clustering_order must be an object of clustering_key attributes',
                mvindex
              )
            ));
          }

          Object.keys(candidateMView.clustering_order).forEach((cindex) => {
            if (['asc', 'desc'].indexOf(candidateMView.clustering_order[cindex].toLowerCase()) === -1) {
              throw (new Error(
                util.format('materialized_view %s: clustering_order attribute values can only be ASC or DESC', mvindex)
              ));
            }
            if (candidateMView.key.indexOf(cindex) < 1) {
              throw (new Error(
                util.format(
                  'materialized_view %s: clustering_order field attributes must be clustering keys only',
                  mvindex
                )
              ));
            }
          });
        }
      });
    }

    // validate indexes
    if (modelSchema.indexes) {
      if (!(modelSchema.indexes instanceof Array)) {
        throw (new Error('indexes must be an array of field name strings'));
      }

      for (let l = 0; l < modelSchema.indexes.length; l++) {
        if (typeof modelSchema.indexes[l] !== 'string') {
          throw (new Error('indexes must be an array of strings'));
        }

        const indexNameList = modelSchema.indexes[l].replace(/["\s]/g, '').split(/[()]/g);
        if (indexNameList.length > 1) {
          indexNameList[0] = indexNameList[0].toLowerCase();
          if (['entries', 'keys', 'values', 'full'].indexOf(indexNameList[0]) < 0) {
            throw (new Error(
              util.format('index "%s" is not defined properly', modelSchema.indexes[l])
            ));
          }
          if (!(indexNameList[1] in modelSchema.fields)) {
            throw (new Error(
              util.format('"%s" is not a valid field name, indexes must be defined on field names', indexNameList[1])
            ));
          }
          if (modelSchema.fields[indexNameList[1]].virtual) {
            throw (new Error("indexes must be an array of db field names, can't contain virtual fields"));
          }
        } else {
          if (!(indexNameList[0] in modelSchema.fields)) {
            throw (new Error(
              util.format('"%s" is not a valid field, indexes must be defined on field names', indexNameList[0])
            ));
          }
          if (modelSchema.fields[indexNameList[0]].virtual) {
            throw (new Error("indexes must be an array of db field names, can't contain virtual fields"));
          }
        }
      }
    }

    const validateCustomIndex = (customIndex) => {
      if (!_.isPlainObject(customIndex)) {
        throw (new Error('custom_index must be an object with proper indexing attributes'));
      }
      if ((typeof (customIndex.on) !== 'string') || !(customIndex.on in modelSchema.fields)) {
        throw (new Error(
          "custom_index must have an 'on' attribute with string value and value must be a valid field name"
        ));
      }
      if (modelSchema.fields[customIndex.on].virtual) {
        throw (new Error(
          "custom_index 'on' attribute must be a db field name, can't contain virtual fields"
        ));
      }
      if (typeof (customIndex.using) !== 'string') {
        throw (new Error(
          "custom_index must have a 'using' attribute with string value"
        ));
      }
      if (!_.isPlainObject(customIndex.options)) {
        throw (new Error(
          'custom_index must have an "options" attribute and it must be an object, ' +
          'pass blank {} object if no options are required'
        ));
      }
    };

    if (modelSchema.custom_index && modelSchema.custom_indexes) {
      throw (new Error(
        'both custom_index and custom_indexes are defined in schema, only one of them should be defined'
      ));
    }

    if (modelSchema.custom_index) {
      validateCustomIndex(modelSchema.custom_index);
    }

    if (modelSchema.custom_indexes) {
      if (modelSchema.custom_indexes instanceof Array) {
        for (let ci = 0; ci < modelSchema.custom_indexes.length; ci++) {
          validateCustomIndex(modelSchema.custom_indexes[ci]);
        }
      } else {
        throw (new Error(
          'custom_indexes must be an array with objects with proper indexing attributes'
        ));
      }
    }
  },

  get_field_type(modelSchema, fieldname) {
    const fieldob = modelSchema.fields[fieldname];

    if (typeof fieldob === 'string') return fieldob;
    else if (_.isPlainObject(fieldob)) return fieldob.type;
    throw (new Error(util.format('Field type not defined for field "%s"', fieldname)));
  },

  is_field_default_value_valid(modelSchema, fieldname) {
    if (_.isPlainObject(modelSchema.fields[fieldname]) && modelSchema.fields[fieldname].default) {
      if (_.isPlainObject(modelSchema.fields[fieldname].default)
          && !(modelSchema.fields[fieldname].default.$db_function)) {
        if (['map', 'list', 'set', 'frozen'].indexOf(modelSchema.fields[fieldname].type) > -1) return true;
        return false;
      }
      return true;
    }
    return true;
  },

};

module.exports = schemer;
