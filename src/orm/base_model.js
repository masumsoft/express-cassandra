const util = require('util');
const cql = require('dse-driver');
const async = require('async');
const _ = require('lodash');
const deepDiff = require('deep-diff').diff;
const readlineSync = require('readline-sync');
const objectHash = require('object-hash');
const debug = require('debug')('express-cassandra');

const buildError = require('./apollo_error.js');
const schemer = require('./apollo_schemer');

const TYPE_MAP = require('./cassandra_types');

const checkDBTableName = (obj) => ((typeof obj === 'string' && /^[a-zA-Z]+[a-zA-Z0-9_]*/.test(obj)));

const BaseModel = function f(instanceValues) {
  instanceValues = instanceValues || {};
  const fieldValues = {};
  const fields = this.constructor._properties.schema.fields;

  const defaultSetter = function f1(propName, newValue) {
    this[propName] = newValue;
  };

  const defaultGetter = function f1(propName) {
    return this[propName];
  };

  this._validators = {};

  for (let fieldsKeys = Object.keys(fields), i = 0, len = fieldsKeys.length; i < len; i++) {
    const propertyName = fieldsKeys[i];
    const field = fields[fieldsKeys[i]];

    this._validators[propertyName] = this.constructor._get_validators(propertyName);

    let setter = defaultSetter.bind(fieldValues, propertyName);
    let getter = defaultGetter.bind(fieldValues, propertyName);

    if (field.virtual && typeof field.virtual.set === 'function') {
      setter = field.virtual.set.bind(fieldValues);
    }

    if (field.virtual && typeof field.virtual.get === 'function') {
      getter = field.virtual.get.bind(fieldValues);
    }

    const descriptor = {
      enumerable: true,
      set: setter,
      get: getter,
    };

    Object.defineProperty(this, propertyName, descriptor);
    if (!field.virtual) {
      this[propertyName] = instanceValues[propertyName];
    }
  }
};

BaseModel._properties = {
  name: null,
  schema: null,
};

BaseModel._set_properties = function f(properties) {
  const schema = properties.schema;
  const tableName = schema.table_name || properties.name;

  if (!checkDBTableName(tableName)) {
    throw (buildError('model.tablecreation.invalidname', tableName));
  }

  const qualifiedTableName = util.format('"%s"."%s"', properties.keyspace, tableName);

  this._properties = properties;
  this._properties.table_name = tableName;
  this._properties.qualified_table_name = qualifiedTableName;
};

BaseModel._validate = function f(validators, value) {
  if (value == null || (_.isPlainObject(value) && value.$db_function)) return true;

  for (let v = 0; v < validators.length; v++) {
    if (typeof validators[v].validator === 'function') {
      if (!validators[v].validator(value)) {
        return validators[v].message;
      }
    }
  }
  return true;
};

BaseModel._get_generic_validator_message = function f(value, propName, fieldtype) {
  return util.format('Invalid Value: "%s" for Field: %s (Type: %s)', value, propName, fieldtype);
};

BaseModel._format_validator_rule = function f(rule) {
  if (typeof rule.validator !== 'function') {
    throw (buildError('model.validator.invalidrule', 'Rule validator must be a valid function'));
  }
  if (!rule.message) {
    rule.message = this._get_generic_validator_message;
  } else if (typeof rule.message === 'string') {
    rule.message = function f1(message) {
      return util.format(message);
    }.bind(null, rule.message);
  } else if (typeof rule.message !== 'function') {
    throw (buildError('model.validator.invalidrule', 'Invalid validator message, must be string or a function'));
  }

  return rule;
};

BaseModel._get_validators = function f(fieldname) {
  let fieldtype;
  try {
    fieldtype = schemer.get_field_type(this._properties.schema, fieldname);
  } catch (e) {
    throw (buildError('model.validator.invalidschema', e.message));
  }

  const validators = [];
  const typeFieldValidator = TYPE_MAP.generic_type_validator(fieldtype);

  if (typeFieldValidator) validators.push(typeFieldValidator);

  const field = this._properties.schema.fields[fieldname];
  if (typeof field.rule !== 'undefined') {
    if (typeof field.rule === 'function') {
      field.rule = {
        validator: field.rule,
        message: this._get_generic_validator_message,
      };
      validators.push(field.rule);
    } else {
      if (!_.isPlainObject(field.rule)) {
        throw (buildError('model.validator.invalidrule', 'Validation rule must be a function or an object'));
      }
      if (field.rule.validator) {
        validators.push(this._format_validator_rule(field.rule));
      } else if (Array.isArray(field.rule.validators)) {
        field.rule.validators.forEach((fieldrule) => {
          validators.push(this._format_validator_rule(fieldrule));
        });
      }
    }
  }

  return validators;
};

BaseModel._ask_confirmation = function f(message) {
  let permission = 'y';
  if (!this._properties.disableTTYConfirmation) {
    permission = readlineSync.question(message);
  }
  return permission;
};

BaseModel._ensure_connected = function f(callback) {
  if (!this._properties.cql) {
    this._properties.connect(callback);
  } else {
    callback();
  }
};

BaseModel._execute_definition_query = function f(query, params, callback) {
  this._ensure_connected((err) => {
    if (err) {
      callback(err);
      return;
    }
    debug('executing definition query: %s with params: %j', query, params);
    const properties = this._properties;
    const conn = properties.define_connection;
    conn.execute(query, params, { prepare: false, fetchSize: 0 }, callback);
  });
};

BaseModel._execute_batch = function f(queries, options, callback) {
  this._ensure_connected((err) => {
    if (err) {
      callback(err);
      return;
    }
    debug('executing batch queries: %j', queries);
    this._properties.cql.batch(queries, options, callback);
  });
};

BaseModel.execute_batch = function f(queries, options, callback) {
  if (arguments.length === 2) {
    callback = options;
    options = {};
  }

  const defaults = {
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  this._execute_batch(queries, options, callback);
};

BaseModel.get_cql_client = function f(callback) {
  this._ensure_connected((err) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, this._properties.cql);
  });
};

