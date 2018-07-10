const _ = require('lodash');
const util = require('util');

const datatypes = require('./datatypes');

const schemer = {
  validate_table_name(tableName) {
    return (typeof tableName === 'string' && /^[a-zA-Z]+[a-zA-Z0-9_]*/.test(tableName));
  },
  has_field(modelSchema, fieldName) {
    const optionFieldNames = [];
    if (modelSchema.options) {
      if (modelSchema.options.timestamps) {
        const timestampOptions = {
          createdAt: modelSchema.options.timestamps.createdAt || 'createdAt',
          updatedAt: modelSchema.options.timestamps.updatedAt || 'updatedAt',
        };
        optionFieldNames.push(timestampOptions.createdAt);
        optionFieldNames.push(timestampOptions.updatedAt);
      }

      if (modelSchema.options.versions) {
        const versionOptions = {
          key: modelSchema.options.versions.key || '__v',
        };
        optionFieldNames.push(versionOptions.key);
      }
    }
    return _.has(modelSchema.fields, fieldName) || optionFieldNames.includes(fieldName);
  },
  validate_field(modelSchema, fieldObject, fieldName) {
    if (!fieldObject) {
      throw (new Error(util.format('Schema field "%s" is not properly defined', fieldName)));
    }
    const fieldtype = this.get_field_type(modelSchema, fieldName);
    if (!_.has(datatypes, fieldtype)) {
      throw (new Error(util.format('Invalid field type "%s" for field: %s', fieldObject.type, fieldName)));
    }
    if (['map', 'list', 'set', 'frozen'].includes(fieldObject.type)) {
      if (!fieldObject.typeDef) {
        throw (new Error(util.format('Missing typeDef for field type "%s" on field: %s', fieldObject.type, fieldName)));
      }
      if (typeof fieldObject.typeDef !== 'string') {
        throw (new Error(util.format('Invalid typeDef for field type "%s" on field: %s', fieldObject.type, fieldName)));
      }
    }
    if (!(this.is_field_default_value_valid(modelSchema, fieldName))) {
      throw (new Error(util.format('Invalid defult value for field: %s(%s)', fieldName, fieldObject.type)));
    }
  },

  validate_primary_key(modelSchema) {
    if (typeof (modelSchema.key[0]) === 'string') {
      if (!this.has_field(modelSchema, modelSchema.key[0])) {
        throw (new Error('Partition Key must also be a valid field name'));
      }
      if (modelSchema.fields[modelSchema.key[0]] && modelSchema.fields[modelSchema.key[0]].virtual) {
        throw (new Error("Partition Key must also be a db field name, can't be a virtual field name"));
      }
    } else if (_.isArray(modelSchema.key[0])) {
      if (modelSchema.key[0].length === 0) {
        throw (new Error("Partition Key array can't be empty"));
      }
      modelSchema.key[0].forEach((partitionKeyField) => {
        if ((typeof (partitionKeyField) !== 'string') || !this.has_field(modelSchema, partitionKeyField)) {
          throw (new Error('Partition Key array must contain only valid field names'));
        }
        if (modelSchema.fields[partitionKeyField] && modelSchema.fields[partitionKeyField].virtual) {
          throw (new Error("Partition Key array must contain only db field names, can't contain virtual field names"));
        }
      });
    } else {
      throw (new Error('Partition Key must be a field name string, or array of field names'));
    }

    modelSchema.key.forEach((primaryKeyField, primaryKeyIndex) => {
      if (primaryKeyIndex > 0) {
        if ((typeof (primaryKeyField) !== 'string') || !this.has_field(modelSchema, primaryKeyField)) {
          throw (new Error('Clustering Keys must be valid field names'));
        }
        if (modelSchema.fields[primaryKeyField] && modelSchema.fields[primaryKeyField].virtual) {
          throw (new Error("Clustering Keys must be db field names, can't be virtual field names"));
        }
      }
    });

    if (modelSchema.clustering_order) {
      if (!_.isPlainObject(modelSchema.clustering_order)) {
        throw (new Error('clustering_order must be an object of clustering_key attributes'));
      }

      _.forEach(modelSchema.clustering_order, (clusteringOrder, clusteringFieldName) => {
        if (!['asc', 'desc'].includes(clusteringOrder.toLowerCase())) {
          throw (new Error('clustering_order attribute values can only be ASC or DESC'));
        }
        if (modelSchema.key.indexOf(clusteringFieldName) < 1) {
          throw (new Error('clustering_order field attributes must be clustering keys only'));
        }
      });
    }
  },

  validate_materialized_view(modelSchema, materializedViewObject, materializedViewName) {
    if (!_.isPlainObject(materializedViewObject)) {
      throw (new Error(util.format('attribute "%s" under materialized_views must be an object', materializedViewName)));
    }

    if (!materializedViewObject.select || !materializedViewObject.key) {
      throw (new Error(util.format('materialized_view "%s" must have "select" and "key" attributes', materializedViewName)));
    }

    if (!_.isArray(materializedViewObject.select) || !_.isArray(materializedViewObject.key)) {
      throw (new Error(util.format('"select" and "key" attributes must be an array under attribute %s of materialized_views', materializedViewName)));
    }

    materializedViewObject.select.forEach((materializedViewSelectField) => {
      if ((typeof (materializedViewSelectField) !== 'string')
            || !(this.has_field(modelSchema, materializedViewSelectField)
            || materializedViewSelectField === '*')) {
        throw (new Error(util.format(
          'the select attribute under materialized_view %s must be an array of field name strings or ["*"]',
          materializedViewName,
        )));
      }

      if (modelSchema.fields[materializedViewSelectField]
          && modelSchema.fields[materializedViewSelectField].virtual) {
        throw (new Error(util.format(
          'the select attribute under %s of materialized_views must be an array of db field names, ' +
          'cannot contain any virtual field name',
          materializedViewName,
        )));
      }
    });

    // validate materialized_view primary key
    if (typeof (materializedViewObject.key[0]) === 'string') {
      if (!this.has_field(modelSchema, materializedViewObject.key[0])) {
        throw (new Error(util.format('materialized_view %s: partition key string must match a valid field name', materializedViewName)));
      }
      if (modelSchema.fields[materializedViewObject.key[0]]
        && modelSchema.fields[materializedViewObject.key[0]].virtual) {
        throw (new Error(util.format(
          'materialized_view %s: partition key must match a db field name, cannot be a virtual field name',
          materializedViewName,
        )));
      }
    } else if (_.isArray(materializedViewObject.key[0])) {
      if (materializedViewObject.key[0].length === 0) {
        throw (new Error(util.format('materialized_view %s: partition key array cannot be empty', materializedViewName)));
      }
      materializedViewObject.key[0].forEach((materializedViewPartitionKeyField) => {
        if ((typeof (materializedViewPartitionKeyField) !== 'string')
            || !this.has_field(modelSchema, materializedViewPartitionKeyField)) {
          throw (new Error(util.format(
            'materialized_view %s: partition key array must contain only valid field names',
            materializedViewName,
          )));
        }
        if (modelSchema.fields[materializedViewPartitionKeyField]
          && modelSchema.fields[materializedViewPartitionKeyField].virtual) {
          throw (new Error(util.format(
            'materialized_view %s: partition key array must contain only db field names, ' +
            'cannot contain virtual field names',
            materializedViewName,
          )));
        }
      });
    } else {
      throw (new Error(util.format(
        'materialized_view %s: partition key must be a field name string, or array of field names',
        materializedViewName,
      )));
    }

    materializedViewObject.key.forEach((materializedViewPrimaryKeyField, materializedViewPrimaryKeyIndex) => {
      if (materializedViewPrimaryKeyIndex > 0) {
        if ((typeof (materializedViewPrimaryKeyField) !== 'string')
            || !this.has_field(modelSchema, materializedViewPrimaryKeyField)) {
          throw (new Error(util.format('materialized_view %s: clustering keys must be valid field names', materializedViewName)));
        }
        if (modelSchema.fields[materializedViewPrimaryKeyField]
          && modelSchema.fields[materializedViewPrimaryKeyField].virtual) {
          throw (new Error(util.format(
            'materialized_view %s: clustering keys must be db field names, cannot contain virtual fields',
            materializedViewName,
          )));
        }
      }
    });

    if (materializedViewObject.clustering_order) {
      if (!_.isPlainObject(materializedViewObject.clustering_order)) {
        throw (new Error(util.format(
          'materialized_view %s: clustering_order must be an object of clustering_key attributes',
          materializedViewName,
        )));
      }

      _.forEach(materializedViewObject.clustering_order, (mvClusteringOrder, mvlusteringFieldName) => {
        if (!['asc', 'desc'].includes(mvClusteringOrder.toLowerCase())) {
          throw (new Error(util.format('materialized_view %s: clustering_order attribute values can only be ASC or DESC', materializedViewName)));
        }
        if (materializedViewObject.key.indexOf(mvlusteringFieldName) < 1) {
          throw (new Error(util.format(
            'materialized_view %s: clustering_order field attributes must be clustering keys only',
            materializedViewName,
          )));
        }
      });
    }
  },

  validate_index(modelSchema, indexDef) {
    if (typeof indexDef !== 'string') {
      throw (new Error('indexes must be an array of strings'));
    }

    const indexNameList = indexDef.replace(/["\s]/g, '').split(/[()]/g);
    if (indexNameList.length > 1) {
      indexNameList[0] = indexNameList[0].toLowerCase();
      if (!['entries', 'keys', 'values', 'full'].includes(indexNameList[0])) {
        throw (new Error(util.format('index "%s" is not defined properly', indexDef)));
      }
      if (!this.has_field(modelSchema, indexNameList[1])) {
        throw (new Error(util.format('"%s" is not a valid field name, indexes must be defined on field names', indexNameList[1])));
      }
      if (modelSchema.fields[indexNameList[1]] && modelSchema.fields[indexNameList[1]].virtual) {
        throw (new Error("indexes must be an array of db field names, can't contain virtual fields"));
      }
    } else {
      if (!this.has_field(modelSchema, indexNameList[0])) {
        throw (new Error(util.format('"%s" is not a valid field, indexes must be defined on field names', indexNameList[0])));
      }
      if (modelSchema.fields[indexNameList[0]] && modelSchema.fields[indexNameList[0]].virtual) {
        throw (new Error("indexes must be an array of db field names, can't contain virtual fields"));
      }
    }
  },

  validate_custom_index(modelSchema, customIndex) {
    if (!_.isPlainObject(customIndex)) {
      throw (new Error('custom_index must be an object with proper indexing attributes'));
    }
    if ((typeof (customIndex.on) !== 'string') || !this.has_field(modelSchema, customIndex.on)) {
      throw (new Error("custom_index must have an 'on' attribute with string value and value must be a valid field name"));
    }
    if (modelSchema.fields[customIndex.on] && modelSchema.fields[customIndex.on].virtual) {
      throw (new Error("custom_index 'on' attribute must be a db field name, can't contain virtual fields"));
    }
    if (typeof (customIndex.using) !== 'string') {
      throw (new Error("custom_index must have a 'using' attribute with string value"));
    }
    if (!_.isPlainObject(customIndex.options)) {
      throw (new Error('custom_index must have an "options" attribute and it must be an object, ' +
        'pass blank {} object if no options are required'));
    }
  },

  validate_model_schema(modelSchema) {
    if (!modelSchema) {
      throw (new Error('A schema must be specified'));
    }

    if (!_.isPlainObject(modelSchema.fields) || Object.keys(modelSchema.fields).length === 0) {
      throw (new Error('Schema must contain a non-empty "fields" map object'));
    }

    if (!modelSchema.key || !_.isArray(modelSchema.key)) {
      throw (new Error('Schema must contain "key" in the form: [ [partitionkey1, ...], clusteringkey1, ...]'));
    }

    _.forEach(modelSchema.fields, (fieldObject, fieldName) => {
      this.validate_field(modelSchema, fieldObject, fieldName);
    });

    this.validate_primary_key(modelSchema);

    if (modelSchema.materialized_views) {
      if (!_.isPlainObject(modelSchema.materialized_views)) {
        throw (new Error('materialized_views must be an object with view names as attributes'));
      }
      _.forEach(modelSchema.materialized_views, (materializedViewObject, materializedViewName) => {
        this.validate_materialized_view(modelSchema, materializedViewObject, materializedViewName);
      });
    }

    if (modelSchema.indexes) {
      if (!_.isArray(modelSchema.indexes)) {
        throw (new Error('indexes must be an array of field name strings'));
      }

      modelSchema.indexes.forEach((indexDef) => {
        this.validate_index(modelSchema, indexDef);
      });
    }

    if (modelSchema.custom_index && modelSchema.custom_indexes) {
      throw (new Error('both custom_index and custom_indexes are defined in schema, only one of them should be defined'));
    }

    if (modelSchema.custom_index) {
      this.validate_custom_index(modelSchema, modelSchema.custom_index);
    }

    if (modelSchema.custom_indexes) {
      if (!_.isArray(modelSchema.custom_indexes)) {
        throw (new Error('custom_indexes must be an array with objects with proper indexing attributes'));
      }
      modelSchema.custom_indexes.forEach((customIndex) => {
        this.validate_custom_index(modelSchema, customIndex);
      });
    }
  },

  format_validation_rule(rule, fieldname) {
    if (!_.isPlainObject(rule)) {
      throw (new Error(util.format('Validation rule for "%s" must be a function or an object', fieldname)));
    }
    if (typeof rule.validator !== 'function') {
      throw (new Error(util.format('Rule validator for "%s" must be a valid function', fieldname)));
    }
    if (!rule.message) {
      rule.message = this.get_generic_validation_message;
    }
    if (typeof rule.message === 'string') {
      rule.message = function f1(message) {
        return util.format(message);
      }.bind(null, rule.message);
    }
    if (typeof rule.message !== 'function') {
      throw (new Error(util.format('Invalid validator message for "%s", must be string or a function', fieldname)));
    }
    return rule;
  },

  get_generic_validation_message(value, propName, fieldtype) {
    return util.format('Invalid Value: "%s" for Field: %s (Type: %s)', value, propName, fieldtype);
  },

  get_validation_message(validators, value) {
    if (value == null || (_.isPlainObject(value) && value.$db_function)) {
      return true;
    }

    for (let v = 0; v < validators.length; v++) {
      if (typeof validators[v].validator === 'function') {
        if (!validators[v].validator(value)) {
          return validators[v].message;
        }
      }
    }
    return true;
  },

  get_validators(modelSchema, fieldname) {
    const validators = [];
    const fieldtype = this.get_field_type(modelSchema, fieldname);
    const typeFieldValidator = datatypes.generic_type_validator(fieldtype);

    if (typeFieldValidator) {
      validators.push(typeFieldValidator);
    }

    const field = modelSchema.fields[fieldname];
    if (typeof field.rule !== 'undefined') {
      if (typeof field.rule === 'function') {
        field.rule = {
          validator: field.rule,
          message: this.get_generic_validation_message,
        };
        validators.push(field.rule);
      } else if (Array.isArray(field.rule.validators)) {
        field.rule.validators.forEach((fieldrule) => {
          validators.push(this.format_validation_rule(fieldrule, fieldname));
        });
      } else if (field.rule.validator) {
        validators.push(this.format_validation_rule(field.rule, fieldname));
      }
    }

    return validators;
  },

  get_field_type(modelSchema, fieldName) {
    const fieldObject = modelSchema.fields[fieldName];

    if (typeof fieldObject === 'string') {
      return fieldObject;
    }
    if (_.isPlainObject(fieldObject)) {
      return fieldObject.type;
    }
    throw (new Error('Field type not defined properly'));
  },

  is_required_field(modelSchema, fieldName) {
    if (modelSchema.fields[fieldName].rule && modelSchema.fields[fieldName].rule.required) {
      return true;
    }
    return false;
  },

  is_primary_key_field(modelSchema, fieldName) {
    if (modelSchema.key.includes(fieldName) || modelSchema.key[0].includes(fieldName)) {
      return true;
    }
    return false;
  },

  is_field_default_value_valid(modelSchema, fieldName) {
    if (_.isPlainObject(modelSchema.fields[fieldName]) && modelSchema.fields[fieldName].default) {
      if (_.isPlainObject(modelSchema.fields[fieldName].default)
          && !(modelSchema.fields[fieldName].default.$db_function)) {
        return ['map', 'list', 'set', 'frozen'].includes(modelSchema.fields[fieldName].type);
      }
      return true;
    }
    return true;
  },

};

module.exports = schemer;
