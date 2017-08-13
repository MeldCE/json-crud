'use strict';

var fs = require('fs');
var path = require('path');
var skemer = require('skemer');
var Promise = require('promise');
var merge = require('merge');

/*require('promise/lib/rejection-tracking').enable(
  {allRejections: true}
);*/

var JsonFileDB = require('./lib/JsonFileDB.js');
var JsonFolderDB = require('./lib/JsonFolderDB.js');
var optionsSchema = require('./lib/options.json');

/**
 * Generator function for creating a JSON DB. The database is equivalent to a
 * a single table or collection. The generator returns a promise that will
 * resolve to the JSON databaes if everything is ok.
 *
 * @param {String} [file] Path to file/folder to contain the JSON database
 * @param {Object} [options] Object containing the options for the database.
 * @param {String} [options.path] Path to file/folder to contain JSON database
 *   if not given as first argument
 * @param {String} [options.id] Field of data objects to be used as the key
 * @param {Boolean} [options.cacheKeys] Cache the keys of the objects in the
 *   database
 * @param {Boolean} [options.cacheValues] Cache the objects in the database
 *
 * @returns {Promise<JsonDBInstance>} A promise that will resolve to a JsonDB
 *   instance if everything checks out
 */
function jsonDB() {
  var args = Array.prototype.slice.call(arguments);
  return new Promise(function(resolve, reject) {
    var file, options, schema;

    if (args.length === 0) {
      return reject(new Error('No path or options given'));
    }

    // Check if we have a file
    if (typeof args[0] === 'string' || args[0] === false) {
      file = args.shift();
      schema = optionsSchema;
    } else {
      // Make file required
      schema = merge(true, optionsSchema);
      schema.type.path.required = true;
    }

    // Check for options
    try {
      options = skemer.validateNew({
        schema: schema,
        parameter: 'options'
      }, args[0] || {});
    } catch (err) {
      return reject(err);
    }

    if (typeof file === 'undefined') {
      file = options.path;
    }

    if (file === false) {
      JsonFileDB(false, options).then(function(instance) {
        resolve(instance);
      });
    } else {
      // Absolutise the file name with the CWD
      file = path.resolve(process.cwd(), file);

      // Check file/folder
      fs.access(file, fs.R_OK | fs.W_OK, function(err) {
        if (err) {
          switch (err.code) {
            case 'ENOENT': // File does not exist
              // Determine if should be a folder based on if it ends with .json
              if (file.endsWith('.json')) {
                // Try creating the file
                fs.writeFile(file, '{}', function(werr) {
                  if (werr) {
                    werr.message = 'Error trying to make file ' + file + ': '
                        + werr.message,
                    reject(werr);
                  }

                  JsonFileDB(file, options).then(function(instance) {
                    resolve(instance);
                  });
                });
              } else {
                // Try creating the folder
                fs.mkdir(file, function(merr) {
                  if (merr) {
                    merr.message = 'Error trying to make folder ' + file + ': '
                        + merr.message,
                    reject(merr);
                  }

                  JsonFolderDB(file, options).then(function(instance) {
                    resolve(instance);
                  });
                });
              }
              break;
            // @TODO Add permission error handling
            default:
              // Unknown error?
              //err.message = 'Error trying to access database ' + file + ': '
              //    + err.message;
              reject(err);
              break;
          }
        } else {
          // Create stat so can find out what file is
          fs.stat(file, function(serr, stats) {
            if (serr) {
              reject(serr);
            }

            try {
              if (stats.isDirectory()) {
                // Return JsonFolderDB
                JsonFolderDB(file, options).then(function(instance) {
                  resolve(instance);
                });
              } else if (stats.isFile()) {
                // Return JsonFileDB
                JsonFileDB(file, options).then(function(instance) {
                  resolve(instance);
                });
              }
            } catch(ferr) {
              reject(ferr);
            }
          });
        }
      });
    }
  });
}

module.exports = jsonDB;