BaseModel._create_table = function f(callback) {
  const properties = this._properties;
  const tableName = properties.table_name;
  const modelSchema = properties.schema;
  const dropTableOnSchemaChange = properties.dropTableOnSchemaChange;
  let migration = properties.migration;

  // backwards compatible change, dropTableOnSchemaChange will work like migration: 'drop'
  if (!migration) {
    if (dropTableOnSchemaChange) migration = 'drop';
    else migration = 'safe';
  }
  // always safe migrate if NODE_ENV==='production'
  if (process.env.NODE_ENV === 'production') migration = 'safe';

  // check for existence of table on DB and if it matches this model's schema
  this._get_db_table_schema((err, dbSchema) => {
    if (err) {
      callback(err);
      return;
    }

    const afterCustomIndex = (err1) => {
      if (err1) {
        callback(buildError('model.tablecreation.dbindexcreate', err1));
        return;
      }
      // materialized view creation
      if (modelSchema.materialized_views) {
        async.eachSeries(Object.keys(modelSchema.materialized_views), (viewName, next) => {
          const matViewQuery = this._create_materialized_view_query(
            tableName,
            viewName,
            modelSchema.materialized_views[viewName]
          );
          this._execute_definition_query(matViewQuery, [], (err2, result) => {
            if (err2) next(buildError('model.tablecreation.matviewcreate', err2));
            else next(null, result);
          });
        }, callback);
      } else callback();
    };

    const afterDBIndex = (err1) => {
      if (err1) {
        callback(buildError('model.tablecreation.dbindexcreate', err1));
        return;
      }
      // custom index creation
      if (modelSchema.custom_indexes) {
        async.eachSeries(modelSchema.custom_indexes, (idx, next) => {
          this._execute_definition_query(this._create_custom_index_query(tableName, idx), [], (err2, result) => {
            if (err2) next(err2);
            else next(null, result);
          });
        }, afterCustomIndex);
      } else if (modelSchema.custom_index) {
        const customIndexQuery = this._create_custom_index_query(tableName, modelSchema.custom_index);
        this._execute_definition_query(customIndexQuery, [], (err2, result) => {
          if (err2) afterCustomIndex(err2);
          else afterCustomIndex(null, result);
        });
      } else afterCustomIndex();
    };

    const afterDBCreate = (err1) => {
      if (err1) {
        callback(buildError('model.tablecreation.dbcreate', err1));
        return;
      }
      // index creation
      if (modelSchema.indexes instanceof Array) {
        async.eachSeries(modelSchema.indexes, (idx, next) => {
          this._execute_definition_query(this._create_index_query(tableName, idx), [], (err2, result) => {
            if (err2) next(err2);
            else next(null, result);
          });
        }, afterDBIndex);
      } else afterDBIndex();
    };

    if (dbSchema) {
      let normalizedModelSchema;
      let normalizedDBSchema;

      try {
        normalizedModelSchema = schemer.normalize_model_schema(modelSchema);
        normalizedDBSchema = schemer.normalize_model_schema(dbSchema);
      } catch (e) {
        throw (buildError('model.validator.invalidschema', e.message));
      }

      if (_.isEqual(normalizedModelSchema, normalizedDBSchema)) {
        callback();
      } else {
        const dropRecreateTable = () => {
          const permission = this._ask_confirmation(
            util.format(
              'Migration: model schema changed for table "%s", drop table & recreate? (data will be lost!) (y/n): ',
              tableName
            )
          );
          if (permission.toLowerCase() === 'y') {
            if (normalizedDBSchema.materialized_views) {
              const mviews = Object.keys(normalizedDBSchema.materialized_views);

              this.drop_mviews(mviews, (err1) => {
                if (err1) {
                  callback(buildError('model.tablecreation.matviewdrop', err1));
                  return;
                }

                this.drop_table((err2) => {
                  if (err2) {
                    callback(buildError('model.tablecreation.dbdrop', err2));
                    return;
                  }
                  const createTableQuery = this._create_table_query(tableName, modelSchema);
                  this._execute_definition_query(createTableQuery, [], afterDBCreate);
                });
              });
            } else {
              this.drop_table((err1) => {
                if (err1) {
                  callback(buildError('model.tablecreation.dbdrop', err1));
                  return;
                }
                const createTableQuery = this._create_table_query(tableName, modelSchema);
                this._execute_definition_query(createTableQuery, [], afterDBCreate);
              });
            }
          } else {
            callback(buildError('model.tablecreation.schemamismatch', tableName));
          }
        };

        const afterDBAlter = (err1) => {
          if (err1) {
            if (err1.message !== 'break') callback(err1);
            return;
          }
          // it should create/drop indexes/custom_indexes/materialized_views that are added/removed in model schema
          // remove common indexes/custom_indexes/materialized_views from normalizedModelSchema and normalizedDBSchema
          // then drop all remaining indexes/custom_indexes/materialized_views from normalizedDBSchema
          // and add all remaining indexes/custom_indexes/materialized_views from normalizedModelSchema
          const addedIndexes = _.difference(normalizedModelSchema.indexes, normalizedDBSchema.indexes);
          const removedIndexes = _.difference(normalizedDBSchema.indexes, normalizedModelSchema.indexes);
          const removedIndexNames = [];
          removedIndexes.forEach((removedIndex) => {
            removedIndexNames.push(dbSchema.index_names[removedIndex]);
          });

          const addedCustomIndexes = _.filter(
            normalizedModelSchema.custom_indexes,
            (obj) => (!_.find(normalizedDBSchema.custom_indexes, obj))
          );
          const removedCustomIndexes = _.filter(
            normalizedDBSchema.custom_indexes,
            (obj) => (!_.find(normalizedModelSchema.custom_indexes, obj))
          );
          removedCustomIndexes.forEach((removedIndex) => {
            removedIndexNames.push(dbSchema.index_names[objectHash(removedIndex)]);
          });

          const addedMaterializedViews = _.filter(
            Object.keys(normalizedModelSchema.materialized_views),
            (viewName) =>
              (!_.find(normalizedDBSchema.materialized_views, normalizedModelSchema.materialized_views[viewName]))
          );
          const removedMaterializedViews = _.filter(
            Object.keys(normalizedDBSchema.materialized_views),
            (viewName) =>
              (!_.find(normalizedModelSchema.materialized_views, normalizedDBSchema.materialized_views[viewName]))
          );

          // remove altered materialized views
          if (removedMaterializedViews.length > 0) {
            const permission = this._ask_confirmation(
              util.format(
                'Migration: model schema for table "%s" has removed materialized_views: %j, drop them? (y/n): ',
                tableName,
                removedMaterializedViews
              )
            );
            if (permission.toLowerCase() !== 'y') {
              callback(buildError('model.tablecreation.schemamismatch', tableName));
              return;
            }
          }
          if (removedIndexNames.length > 0) {
            const permission = this._ask_confirmation(
              util.format(
                'Migration: model schema for table "%s" has removed indexes: %j, drop them? (y/n): ',
                tableName,
                removedIndexNames
              )
            );
            if (permission.toLowerCase() !== 'y') {
              callback(buildError('model.tablecreation.schemamismatch', tableName));
              return;
            }
          }

          this.drop_mviews(removedMaterializedViews, (err2) => {
            if (err2) {
              callback(buildError('model.tablecreation.matviewdrop', err2));
              return;
            }

            // remove altered indexes by index name
            this.drop_indexes(removedIndexNames, (err3) => {
              if (err3) {
                callback(buildError('model.tablecreation.dbindexdrop', err3));
                return;
              }

              // add altered indexes
              async.eachSeries(addedIndexes, (idx, next) => {
                this._execute_definition_query(this._create_index_query(tableName, idx), [], (err4, result) => {
                  if (err4) next(err4);
                  else next(null, result);
                });
              }, (err4) => {
                if (err4) {
                  callback(buildError('model.tablecreation.dbindexcreate', err4));
                  return;
                }

                // add altered custom indexes
                async.eachSeries(addedCustomIndexes, (idx, next) => {
                  const customIndexQuery = this._create_custom_index_query(tableName, idx);
                  this._execute_definition_query(customIndexQuery, [], (err5, result) => {
                    if (err5) next(err5);
                    else next(null, result);
                  });
                }, (err5) => {
                  if (err5) {
                    callback(buildError('model.tablecreation.dbindexcreate', err5));
                    return;
                  }

                  // add altered materialized_views
                  async.eachSeries(addedMaterializedViews, (viewName, next) => {
                    const matViewQuery = this._create_materialized_view_query(
                      tableName,
                      viewName,
                      modelSchema.materialized_views[viewName]
                    );
                    this._execute_definition_query(matViewQuery, [], (err6, result) => {
                      if (err6) next(buildError('model.tablecreation.matviewcreate', err6));
                      else next(null, result);
                    });
                  }, callback);
                });
              });
            });
          });
        };

        const alterDBTable = () => {
          const differences = deepDiff(normalizedDBSchema.fields, normalizedModelSchema.fields);
          async.eachSeries(differences, (diff, next) => {
            const fieldName = diff.path[0];
            const alterFieldType = () => {
              const permission = this._ask_confirmation(
                util.format(
                  'Migration: model schema for table "%s" has new type for field "%s", ' +
                  'alter table to update column type? (y/n): ',
                  tableName,
                  fieldName
                )
              );
              if (permission.toLowerCase() === 'y') {
                this.alter_table('ALTER', fieldName, diff.rhs, (err1, result) => {
                  if (err1) next(buildError('model.tablecreation.dbalter', err1));
                  else next(null, result);
                });
              } else {
                next(buildError('model.tablecreation.schemamismatch', tableName));
              }
            };

            const alterAddField = () => {
              let type = '';
              if (diff.path.length > 1) {
                if (diff.path[1] === 'type') {
                  type = diff.rhs;
                  if (normalizedModelSchema.fields[fieldName].typeDef) {
                    type += normalizedModelSchema.fields[fieldName].typeDef;
                  }
                } else {
                  type = normalizedModelSchema.fields[fieldName].type;
                  type += diff.rhs;
                }
              } else {
                type = diff.rhs.type;
                if (diff.rhs.typeDef) type += diff.rhs.typeDef;
              }

              this.alter_table('ADD', fieldName, type, (err1, result) => {
                if (err1) next(buildError('model.tablecreation.dbalter', err1));
                else next(null, result);
              });
            };

            const alterRemoveField = (nextCallback) => {
              // remove dependent indexes/custom_indexes/materialized_views,
              // update them in normalizedDBSchema, then alter
              const dependentIndexes = [];
              const pullIndexes = [];
              normalizedDBSchema.indexes.forEach((dbIndex) => {
                const indexSplit = dbIndex.split(/[()]/g);
                let indexFieldName = '';
                if (indexSplit.length > 1) indexFieldName = indexSplit[1];
                else indexFieldName = indexSplit[0];
                if (indexFieldName === fieldName) {
                  dependentIndexes.push(dbSchema.index_names[dbIndex]);
                  pullIndexes.push(dbIndex);
                }
              });
              _.pullAll(normalizedDBSchema.indexes, pullIndexes);

              const pullCustomIndexes = [];
              normalizedDBSchema.custom_indexes.forEach((dbIndex) => {
                if (dbIndex.on === fieldName) {
                  dependentIndexes.push(dbSchema.index_names[objectHash(dbIndex)]);
                  pullCustomIndexes.push(dbIndex);
                }
              });
              _.pullAll(normalizedDBSchema.custom_indexes, pullCustomIndexes);

              const dependentViews = [];
              Object.keys(normalizedDBSchema.materialized_views).forEach((dbViewName) => {
                if (normalizedDBSchema.materialized_views[dbViewName].select.indexOf(fieldName) > -1) {
                  dependentViews.push(dbViewName);
                } else if (normalizedDBSchema.materialized_views[dbViewName].select[0] === '*') {
                  dependentViews.push(dbViewName);
                } else if (normalizedDBSchema.materialized_views[dbViewName].key.indexOf(fieldName) > -1) {
                  dependentViews.push(dbViewName);
                } else if (normalizedDBSchema.materialized_views[dbViewName].key[0] instanceof Array
                            && normalizedDBSchema.materialized_views[dbViewName].key[0].indexOf(fieldName) > -1) {
                  dependentViews.push(dbViewName);
                }
              });
              dependentViews.forEach((viewName) => {
                delete normalizedDBSchema.materialized_views[viewName];
              });

              this.drop_mviews(dependentViews, (err1) => {
                if (err1) {
                  nextCallback(buildError('model.tablecreation.matviewdrop', err1));
                  return;
                }

                this.drop_indexes(dependentIndexes, (err2) => {
                  if (err2) {
                    nextCallback(buildError('model.tablecreation.dbindexdrop', err2));
                    return;
                  }

                  this.alter_table('DROP', fieldName, '', (err3, result) => {
                    if (err3) nextCallback(buildError('model.tablecreation.dbalter', err3));
                    else nextCallback(null, result);
                  });
                });
              });
            };

            if (diff.kind === 'N') {
              const permission = this._ask_confirmation(
                util.format(
                  'Migration: model schema for table "%s" has added field "%s", alter table to add column? (y/n): ',
                  tableName,
                  fieldName
                )
              );
              if (permission.toLowerCase() === 'y') {
                alterAddField();
              } else {
                next(buildError('model.tablecreation.schemamismatch', tableName));
              }
            } else if (diff.kind === 'D') {
              const permission = this._ask_confirmation(
                util.format(
                  'Migration: model schema for table "%s" has removed field "%s", alter table to drop column? ' +
                  '(column data will be lost & dependent indexes/views will be recreated!) (y/n): ',
                  tableName,
                  fieldName
                )
              );
              if (permission.toLowerCase() === 'y') {
                alterRemoveField(next);
              } else {
                next(buildError('model.tablecreation.schemamismatch', tableName));
              }
            } else if (diff.kind === 'E') {
              // check if the alter field type is possible, otherwise try D and then N
              if (diff.path[1] === 'type') {
                if (diff.lhs === 'int' && diff.rhs === 'varint') {
                  // alter field type possible
                  alterFieldType();
                } else if (normalizedDBSchema.key.indexOf(fieldName) > 0) { // check if field part of clustering key
                  // alter field type impossible
                  const permission = this._ask_confirmation(
                    util.format(
                      'Migration: model schema for table "%s" has new incompatible type for primary key field "%s", ' +
                      'proceed to recreate table? (y/n): ',
                      tableName,
                      fieldName
                    )
                  );
                  if (permission.toLowerCase() === 'y') {
                    dropRecreateTable();
                    next(new Error('break'));
                  } else {
                    next(buildError('model.tablecreation.schemamismatch', tableName));
                  }
                } else if (['text', 'ascii', 'bigint', 'boolean', 'decimal',
                  'double', 'float', 'inet', 'int', 'timestamp', 'timeuuid',
                  'uuid', 'varchar', 'varint'].indexOf(diff.lhs) > -1 && diff.rhs === 'blob') {
                  // alter field type possible
                  alterFieldType();
                } else if (diff.lhs === 'timeuuid' && diff.rhs === 'uuid') {
                  // alter field type possible
                  alterFieldType();
                } else if (normalizedDBSchema.key[0].indexOf(fieldName) > -1) { // check if field part of partition key
                  // alter field type impossible
                  const permission = this._ask_confirmation(
                    util.format(
                      'Migration: model schema for table "%s" has new incompatible type for primary key field "%s", ' +
                      'proceed to recreate table? (y/n): ',
                      tableName,
                      fieldName
                    )
                  );
                  if (permission.toLowerCase() === 'y') {
                    dropRecreateTable();
                    next(new Error('break'));
                  } else {
                    next(buildError('model.tablecreation.schemamismatch', tableName));
                  }
                } else {
                  // alter type impossible
                  const permission = this._ask_confirmation(
                    util.format(
                      'Migration: model schema for table "%s" has new incompatible type for field "%s", drop column ' +
                      'and recreate? (column data will be lost & dependent indexes/views will be recreated!) (y/n): ',
                      tableName,
                      fieldName
                    )
                  );
                  if (permission.toLowerCase() === 'y') {
                    alterRemoveField((err1) => {
                      if (err1) next(err1);
                      else alterAddField();
                    });
                  } else {
                    next(buildError('model.tablecreation.schemamismatch', tableName));
                  }
                }
              } else {
                // alter type impossible
                const permission = this._ask_confirmation(
                  util.format(
                    'Migration: model schema for table "%s" has new incompatible type for field "%s", drop column ' +
                    'and recreate? (column data will be lost & dependent indexes/views will be recreated!) (y/n): ',
                    tableName,
                    fieldName
                  )
                );
                if (permission.toLowerCase() === 'y') {
                  alterRemoveField((err1) => {
                    if (err1) next(err1);
                    else alterAddField();
                  });
                } else {
                  next(buildError('model.tablecreation.schemamismatch', tableName));
                }
              }
            } else {
              next();
            }
          }, afterDBAlter);
        };

        if (migration === 'alter') {
          // check if table can be altered to match schema
          if (_.isEqual(normalizedModelSchema.key, normalizedDBSchema.key) &&
            _.isEqual(normalizedModelSchema.clustering_order, normalizedDBSchema.clustering_order)) {
            alterDBTable();
          } else {
            dropRecreateTable();
          }
        } else if (migration === 'drop') {
          dropRecreateTable();
        } else {
          callback(buildError('model.tablecreation.schemamismatch', tableName));
        }
      }
    } else {
      // if not existing, it's created
      const createTableQuery = this._create_table_query(tableName, modelSchema);
      this._execute_definition_query(createTableQuery, [], afterDBCreate);
    }
  });
};

