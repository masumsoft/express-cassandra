const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');
const jsonStream = require('JSONStream');
const debug = require('debug')('express-cassandra');

const exporter = {
  processTableExport(systemClient, fixtureDirectory, keyspace, table) {
    debug('==================================================');
    debug(`Reading table: ${table}`);
    return new Promise((resolve, reject) => {
      const jsonfile = fs.createWriteStream(path.join(fixtureDirectory, `${table}.json`));
      jsonfile.on('error', (err) => {
        reject(err);
      });

      let processed = 0;
      const startTime = Date.now();
      jsonfile.on('finish', () => {
        const timeTaken = (Date.now() - startTime) / 1000;
        const throughput = timeTaken ? processed / timeTaken : 0.00;
        debug(`Done with table, throughput: ${throughput.toFixed(1)} rows/s`);
        resolve();
      });

      const writeStream = jsonStream.stringify('[', ',', ']');
      writeStream.pipe(jsonfile);

      const query = `SELECT * FROM "${keyspace}"."${table}"`;
      const options = { prepare: true, fetchSize: 1000 };

      systemClient.eachRow(query, [], options, (n, row) => {
        const rowObject = {};
        row.forEach((value, key) => {
          rowObject[key] = value;
        });
        processed++;
        writeStream.write(rowObject);
      }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        debug(`Streaming ${processed} rows to: ${table}.json`);

        if (result.nextPage) {
          result.nextPage();
          return;
        }

        debug(`Finalizing writes into: ${table}.json`);
        writeStream.end();
      });
    });
  },
};

module.exports = exporter;
