'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var skemer = require('skemer');

var JsonFileDB = require('./JsonFileDB.js');
var JsonFolderDB = require('./JsonFolderDB.js');
var optionsSchema = require('./options.json');

/**
 * Generator function for creating a JSON DB. The database is equivalent to a
 * a single table or collection. The generator returns a promise that will
 * resolve to the JSON databaes if everything is ok.
 *
 * @param {String} [file] Path to file/folder to contain the JSON database
 * @param {Object} [options] Object containing the options for the database.
 *        (@see (@link options)).
 *
 * @returns {Promise} A promise that will resolve to a JsonDB if everything
 *          checks out
 */
function jsonDB() {
  let args = Array.prototype.slice.call(arguments);
  return new Promise(function(resolve, reject) {
    let file, options;

    if (args.length === 0) {
      return reject(new Error('No path or options given'));
    }

    // Check if we have a file
    if (typeof args[0] === 'string') {
      file = args.shift();
    } else {
      // Make file required
      optionsSchema.type.path.required = true;
    }
    
    // Check for options
    if (args[0] instanceof Object) {
      try {
        options = skemer.validateNew({
          schema: optionsSchema,
          parameter: 'options'
        }, args[0] || {});
      } catch (err) {
        return reject(err);
      }

      if (file === undefined) {
        file = options.path;
      }
    }

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
              fs.writeFile(file, '{}', function(err) {
                if (err) {
                  err.message = 'Error trying to make file ' + file + ': '
                      + err.message,
                  reject(err);
                }

                resolve(new JsonFileDB(file, options));
              });
            } else {
              // Try creating the folder
              fs.mkdir(file, function(err) {
                if (err) {
                  err.message = 'Error trying to make folder ' + file + ': '
                      + err.message,
                  reject(err);
                }

                resolve(new JsonFolderDB(file, options));
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
        fs.stat(file, function(err, stats) {
          if (err) {
            reject(err);
          }

          try {
            if (stats.isDirectory()) {
              // Return JsonFolderDB
              resolve(new JsonFolderDB(file, options));
            } else if (stats.isFile()) {
              // Return JsonFileDB
              resolve(new JsonFileDB(file, options));
            }
          } catch(err) {
            reject(err);
          }
        });
      }
    });
  });
}

module.exports = jsonDB;