BaseModel._create_table_query = function f(tableName, schema) {
  const rows = [];
  let fieldType;
  Object.keys(schema.fields).forEach((k) => {
    if (schema.fields[k].virtual) {
      return;
    }
    let segment = '';
    fieldType = schemer.get_field_type(schema, k);
    if (schema.fields[k].typeDef) {
      segment = util.format('"%s" %s%s', k, fieldType, schema.fields[k].typeDef);
    } else {
      segment = util.format('"%s" %s', k, fieldType);
    }

    if (schema.fields[k].static) {
      segment += ' STATIC';
    }

    rows.push(segment);
  });

  let partitionKey = schema.key[0];
  let clusteringKey = schema.key.slice(1, schema.key.length);
  const clusteringOrder = [];


  for (let field = 0; field < clusteringKey.length; field++) {
    if (schema.clustering_order
        && schema.clustering_order[clusteringKey[field]]
        && schema.clustering_order[clusteringKey[field]].toLowerCase() === 'desc') {
      clusteringOrder.push(util.format('"%s" DESC', clusteringKey[field]));
    } else {
      clusteringOrder.push(util.format('"%s" ASC', clusteringKey[field]));
    }
  }

  let clusteringOrderQuery = '';
  if (clusteringOrder.length > 0) {
    clusteringOrderQuery = util.format(' WITH CLUSTERING ORDER BY (%s)', clusteringOrder.toString());
  }

  if (partitionKey instanceof Array) {
    partitionKey = partitionKey.map((v) => (util.format('"%s"', v))).join(',');
  } else {
    partitionKey = util.format('"%s"', partitionKey);
  }

  if (clusteringKey.length) {
    clusteringKey = clusteringKey.map((v) => (util.format('"%s"', v))).join(',');
    clusteringKey = util.format(',%s', clusteringKey);
  } else {
    clusteringKey = '';
  }

  const query = util.format(
    'CREATE TABLE IF NOT EXISTS "%s" (%s , PRIMARY KEY((%s)%s))%s;',
    tableName,
    rows.join(' , '),
    partitionKey,
    clusteringKey,
    clusteringOrderQuery
  );

  return query;
};

BaseModel._create_materialized_view_query = function f(tableName, viewName, viewSchema) {
  const rows = [];

  for (let k = 0; k < viewSchema.select.length; k++) {
    if (viewSchema.select[k] === '*') rows.push(util.format('%s', viewSchema.select[k]));
    else rows.push(util.format('"%s"', viewSchema.select[k]));
  }

  let partitionKey = viewSchema.key[0];
  let clusteringKey = viewSchema.key.slice(1, viewSchema.key.length);
  const clusteringOrder = [];

  for (let field = 0; field < clusteringKey.length; field++) {
    if (viewSchema.clustering_order
        && viewSchema.clustering_order[clusteringKey[field]]
        && viewSchema.clustering_order[clusteringKey[field]].toLowerCase() === 'desc') {
      clusteringOrder.push(util.format('"%s" DESC', clusteringKey[field]));
    } else {
      clusteringOrder.push(util.format('"%s" ASC', clusteringKey[field]));
    }
  }

  let clusteringOrderQuery = '';
  if (clusteringOrder.length > 0) {
    clusteringOrderQuery = util.format(' WITH CLUSTERING ORDER BY (%s)', clusteringOrder.toString());
  }

  if (partitionKey instanceof Array) {
    partitionKey = partitionKey.map((v) => util.format('"%s"', v)).join(',');
  } else {
    partitionKey = util.format('"%s"', partitionKey);
  }

  if (clusteringKey.length) {
    clusteringKey = clusteringKey.map((v) => (util.format('"%s"', v))).join(',');
    clusteringKey = util.format(',%s', clusteringKey);
  } else {
    clusteringKey = '';
  }

  let whereClause = partitionKey.split(',').join(' IS NOT NULL AND ');
  if (clusteringKey) whereClause += clusteringKey.split(',').join(' IS NOT NULL AND ');
  whereClause += ' IS NOT NULL';

  const query = util.format(
    'CREATE MATERIALIZED VIEW IF NOT EXISTS "%s" AS SELECT %s FROM "%s" WHERE %s PRIMARY KEY((%s)%s)%s;',
    viewName,
    rows.join(' , '),
    tableName,
    whereClause,
    partitionKey,
    clusteringKey,
    clusteringOrderQuery
  );

  return query;
};

