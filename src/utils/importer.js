const Promise = require('bluebird');
const _ = require('lodash');
const util = require('util');
const fs = require('fs');
const path = require('path');
const jsonStream = require('JSONStream');
const debug = require('debug')('express-cassandra');

const importer = {
  buildTableQueryForDataRow(keyspace, tableInfo, row) {
    const isCounterTable = _.some(tableInfo.columns, (column) => (column.type.code === 5));
    row = _.omitBy(row, (item) => (item === null));
    let query = util.format('INSERT INTO "%s"."%s" ("%s") VALUES (?%s)', keyspace, tableInfo.name, _.keys(row).join('","'), _.repeat(',?', _.keys(row).length - 1));
    let params = _.values(row);
    if (isCounterTable) {
      let primaryKeys = [];
      primaryKeys = primaryKeys.concat(_.map(tableInfo.partitionKeys, (item) => item.name));
      primaryKeys = primaryKeys.concat(_.map(tableInfo.clusteringKeys, (item) => item.name));
      const primaryKeyFields = _.pick(row, primaryKeys);
      const otherKeyFields = _.omit(row, primaryKeys);
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

  processTableImport(systemClient, fixtureDirectory, keyspace, table) {
    return new Promise((resolve, reject) => {
      debug('==================================================');
      debug(`Reading metadata for table: ${table}`);
      systemClient.metadata.getTable(keyspace, table)
        .then((tableInfo) => {
          if (!tableInfo) {
            resolve();
            return;
          }

          debug(`Creating read stream from: ${table}.json`);
          const jsonfile = fs.createReadStream(path.join(fixtureDirectory, `${table}.json`), { encoding: 'utf8' });
          const readStream = jsonfile.pipe(jsonStream.parse('*'));
          let queryPromises = [];
          let processed = 0;
          readStream.on('data', (row) => {
            const query = this.buildTableQueryForDataRow(keyspace, tableInfo, row);
            queryPromises.push(systemClient.execute(query.query, query.params, { prepare: true }));
            processed++;

            if (processed % 1000 === 0) {
              debug(`Streaming ${processed} rows to table: ${table}`);
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
          });
          jsonfile.on('error', (err) => {
            reject(err);
          });

          const startTime = Date.now();
          jsonfile.on('end', () => {
            debug(`Streaming ${processed} rows to table: ${table}`);
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
