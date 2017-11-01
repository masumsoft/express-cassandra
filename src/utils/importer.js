const Promise = require('bluebird');
const _ = require('lodash');
const util = require('util');
const fs = require('fs');
const path = require('path');
const jsonStream = require('JSONStream');
const debug = require('debug')('express-cassandra');

const importer = {
  buildTableQueryForDataRow(keyspace, tableInfo, row) {
    row = _.omitBy(row, (item) => (item === null));
    let query = util.format('INSERT INTO "%s"."%s" ("%s") VALUES (?%s)', keyspace, tableInfo.name, _.keys(row).join('","'), _.repeat(',?', _.keys(row).length - 1));
    let params = _.values(row);
    if (tableInfo.isCounterTable) {
      const primaryKeyFields = _.pick(row, tableInfo.primaryKeys);
      const otherKeyFields = _.omit(row, tableInfo.primaryKeys);
      const setQueries = _.map(_.keys(otherKeyFields), (key) => util.format('"%s"="%s" + ?', key, key));
      const whereQueries = _.map(_.keys(primaryKeyFields), (key) => util.format('"%s"=?', key));
      query = util.format('UPDATE "%s"."%s" SET %s WHERE %s', keyspace, tableInfo.name, setQueries.join(', '), whereQueries.join(' AND '));
      params = _.values(otherKeyFields).concat(_.values(primaryKeyFields));
    }
    params = _.map(params, (param) => {
      if (_.isPlainObject(param)) {
        if (param.type === 'Buffer') {
          return Buffer.from(param);
        }
        const omittedParams = _.omitBy(param, (item) => (item === null));
        Object.keys(omittedParams).forEach((key) => {
          if (_.isObject(omittedParams[key]) && omittedParams[key].type === 'Buffer') {
            omittedParams[key] = Buffer.from(omittedParams[key]);
          }
        });
        return omittedParams;
      }
      return param;
    });
    return { query, params };
  },

  processTableImport(systemClient, fixtureDirectory, keyspace, table, batchSize) {
    return new Promise((resolve, reject) => {
      debug('==================================================');
      debug(`Reading metadata for table: ${table}`);
      systemClient.metadata.getTable(keyspace, table)
        .then((tableInfo) => {
          if (!tableInfo) {
            resolve();
            return;
          }
          const isCounterTable = _.some(tableInfo.columns, (column) => (column.type.code === 5));
          if (isCounterTable) batchSize = 1;
          let primaryKeys = [];
          primaryKeys = primaryKeys.concat(_.map(tableInfo.partitionKeys, (item) => item.name));
          primaryKeys = primaryKeys.concat(_.map(tableInfo.clusteringKeys, (item) => item.name));
          tableInfo.isCounterTable = isCounterTable;
          tableInfo.primaryKeys = primaryKeys;

          let queryPromises = [];
          let queries = [];
          let processed = 0;

          debug(`Creating read stream from: ${table}.json`);
          const jsonfile = fs.createReadStream(path.join(fixtureDirectory, `${table}.json`), { encoding: 'utf8' });
          const readStream = jsonfile.pipe(jsonStream.parse('*'));
          readStream.on('data', (row) => {
            processed++;

            const query = this.buildTableQueryForDataRow(keyspace, tableInfo, row);
            if (batchSize > 1) {
              queries.push(query);
              if (queries.length >= batchSize) {
                queryPromises.push(systemClient.batch(queries, { prepare: true }));
                queries = [];
              }
            } else {
              queryPromises.push(systemClient.execute(query.query, query.params, { prepare: true }));
            }

            const processPauseSize = (batchSize >= 10) ? batchSize * 10 : 100;
            if (processed % processPauseSize === 0) {
              jsonfile.pause();
              Promise.all(queryPromises)
                .then(() => {
                  queryPromises = [];
                  jsonfile.resume();
                })
                .catch((err) => {
                  reject(err);
                });
            }

            if (processed % 1000 === 0) {
              debug(`Streaming ${processed} rows to table: ${table}`);
            }
          });
          jsonfile.on('error', (err) => {
            reject(err);
          });

          const startTime = Date.now();
          jsonfile.on('end', () => {
            debug(`Streaming ${processed} rows to table: ${table}`);
            if (queries.length > 1) {
              queryPromises.push(systemClient.batch(queries, { prepare: true }));
            } else if (queries.length === 1) {
              queryPromises.push(systemClient.execute(queries[0].query, queries[0].params, { prepare: true }));
            }
            Promise.all(queryPromises)
              .then(() => {
                const timeTaken = (Date.now() - startTime) / 1000;
                const throughput = timeTaken ? processed / timeTaken : 0.00;
                debug(`Done with table, throughput: ${throughput.toFixed(1)} rows/s`);
                resolve();
              })
              .catch((err) => {
                reject(err);
              });
          });
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
};

module.exports = importer;