BaseModel._create_index_query = function f(tableName, indexName) {
  let query;
  const indexExpression = indexName.replace(/["\s]/g, '').split(/[()]/g);
  if (indexExpression.length > 1) {
    indexExpression[0] = indexExpression[0].toLowerCase();
    query = util.format(
      'CREATE INDEX IF NOT EXISTS ON "%s" (%s("%s"));',
      tableName,
      indexExpression[0],
      indexExpression[1]
    );
  } else {
    query = util.format(
      'CREATE INDEX IF NOT EXISTS ON "%s" ("%s");',
      tableName,
      indexExpression[0]
    );
  }

  return query;
};

BaseModel._create_custom_index_query = function f(tableName, customIndex) {
  let query = util.format(
    'CREATE CUSTOM INDEX IF NOT EXISTS ON "%s" ("%s") USING \'%s\'',
    tableName,
    customIndex.on,
    customIndex.using
  );

  if (Object.keys(customIndex.options).length > 0) {
    query += ' WITH OPTIONS = {';
    Object.keys(customIndex.options).forEach((key) => {
      query += util.format("'%s': '%s', ", key, customIndex.options[key]);
    });
    query = query.slice(0, -2);
    query += '}';
  }

  query += ';';

  return query;
};

BaseModel._get_db_table_schema = function f(callback) {
  const self = this;

  const tableName = this._properties.table_name;
  const keyspace = this._properties.keyspace;

  let query = 'SELECT * FROM system_schema.columns WHERE table_name = ? AND keyspace_name = ?;';

  self.execute_query(query, [tableName, keyspace], (err, resultColumns) => {
    if (err) {
      callback(buildError('model.tablecreation.dbschemaquery', err));
      return;
    }

    if (!resultColumns.rows || resultColumns.rows.length === 0) {
      callback(null, null);
      return;
    }

    const dbSchema = { fields: {}, typeMaps: {}, staticMaps: {} };

    for (let r = 0; r < resultColumns.rows.length; r++) {
      const row = resultColumns.rows[r];

      dbSchema.fields[row.column_name] = TYPE_MAP.extract_type(row.type);

      const typeMapDef = TYPE_MAP.extract_typeDef(row.type);
      if (typeMapDef.length > 0) {
        dbSchema.typeMaps[row.column_name] = typeMapDef;
      }

      if (row.kind === 'partition_key') {
        if (!dbSchema.key) dbSchema.key = [[]];
        dbSchema.key[0][row.position] = row.column_name;
      } else if (row.kind === 'clustering') {
        if (!dbSchema.key) dbSchema.key = [[]];
        if (!dbSchema.clustering_order) dbSchema.clustering_order = {};

        dbSchema.key[row.position + 1] = row.column_name;
        if (row.clustering_order && row.clustering_order.toLowerCase() === 'desc') {
          dbSchema.clustering_order[row.column_name] = 'DESC';
        } else {
          dbSchema.clustering_order[row.column_name] = 'ASC';
        }
      } else if (row.kind === 'static') {
        dbSchema.staticMaps[row.column_name] = true;
      }
    }

    query = 'SELECT * FROM system_schema.indexes WHERE table_name = ? AND keyspace_name = ?;';

    self.execute_query(query, [tableName, keyspace], (err1, resultIndexes) => {
      if (err1) {
        callback(buildError('model.tablecreation.dbschemaquery', err1));
        return;
      }

      for (let r = 0; r < resultIndexes.rows.length; r++) {
        const row = resultIndexes.rows[r];

        if (row.index_name) {
          const indexOptions = row.options;
          let target = indexOptions.target;
          target = target.replace(/["\s]/g, '');
          delete indexOptions.target;

          // keeping track of index names to drop index when needed
          if (!dbSchema.index_names) dbSchema.index_names = {};

          if (row.kind === 'CUSTOM') {
            const using = indexOptions.class_name;
            delete indexOptions.class_name;

            if (!dbSchema.custom_indexes) dbSchema.custom_indexes = [];
            const customIndexObject = {
              on: target,
              using,
              options: indexOptions,
            };
            dbSchema.custom_indexes.push(customIndexObject);
            dbSchema.index_names[objectHash(customIndexObject)] = row.index_name;
          } else {
            if (!dbSchema.indexes) dbSchema.indexes = [];
            dbSchema.indexes.push(target);
            dbSchema.index_names[target] = row.index_name;
          }
        }
      }

      query = 'SELECT view_name,base_table_name FROM system_schema.views WHERE keyspace_name=?;';

      self.execute_query(query, [keyspace], (err2, resultViews) => {
        if (err2) {
          callback(buildError('model.tablecreation.dbschemaquery', err2));
          return;
        }

        for (let r = 0; r < resultViews.rows.length; r++) {
          const row = resultViews.rows[r];

          if (row.base_table_name === tableName) {
            if (!dbSchema.materialized_views) dbSchema.materialized_views = {};
            dbSchema.materialized_views[row.view_name] = {};
          }
        }

        if (dbSchema.materialized_views) {
          query = 'SELECT * FROM system_schema.columns WHERE keyspace_name=? and table_name IN ?;';

          self.execute_query(query, [keyspace, Object.keys(dbSchema.materialized_views)], (err3, resultMatViews) => {
            if (err3) {
              callback(buildError('model.tablecreation.dbschemaquery', err3));
              return;
            }

            for (let r = 0; r < resultMatViews.rows.length; r++) {
              const row = resultMatViews.rows[r];

              if (!dbSchema.materialized_views[row.table_name].select) {
                dbSchema.materialized_views[row.table_name].select = [];
              }

              dbSchema.materialized_views[row.table_name].select.push(row.column_name);

              if (row.kind === 'partition_key') {
                if (!dbSchema.materialized_views[row.table_name].key) {
                  dbSchema.materialized_views[row.table_name].key = [[]];
                }

                dbSchema.materialized_views[row.table_name].key[0][row.position] = row.column_name;
              } else if (row.kind === 'clustering') {
                if (!dbSchema.materialized_views[row.table_name].key) {
                  dbSchema.materialized_views[row.table_name].key = [[]];
                }
                if (!dbSchema.materialized_views[row.table_name].clustering_order) {
                  dbSchema.materialized_views[row.table_name].clustering_order = {};
                }

                dbSchema.materialized_views[row.table_name].key[row.position + 1] = row.column_name;
                if (row.clustering_order && row.clustering_order.toLowerCase() === 'desc') {
                  dbSchema.materialized_views[row.table_name].clustering_order[row.column_name] = 'DESC';
                } else {
                  dbSchema.materialized_views[row.table_name].clustering_order[row.column_name] = 'ASC';
                }
              }
            }

            callback(null, dbSchema);
          });
        } else {
          callback(null, dbSchema);
        }
      });
    });
  });
};

BaseModel._execute_table_query = function f(query, params, options, callback) {
  if (arguments.length === 3) {
    callback = options;
    options = {};
  }

  const defaults = {
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  const doExecuteQuery = function f1(doquery, docallback) {
    this.execute_query(doquery, params, options, docallback);
  }.bind(this, query);

  if (this.is_table_ready()) {
    doExecuteQuery(callback);
  } else {
    this.init((err) => {
      if (err) {
        callback(err);
        return;
      }
      doExecuteQuery(callback);
    });
  }
};

BaseModel._get_db_value_expression = function f(fieldname, fieldvalue) {
  if (fieldvalue == null || fieldvalue === cql.types.unset) {
    return { query_segment: '?', parameter: fieldvalue };
  }

  if (_.isPlainObject(fieldvalue) && fieldvalue.$db_function) {
    return fieldvalue.$db_function;
  }

  const fieldtype = schemer.get_field_type(this._properties.schema, fieldname);
  const validators = this._get_validators(fieldname);

  if (fieldvalue instanceof Array && fieldtype !== 'list' && fieldtype !== 'set' && fieldtype !== 'frozen') {
    const val = fieldvalue.map((v) => {
      const dbVal = this._get_db_value_expression(fieldname, v);

      if (_.isPlainObject(dbVal) && dbVal.query_segment) return dbVal.parameter;
      return dbVal;
    });

    return { query_segment: '?', parameter: val };
  }

  const validationMessage = this._validate(validators, fieldvalue);
  if (validationMessage !== true) {
    throw (buildError('model.validator.invalidvalue', validationMessage(fieldvalue, fieldname, fieldtype)));
  }

  if (fieldtype === 'counter') {
    let counterQuerySegment = util.format('"%s"', fieldname);
    if (fieldvalue >= 0) counterQuerySegment += ' + ?';
    else counterQuerySegment += ' - ?';
    fieldvalue = Math.abs(fieldvalue);
    return { query_segment: counterQuerySegment, parameter: fieldvalue };
  }

  return { query_segment: '?', parameter: fieldvalue };
};

BaseModel._create_where_clause = function f(queryObject) {
  const queryRelations = [];
  const queryParams = [];

  Object.keys(queryObject).forEach((k) => {
    if (k.indexOf('$') === 0) {
      // search queries based on lucene index or solr
      // escape all single quotes for queries in cassandra
      if (k === '$expr') {
        if (typeof queryObject[k].index === 'string' && typeof queryObject[k].query === 'string') {
          queryRelations.push(util.format(
            "expr(%s,'%s')",
            queryObject[k].index, queryObject[k].query.replace(/'/g, "''")
          ));
        } else {
          throw (buildError('model.find.invalidexpr'));
        }
      } else if (k === '$solr_query') {
        if (typeof queryObject[k] === 'string') {
          queryRelations.push(util.format(
            "solr_query='%s'",
            queryObject[k].replace(/'/g, "''")
          ));
        } else {
          throw (buildError('model.find.invalidsolrquery'));
        }
      }
      return;
    }

    let whereObject = queryObject[k];
    // Array of operators
    if (!(whereObject instanceof Array)) whereObject = [whereObject];

    for (let fk = 0; fk < whereObject.length; fk++) {
      let fieldRelation = whereObject[fk];

      const cqlOperators = {
        $eq: '=',
        $gt: '>',
        $lt: '<',
        $gte: '>=',
        $lte: '<=',
        $in: 'IN',
        $like: 'LIKE',
        $token: 'token',
        $contains: 'CONTAINS',
        $contains_key: 'CONTAINS KEY',
      };

      if (_.isPlainObject(fieldRelation)) {
        const validKeys = Object.keys(cqlOperators);
        const fieldRelationKeys = Object.keys(fieldRelation);
        for (let i = 0; i < fieldRelationKeys.length; i++) {
          if (validKeys.indexOf(fieldRelationKeys[i]) < 0) { // field relation key invalid
            fieldRelation = { $eq: fieldRelation };
            break;
          }
        }
      } else {
        fieldRelation = { $eq: fieldRelation };
      }

      const relKeys = Object.keys(fieldRelation);
      for (let rk = 0; rk < relKeys.length; rk++) {
        let firstKey = relKeys[rk];
        const firstValue = fieldRelation[firstKey];
        if (firstKey.toLowerCase() in cqlOperators) {
          firstKey = firstKey.toLowerCase();
          let op = cqlOperators[firstKey];

          if (firstKey === '$in' && !(firstValue instanceof Array)) throw (buildError('model.find.invalidinop'));
          if (firstKey === '$token' && !(firstValue instanceof Object)) throw (buildError('model.find.invalidtoken'));

          let whereTemplate = '"%s" %s %s';
          if (firstKey === '$token') {
            whereTemplate = 'token("%s") %s token(%s)';

            const tokenRelKeys = Object.keys(firstValue);
            for (let tokenRK = 0; tokenRK < tokenRelKeys.length; tokenRK++) {
              let tokenFirstKey = tokenRelKeys[tokenRK];
              const tokenFirstValue = firstValue[tokenFirstKey];
              tokenFirstKey = tokenFirstKey.toLowerCase();
              if ((tokenFirstKey in cqlOperators) && tokenFirstKey !== '$token' && tokenFirstKey !== '$in') {
                op = cqlOperators[tokenFirstKey];
              } else {
                throw (buildError('model.find.invalidtokenop', tokenFirstKey));
              }

              if (tokenFirstValue instanceof Array) {
                const tokenKeys = k.split(',');
                for (let tokenIndex = 0; tokenIndex < tokenFirstValue.length; tokenIndex++) {
                  tokenKeys[tokenIndex] = tokenKeys[tokenIndex].trim();
                  const dbVal = this._get_db_value_expression(tokenKeys[tokenIndex], tokenFirstValue[tokenIndex]);
                  if (_.isPlainObject(dbVal) && dbVal.query_segment) {
                    tokenFirstValue[tokenIndex] = dbVal.query_segment;
                    queryParams.push(dbVal.parameter);
                  } else {
                    tokenFirstValue[tokenIndex] = dbVal;
                  }
                }
                queryRelations.push(util.format(
                  whereTemplate,
                  tokenKeys.join('","'), op, tokenFirstValue.toString()
                ));
              } else {
                const dbVal = this._get_db_value_expression(k, tokenFirstValue);
                if (_.isPlainObject(dbVal) && dbVal.query_segment) {
                  queryRelations.push(util.format(
                    whereTemplate,
                    k, op, dbVal.query_segment
                  ));
                  queryParams.push(dbVal.parameter);
                } else {
                  queryRelations.push(util.format(
                    whereTemplate,
                    k, op, dbVal
                  ));
                }
              }
            }
          } else if (firstKey === '$contains') {
            const fieldtype1 = schemer.get_field_type(this._properties.schema, k);
            if (['map', 'list', 'set', 'frozen'].indexOf(fieldtype1) >= 0) {
              if (fieldtype1 === 'map' && _.isPlainObject(firstValue) && Object.keys(firstValue).length === 1) {
                queryRelations.push(util.format(
                  '"%s"[%s] %s %s',
                  k, '?', '=', '?'
                ));
                queryParams.push(Object.keys(firstValue)[0]);
                queryParams.push(firstValue[Object.keys(firstValue)[0]]);
              } else {
                queryRelations.push(util.format(
                  whereTemplate,
                  k, op, '?'
                ));
                queryParams.push(firstValue);
              }
            } else {
              throw (buildError('model.find.invalidcontainsop'));
            }
          } else if (firstKey === '$contains_key') {
            const fieldtype2 = schemer.get_field_type(this._properties.schema, k);
            if (['map'].indexOf(fieldtype2) >= 0) {
              queryRelations.push(util.format(
                whereTemplate,
                k, op, '?'
              ));
              queryParams.push(firstValue);
            } else {
              throw (buildError('model.find.invalidcontainskeyop'));
            }
          } else {
            const dbVal = this._get_db_value_expression(k, firstValue);
            if (_.isPlainObject(dbVal) && dbVal.query_segment) {
              queryRelations.push(util.format(
                whereTemplate,
                k, op, dbVal.query_segment
              ));
              queryParams.push(dbVal.parameter);
            } else {
              queryRelations.push(util.format(
                whereTemplate,
                k, op, dbVal
              ));
            }
          }
        } else {
          throw (buildError('model.find.invalidop', firstKey));
        }
      }
    }
  });

  return {
    query: (queryRelations.length > 0 ? util.format('WHERE %s', queryRelations.join(' AND ')) : ''),
    params: queryParams,
  };
};

BaseModel._create_find_query = function f(queryObject, options) {
  const orderKeys = [];
  let limit = null;

  Object.keys(queryObject).forEach((k) => {
    const queryItem = queryObject[k];
    if (k.toLowerCase() === '$orderby') {
      if (!(queryItem instanceof Object)) {
        throw (buildError('model.find.invalidorder'));
      }
      const orderItemKeys = Object.keys(queryItem);
      if (orderItemKeys.length > 1) throw (buildError('model.find.multiorder'));

      const cqlOrderDirection = { $asc: 'ASC', $desc: 'DESC' };
      if (orderItemKeys[0].toLowerCase() in cqlOrderDirection) {
        let orderFields = queryItem[orderItemKeys[0]];

        if (!(orderFields instanceof Array)) orderFields = [orderFields];

        for (let i = 0; i < orderFields.length; i++) {
          orderKeys.push(util.format(
            '"%s" %s',
            orderFields[i], cqlOrderDirection[orderItemKeys[0]]
          ));
        }
      } else {
        throw (buildError('model.find.invalidordertype', orderItemKeys[0]));
      }
    } else if (k.toLowerCase() === '$limit') {
      if (typeof queryItem !== 'number') throw (buildError('model.find.limittype'));
      limit = queryItem;
    }
  });

  const whereClause = this._create_where_clause(queryObject);

  let select = '*';
  if (options.select && _.isArray(options.select) && options.select.length > 0) {
    const selectArray = [];
    for (let i = 0; i < options.select.length; i++) {
      // separate the aggregate function and the column name if select is an aggregate function
      const selection = options.select[i].split(/[( )]/g).filter((e) => (e));
      if (selection.length === 1) {
        selectArray.push(util.format('"%s"', selection[0]));
      } else if (selection.length === 2 || selection.length === 4) {
        let functionClause = util.format('%s("%s")', selection[0], selection[1]);
        if (selection[2]) functionClause += util.format(' %s', selection[2]);
        if (selection[3]) functionClause += util.format(' %s', selection[3]);

        selectArray.push(functionClause);
      } else if (selection.length === 3) {
        selectArray.push(util.format('"%s" %s %s', selection[0], selection[1], selection[2]));
      } else {
        selectArray.push('*');
      }
    }
    select = selectArray.join(',');
  }

  let query = util.format(
    'SELECT %s %s FROM "%s" %s %s %s',
    (options.distinct ? 'DISTINCT' : ''),
    select,
    options.materialized_view ? options.materialized_view : this._properties.table_name,
    whereClause.query,
    orderKeys.length ? util.format('ORDER BY %s', orderKeys.join(', ')) : ' ',
    limit ? util.format('LIMIT %s', limit) : ' '
  );

  if (options.allow_filtering) query += ' ALLOW FILTERING;';
  else query += ';';

  return { query, params: whereClause.params };
};

BaseModel.get_table_name = function f() {
  return this._properties.table_name;
};

BaseModel.is_table_ready = function f() {
  return this._ready === true;
};

BaseModel.init = function f(options, callback) {
  if (!callback) {
    callback = options;
    options = undefined;
  }

  this._ready = true;
  callback();
};

BaseModel.syncDefinition = function f(callback) {
  const afterCreate = (err, result) => {
    if (err) callback(err);
    else {
      this._ready = true;
      callback(null, result);
    }
  };

  this._create_table(afterCreate);
};

BaseModel.execute_query = function f(query, params, options, callback) {
  if (arguments.length === 3) {
    callback = options;
    options = {};
  }

  const defaults = {
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  this._ensure_connected((err) => {
    if (err) {
      callback(err);
      return;
    }
    debug('executing query: %s with params: %j', query, params);
    this._properties.cql.execute(query, params, options, (err1, result) => {
      if (err1 && err1.code === 8704) {
        this._execute_definition_query(query, params, callback);
      } else {
        callback(err1, result);
      }
    });
  });
};

BaseModel.execute_eachRow = function f(query, params, options, onReadable, callback) {
  this._ensure_connected((err) => {
    if (err) {
      callback(err);
      return;
    }
    debug('executing eachRow query: %s with params: %j', query, params);
    this._properties.cql.eachRow(query, params, options, onReadable, callback);
  });
};

BaseModel._execute_table_eachRow = function f(query, params, options, onReadable, callback) {
  if (this.is_table_ready()) {
    this.execute_eachRow(query, params, options, onReadable, callback);
  } else {
    this.init((err) => {
      if (err) {
        callback(err);
        return;
      }
      this.execute_eachRow(query, params, options, onReadable, callback);
    });
  }
};

BaseModel.eachRow = function f(queryObject, options, onReadable, callback) {
  if (arguments.length === 3) {
    const cb = onReadable;
    onReadable = options;
    callback = cb;
    options = {};
  }
  if (typeof onReadable !== 'function') {
    throw (buildError('model.find.eachrowerror', 'no valid onReadable function was provided'));
  }
  if (typeof callback !== 'function') {
    throw (buildError('model.find.cberror'));
  }

  const defaults = {
    raw: false,
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  options.return_query = true;
  const selectQuery = this.find(queryObject, options);

  const queryOptions = { prepare: options.prepare };
  if (options.consistency) queryOptions.consistency = options.consistency;
  if (options.fetchSize) queryOptions.fetchSize = options.fetchSize;
  if (options.autoPage) queryOptions.autoPage = options.autoPage;
  if (options.hints) queryOptions.hints = options.hints;
  if (options.pageState) queryOptions.pageState = options.pageState;
  if (options.retry) queryOptions.retry = options.retry;
  if (options.serialConsistency) queryOptions.serialConsistency = options.serialConsistency;

  this._execute_table_eachRow(selectQuery.query, selectQuery.params, queryOptions, (n, row) => {
    if (!options.raw) {
      const ModelConstructor = this._properties.get_constructor();
      row = new ModelConstructor(row);
    }
    onReadable(n, row);
  }, (err, result) => {
    if (err) {
      callback(buildError('model.find.dberror', err));
      return;
    }
    callback(err, result);
  });
};

BaseModel.execute_stream = function f(query, params, options, onReadable, callback) {
  this._ensure_connected((err) => {
    if (err) {
      callback(err);
      return;
    }
    debug('executing stream query: %s with params: %j', query, params);
    this._properties.cql.stream(query, params, options).on('readable', onReadable).on('end', callback);
  });
};

BaseModel._execute_table_stream = function f(query, params, options, onReadable, callback) {
  if (this.is_table_ready()) {
    this.execute_stream(query, params, options, onReadable, callback);
  } else {
    this.init((err) => {
      if (err) {
        callback(err);
        return;
      }
      this.execute_stream(query, params, options, onReadable, callback);
    });
  }
};

BaseModel.stream = function f(queryObject, options, onReadable, callback) {
  if (arguments.length === 3) {
    const cb = onReadable;
    onReadable = options;
    callback = cb;
    options = {};
  }

  if (typeof onReadable !== 'function') {
    throw (buildError('model.find.streamerror', 'no valid onReadable function was provided'));
  }
  if (typeof callback !== 'function') {
    throw (buildError('model.find.cberror'));
  }

  const defaults = {
    raw: false,
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  options.return_query = true;
  const selectQuery = this.find(queryObject, options);

  const queryOptions = { prepare: options.prepare };
  if (options.consistency) queryOptions.consistency = options.consistency;
  if (options.fetchSize) queryOptions.fetchSize = options.fetchSize;
  if (options.autoPage) queryOptions.autoPage = options.autoPage;
  if (options.hints) queryOptions.hints = options.hints;
  if (options.pageState) queryOptions.pageState = options.pageState;
  if (options.retry) queryOptions.retry = options.retry;
  if (options.serialConsistency) queryOptions.serialConsistency = options.serialConsistency;

  const self = this;

  this._execute_table_stream(selectQuery.query, selectQuery.params, queryOptions, function f1() {
    const reader = this;
    reader.readRow = () => {
      const row = reader.read();
      if (!row) return row;
      if (!options.raw) {
        const ModelConstructor = self._properties.get_constructor();
        return new ModelConstructor(row);
      }
      return row;
    };
    onReadable(reader);
  }, (err) => {
    if (err) {
      callback(buildError('model.find.dberror', err));
      return;
    }
    callback();
  });
};

BaseModel.find = function f(queryObject, options, callback) {
  if (arguments.length === 2 && typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof callback !== 'function' && !options.return_query) {
    throw (buildError('model.find.cberror'));
  }

  const defaults = {
    raw: false,
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  // set raw true if select is used,
  // because casting to model instances may lead to problems
  if (options.select) options.raw = true;

  let queryParams = [];

  let query;
  try {
    const findQuery = this._create_find_query(queryObject, options);
    query = findQuery.query;
    queryParams = queryParams.concat(findQuery.params);
  } catch (e) {
    if (typeof callback === 'function') {
      callback(e);
      return {};
    }
    throw (e);
  }

  if (options.return_query) {
    return { query, params: queryParams };
  }

  const queryOptions = { prepare: options.prepare };
  if (options.consistency) queryOptions.consistency = options.consistency;
  if (options.fetchSize) queryOptions.fetchSize = options.fetchSize;
  if (options.autoPage) queryOptions.autoPage = options.autoPage;
  if (options.hints) queryOptions.hints = options.hints;
  if (options.pageState) queryOptions.pageState = options.pageState;
  if (options.retry) queryOptions.retry = options.retry;
  if (options.serialConsistency) queryOptions.serialConsistency = options.serialConsistency;

  this._execute_table_query(query, queryParams, queryOptions, (err, results) => {
    if (err) {
      callback(buildError('model.find.dberror', err));
      return;
    }
    if (!options.raw) {
      const ModelConstructor = this._properties.get_constructor();
      results = results.rows.map((res) => {
        delete (res.columns);
        return new ModelConstructor(res);
      });
      callback(null, results);
    } else {
      results = results.rows.map((res) => {
        delete (res.columns);
        return res;
      });
      callback(null, results);
    }
  });

  return {};
};

BaseModel.findOne = function f(queryObject, options, callback) {
  if (arguments.length === 2 && typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof callback !== 'function' && !options.return_query) {
    throw (buildError('model.find.cberror'));
  }

  queryObject.$limit = 1;

  return this.find(queryObject, options, (err, results) => {
    if (err) {
      callback(err);
      return;
    }
    if (results.length > 0) {
      callback(null, results[0]);
      return;
    }
    callback();
  });
};

BaseModel.update = function f(queryObject, updateValues, options, callback) {
  if (arguments.length === 3 && typeof options === 'function') {
    callback = options;
    options = {};
  }

  const schema = this._properties.schema;

  const defaults = {
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  let queryParams = [];

  const updateClauseArray = [];

  let errorHappened = Object.keys(updateValues).some((key) => {
    if (schema.fields[key] === undefined || schema.fields[key].virtual) return false;

    // check field value
    const fieldtype = schemer.get_field_type(schema, key);
    let fieldvalue = updateValues[key];

    if (fieldvalue === undefined) {
      fieldvalue = this._get_default_value(key);
      if (fieldvalue === undefined) {
        if (schema.key.indexOf(key) >= 0 || schema.key[0].indexOf(key) >= 0) {
          if (typeof callback === 'function') {
            callback(buildError('model.update.unsetkey', key));
            return true;
          }
          throw (buildError('model.update.unsetkey', key));
        } else if (schema.fields[key].rule && schema.fields[key].rule.required) {
          if (typeof callback === 'function') {
            callback(buildError('model.update.unsetrequired', key));
            return true;
          }
          throw (buildError('model.update.unsetrequired', key));
        } else return false;
      } else if (!schema.fields[key].rule || !schema.fields[key].rule.ignore_default) {
        // did set a default value, ignore default is not set
        if (this.validate(key, fieldvalue) !== true) {
          if (typeof callback === 'function') {
            callback(buildError('model.update.invaliddefaultvalue', fieldvalue, key, fieldtype));
            return true;
          }
          throw (buildError('model.update.invaliddefaultvalue', fieldvalue, key, fieldtype));
        }
      }
    }

    if (fieldvalue === null || fieldvalue === cql.types.unset) {
      if (schema.key.indexOf(key) >= 0 || schema.key[0].indexOf(key) >= 0) {
        if (typeof callback === 'function') {
          callback(buildError('model.update.unsetkey', key));
          return true;
        }
        throw (buildError('model.update.unsetkey', key));
      } else if (schema.fields[key].rule && schema.fields[key].rule.required) {
        if (typeof callback === 'function') {
          callback(buildError('model.update.unsetrequired', key));
          return true;
        }
        throw (buildError('model.update.unsetrequired', key));
      }
    }


    try {
      let $add = false;
      let $append = false;
      let $prepend = false;
      let $replace = false;
      let $remove = false;
      if (_.isPlainObject(fieldvalue)) {
        if (fieldvalue.$add) {
          fieldvalue = fieldvalue.$add;
          $add = true;
        } else if (fieldvalue.$append) {
          fieldvalue = fieldvalue.$append;
          $append = true;
        } else if (fieldvalue.$prepend) {
          fieldvalue = fieldvalue.$prepend;
          $prepend = true;
        } else if (fieldvalue.$replace) {
          fieldvalue = fieldvalue.$replace;
          $replace = true;
        } else if (fieldvalue.$remove) {
          fieldvalue = fieldvalue.$remove;
          $remove = true;
        }
      }

      const dbVal = this._get_db_value_expression(key, fieldvalue);

      if (_.isPlainObject(dbVal) && dbVal.query_segment) {
        if (['map', 'list', 'set'].indexOf(fieldtype) > -1) {
          if ($add || $append) {
            dbVal.query_segment = util.format('"%s" + %s', key, dbVal.query_segment);
          } else if ($prepend) {
            if (fieldtype === 'list') {
              dbVal.query_segment = util.format('%s + "%s"', dbVal.query_segment, key);
            } else {
              throw (buildError(
                'model.update.invalidprependop',
                util.format('%s datatypes does not support $prepend, use $add instead', fieldtype)
              ));
            }
          } else if ($remove) {
            dbVal.query_segment = util.format('"%s" - %s', key, dbVal.query_segment);
            if (fieldtype === 'map') dbVal.parameter = Object.keys(dbVal.parameter);
          }
        }

        if ($replace) {
          if (fieldtype === 'map') {
            updateClauseArray.push(util.format('"%s"[?]=%s', key, dbVal.query_segment));
            const replaceKeys = Object.keys(dbVal.parameter);
            const replaceValues = _.values(dbVal.parameter);
            if (replaceKeys.length === 1) {
              queryParams.push(replaceKeys[0]);
              queryParams.push(replaceValues[0]);
            } else {
              throw (
                buildError('model.update.invalidreplaceop', '$replace in map does not support more than one item')
              );
            }
          } else if (fieldtype === 'list') {
            updateClauseArray.push(util.format('"%s"[?]=%s', key, dbVal.query_segment));
            if (dbVal.parameter.length === 2) {
              queryParams.push(dbVal.parameter[0]);
              queryParams.push(dbVal.parameter[1]);
            } else {
              throw (buildError(
                'model.update.invalidreplaceop',
                '$replace in list should have exactly 2 items, first one as the index and the second one as the value'
              ));
            }
          } else {
            throw (buildError(
              'model.update.invalidreplaceop',
              util.format('%s datatypes does not support $replace', fieldtype)
            ));
          }
        } else {
          updateClauseArray.push(util.format('"%s"=%s', key, dbVal.query_segment));
          queryParams.push(dbVal.parameter);
        }
      } else {
        updateClauseArray.push(util.format('"%s"=%s', key, dbVal));
      }
    } catch (e) {
      if (typeof callback === 'function') {
        callback(e);
        return true;
      }
      throw (e);
    }
    return false;
  });

  if (errorHappened) return {};

  let query = 'UPDATE "%s"';
  let where = '';
  if (options.ttl) query += util.format(' USING TTL %s', options.ttl);
  query += ' SET %s %s';
  try {
    const whereClause = this._create_where_clause(queryObject);
    where = whereClause.query;
    queryParams = queryParams.concat(whereClause.params);
  } catch (e) {
    if (typeof callback === 'function') {
      callback(e);
      return {};
    }
    throw (e);
  }
  query = util.format(query, this._properties.table_name, updateClauseArray.join(', '), where);

  if (options.conditions) {
    const updateConditionsArray = [];

    errorHappened = Object.keys(options.conditions).some((key) => {
      try {
        const dbVal = this._get_db_value_expression(key, options.conditions[key]);
        if (_.isPlainObject(dbVal) && dbVal.query_segment) {
          updateConditionsArray.push(util.format('"%s"=%s', key, dbVal.query_segment));
          queryParams.push(dbVal.parameter);
        } else {
          updateConditionsArray.push(util.format('"%s"=%s', key, dbVal));
        }
      } catch (e) {
        if (typeof callback === 'function') {
          callback(e);
          return true;
        }
        throw (e);
      }
      return false;
    });

    if (errorHappened) return {};

    query += util.format(' IF %s', updateConditionsArray.join(' AND '));
  }
  if (options.if_exists) query += ' IF EXISTS';

  query += ';';

  if (options.return_query) {
    return { query, params: queryParams };
  }

  const queryOptions = { prepare: options.prepare };
  if (options.consistency) queryOptions.consistency = options.consistency;
  if (options.fetchSize) queryOptions.fetchSize = options.fetchSize;
  if (options.autoPage) queryOptions.autoPage = options.autoPage;
  if (options.hints) queryOptions.hints = options.hints;
  if (options.pageState) queryOptions.pageState = options.pageState;
  if (options.retry) queryOptions.retry = options.retry;
  if (options.serialConsistency) queryOptions.serialConsistency = options.serialConsistency;

  // set dummy hook function if not present in schema
  if (typeof schema.before_update !== 'function') {
    schema.before_update = function f1(queryObj, updateVal, optionsObj, next) {
      next();
    };
  }

  if (typeof schema.after_update !== 'function') {
    schema.after_update = function f1(queryObj, updateVal, optionsObj, next) {
      next();
    };
  }

  schema.before_update(queryObject, updateValues, options, (error) => {
    if (error) {
      if (typeof callback === 'function') {
        callback(buildError('model.update.before.error', error));
        return;
      }
      throw (buildError('model.update.before.error', error));
    }

    this._execute_table_query(query, queryParams, queryOptions, (err, results) => {
      if (typeof callback === 'function') {
        if (err) {
          callback(buildError('model.update.dberror', err));
          return;
        }
        schema.after_update(queryObject, updateValues, options, (error1) => {
          if (error1) {
            callback(buildError('model.update.after.error', error1));
            return;
          }
          callback(null, results);
        });
      } else if (err) {
        throw (buildError('model.update.dberror', err));
      } else {
        schema.after_update(queryObject, updateValues, options, (error1) => {
          if (error1) {
            throw (buildError('model.update.after.error', error1));
          }
        });
      }
    });
  });

  return {};
};

BaseModel.delete = function f(queryObject, options, callback) {
  if (arguments.length === 2 && typeof options === 'function') {
    callback = options;
    options = {};
  }

  const defaults = {
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  let queryParams = [];

  let query = 'DELETE FROM "%s" %s;';
  let where = '';
  try {
    const whereClause = this._create_where_clause(queryObject);
    where = whereClause.query;
    queryParams = queryParams.concat(whereClause.params);
  } catch (e) {
    if (typeof callback === 'function') {
      callback(e);
      return {};
    }
    throw (e);
  }

  query = util.format(query, this._properties.table_name, where);

  if (options.return_query) {
    return { query, params: queryParams };
  }

  const queryOptions = { prepare: options.prepare };
  if (options.consistency) queryOptions.consistency = options.consistency;
  if (options.fetchSize) queryOptions.fetchSize = options.fetchSize;
  if (options.autoPage) queryOptions.autoPage = options.autoPage;
  if (options.hints) queryOptions.hints = options.hints;
  if (options.pageState) queryOptions.pageState = options.pageState;
  if (options.retry) queryOptions.retry = options.retry;
  if (options.serialConsistency) queryOptions.serialConsistency = options.serialConsistency;

  // set dummy hook function if not present in schema
  const schema = this._properties.schema;
  if (typeof schema.before_delete !== 'function') {
    schema.before_delete = function f1(queryObj, optionsObj, next) {
      next();
    };
  }

  if (typeof schema.after_delete !== 'function') {
    schema.after_delete = function f1(queryObj, optionsObj, next) {
      next();
    };
  }

  schema.before_delete(queryObject, options, (error) => {
    if (error) {
      if (typeof callback === 'function') {
        callback(buildError('model.delete.before.error', error));
        return;
      }
      throw (buildError('model.delete.before.error', error));
    }

    this._execute_table_query(query, queryParams, queryOptions, (err, results) => {
      if (typeof callback === 'function') {
        if (err) {
          callback(buildError('model.delete.dberror', err));
          return;
        }
        schema.after_delete(queryObject, options, (error1) => {
          if (error1) {
            callback(buildError('model.delete.after.error', error1));
            return;
          }
          callback(null, results);
        });
      } else if (err) {
        throw (buildError('model.delete.dberror', err));
      } else {
        schema.after_delete(queryObject, options, (error1) => {
          if (error1) {
            throw (buildError('model.delete.after.error', error1));
          }
        });
      }
    });
  });

  return {};
};

BaseModel.drop_mviews = function f(mviews, callback) {
  async.each(mviews, (view, viewCallback) => {
    const query = util.format('DROP MATERIALIZED VIEW IF EXISTS "%s";', view);
    this._execute_definition_query(query, [], viewCallback);
  }, (err) => {
    if (err) callback(err);
    else callback();
  });
};

BaseModel.drop_indexes = function f(indexes, callback) {
  async.each(indexes, (index, indexCallback) => {
    const query = util.format('DROP INDEX IF EXISTS "%s";', index);
    this._execute_definition_query(query, [], indexCallback);
  }, (err) => {
    if (err) callback(err);
    else callback();
  });
};

BaseModel.alter_table = function f(operation, fieldname, type, callback) {
  const properties = this._properties;
  const tableName = properties.table_name;

  if (operation === 'ALTER') type = util.format('TYPE %s', type);
  else if (operation === 'DROP') type = '';

  const query = util.format('ALTER TABLE "%s" %s "%s" %s;', tableName, operation, fieldname, type);
  this._execute_definition_query(query, [], callback);
};

BaseModel.drop_table = function f(callback) {
  const properties = this._properties;
  const tableName = properties.table_name;

  const query = util.format('DROP TABLE IF EXISTS "%s";', tableName);
  this._execute_definition_query(query, [], callback);
};

BaseModel.prototype._get_data_types = function f() {
  return cql.types;
};

BaseModel.prototype._get_default_value = function f(fieldname) {
  const properties = this.constructor._properties;
  const schema = properties.schema;

  if (_.isPlainObject(schema.fields[fieldname]) && schema.fields[fieldname].default !== undefined) {
    if (typeof schema.fields[fieldname].default === 'function') {
      return schema.fields[fieldname].default.call(this);
    }
    return schema.fields[fieldname].default;
  }
  return undefined;
};

BaseModel.prototype.validate = function f(propertyName, value) {
  value = value || this[propertyName];
  this._validators = this._validators || {};
  return this.constructor._validate(this._validators[propertyName] || [], value);
};

BaseModel.prototype.save = function fn(options, callback) {
  if (arguments.length === 1 && typeof options === 'function') {
    callback = options;
    options = {};
  }

  const identifiers = [];
  const values = [];
  const properties = this.constructor._properties;
  const schema = properties.schema;

  const defaults = {
    prepare: true,
  };

  options = _.defaultsDeep(options, defaults);

  const queryParams = [];

  const errorHappened = Object.keys(schema.fields).some((f) => {
    if (schema.fields[f].virtual) return false;

    // check field value
    const fieldtype = schemer.get_field_type(schema, f);
    let fieldvalue = this[f];

    if (fieldvalue === undefined) {
      fieldvalue = this._get_default_value(f);
      if (fieldvalue === undefined) {
        if (schema.key.indexOf(f) >= 0 || schema.key[0].indexOf(f) >= 0) {
          if (typeof callback === 'function') {
            callback(buildError('model.save.unsetkey', f));
            return true;
          }
          throw (buildError('model.save.unsetkey', f));
        } else if (schema.fields[f].rule && schema.fields[f].rule.required) {
          if (typeof callback === 'function') {
            callback(buildError('model.save.unsetrequired', f));
            return true;
          }
          throw (buildError('model.save.unsetrequired', f));
        } else return false;
      } else if (!schema.fields[f].rule || !schema.fields[f].rule.ignore_default) {
        // did set a default value, ignore default is not set
        if (this.validate(f, fieldvalue) !== true) {
          if (typeof callback === 'function') {
            callback(buildError('model.save.invaliddefaultvalue', fieldvalue, f, fieldtype));
            return true;
          }
          throw (buildError('model.save.invaliddefaultvalue', fieldvalue, f, fieldtype));
        }
      }
    }

    if (fieldvalue === null || fieldvalue === cql.types.unset) {
      if (schema.key.indexOf(f) >= 0 || schema.key[0].indexOf(f) >= 0) {
        if (typeof callback === 'function') {
          callback(buildError('model.save.unsetkey', f));
          return true;
        }
        throw (buildError('model.save.unsetkey', f));
      } else if (schema.fields[f].rule && schema.fields[f].rule.required) {
        if (typeof callback === 'function') {
          callback(buildError('model.save.unsetrequired', f));
          return true;
        }
        throw (buildError('model.save.unsetrequired', f));
      }
    }

    identifiers.push(util.format('"%s"', f));

    try {
      const dbVal = this.constructor._get_db_value_expression(f, fieldvalue);
      if (_.isPlainObject(dbVal) && dbVal.query_segment) {
        values.push(dbVal.query_segment);
        queryParams.push(dbVal.parameter);
      } else {
        values.push(dbVal);
      }
    } catch (e) {
      if (typeof callback === 'function') {
        callback(e);
        return true;
      }
      throw (e);
    }
    return false;
  });

  if (errorHappened) return {};

  let query = util.format(
    'INSERT INTO "%s" ( %s ) VALUES ( %s )',
    properties.table_name,
    identifiers.join(' , '),
    values.join(' , ')
  );

  if (options.if_not_exist) query += ' IF NOT EXISTS';
  if (options.ttl) query += util.format(' USING TTL %s', options.ttl);

  query += ';';

  if (options.return_query) {
    return { query, params: queryParams };
  }

  const queryOptions = { prepare: options.prepare };
  if (options.consistency) queryOptions.consistency = options.consistency;
  if (options.fetchSize) queryOptions.fetchSize = options.fetchSize;
  if (options.autoPage) queryOptions.autoPage = options.autoPage;
  if (options.hints) queryOptions.hints = options.hints;
  if (options.pageState) queryOptions.pageState = options.pageState;
  if (options.retry) queryOptions.retry = options.retry;
  if (options.serialConsistency) queryOptions.serialConsistency = options.serialConsistency;

  // set dummy hook function if not present in schema
  if (typeof schema.before_save !== 'function') {
    schema.before_save = function f(instance, option, next) {
      next();
    };
  }

  if (typeof schema.after_save !== 'function') {
    schema.after_save = function f(instance, option, next) {
      next();
    };
  }

  schema.before_save(this, options, (error) => {
    if (error) {
      if (typeof callback === 'function') {
        callback(buildError('model.save.before.error', error));
        return;
      }
      throw (buildError('model.save.before.error', error));
    }

    this.constructor._execute_table_query(query, queryParams, queryOptions, (err, result) => {
      if (typeof callback === 'function') {
        if (err) {
          callback(buildError('model.save.dberror', err));
          return;
        }
        schema.after_save(this, options, (error1) => {
          if (error1) {
            callback(buildError('model.save.after.error', error1));
            return;
          }
          callback(null, result);
        });
      } else if (err) {
        throw (buildError('model.save.dberror', err));
      } else {
        schema.after_save(this, options, (error1) => {
          if (error1) {
            throw (buildError('model.save.after.error', error1));
          }
        });
      }
    });
  });

  return {};
};

BaseModel.prototype.delete = function f(options, callback) {
  if (arguments.length === 1 && typeof options === 'function') {
    callback = options;
    options = {};
  }

  const schema = this.constructor._properties.schema;
  const deleteQuery = {};

  for (let i = 0; i < schema.key.length; i++) {
    const fieldKey = schema.key[i];
    if (fieldKey instanceof Array) {
      for (let j = 0; j < fieldKey.length; j++) {
        deleteQuery[fieldKey[j]] = this[fieldKey[j]];
      }
    } else {
      deleteQuery[fieldKey] = this[fieldKey];
    }
  }

  return this.constructor.delete(deleteQuery, options, callback);
};

BaseModel.prototype.toJSON = function toJSON() {
  const object = {};
  const schema = this.constructor._properties.schema;

  Object.keys(schema.fields).forEach((field) => {
    object[field] = this[field];
  });

  return object;
};

module.exports = BaseModel;
