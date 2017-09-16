'use strict';

var merge = require('merge');
var fs = require('fs');
var path = require('path');
var Promise = require('promise');
var common = require('./common');

var writeFile = Promise.denodeify(fs.writeFile);
var readFile = Promise.denodeify(fs.readFile);
var unlink = Promise.denodeify(fs.unlink);
var access = Promise.denodeify(fs.access);
var readdir = Promise.denodeify(fs.readdir);

/**
 * Creates a JSON folder database instance
 *
 * @param {String} file Folder for the database
 * @param {Object} options Options for the folder database
 *
 * @constructor
 */
module.exports = function JsonFolderDB(file, options) {
  // Load existing data
  void 0;
  options = options || {};

  var cachedData, cachedKeys;

  // TODO Attach listener on to file
  if (options.listen) {
    fs.watch(file, {
      persistent: true,
      recursive: true
    }, listener);
  }

  /**
   * Cleans up after the CRUD instance. Should be called just before the
   * instance is deleted
   *
   * @returns {undefined}
   */
  function close() {
    if (options.listen) {
      fs.unwatch(file, listener);
    }
  }

  /** @private
   * Get the filename for a given id
   *
   * @param {String} id Id of parameter to get filename for
   *
   * @returns {String} The filename for the given id
   */
  function getFilename(id) {
    // @TODO Sanitise id string
    return path.join(file, id + '.json');
  }

  /** @private
   * Retreives the value for a given id from the associated file
   *
   * @param {String} [id] Id of parameter to get filename for
   *
   * @returns {Promise} A promise that will resolve to the data
   */
  function readData(id) {
    var filename = getFilename(id);

    if (typeof id === 'undefined') {
      var keysPromise;
      if (options.cacheKeys) {
        keysPromise = Promise.resolve(cachedKeys);
      } else {
        keysPromise = readKeys();
      }
      return keysPromise.then(function(keys) {
        return Promise.reject(new Error('TODO Read all data'));
        var promises = [];
        var data = {};

        keys.forEach(function(key) {
          promises.push(readData(key).then(function(keyData) {
            data[key] = keyData;
          }));
        });

        return Promise.all(promises).then(function() {
          return Promise.resolve(data);
        });
      });
    } else {
      // Check if file exists
      return access(filename, fs.R_OK | fs.W_OK).then(function() {
        return readFile(filename).then(function(buffer) {
          try {
            return Promise.resolve(JSON.parse(buffer));
          } catch (err) {
            return Promise.reject(err);
          }
        });
      }, function(err) {
        if (err.code === 'ENOENT') {
          return Promise.resolve(undefined);
        } else {
          return Promise.reject(err);
        }
      });
    }
  }

  /**@private
   * Reads the keys from the file
   *
   * @returns {Promise} A promise that resolves to an array of the keys
   */
  function readKeys() {
    return readdir(file).then(function(files) {
      var keys = [];

      files.forEach(function(filename) {
        if (filename.endsWith('.json')) {
          keys.push(filename.replace(/\.json$/, ''));
        }
      });

      return Promise.resolve(keys);
    });
  }


  /** @private
   * Does the actual saving of the data to the file. Called by (@see save)
   *
   * @param {String} id String identifier of parameter that is to be saved
   * @param {*} data Data to be saved. If undefined, current value will be
   *   deleted.
   *
   * @returns {Promise} A promise that will resolve when the save is complete
   */
  function saveData(id, data) {
    void 0;
    var filename = getFilename(id);
    if (typeof data === 'undefined') {
      // Delete file if exists
      return unlink(filename);
    } else {
      return writeFile(filename, JSON.stringify(data, null, 2));
    }
  }

  /**
   * Saves the data back to the file
   *
   * @param {Object} data Data for saving
   * @param {Boolean} [data.replace] Whether data should be replaced. If true,
   *   data should be replaced, if false an error should thrown / the promise
   *   rejected. If undefined, data should be merged/replaced
   * @param {Boolean} data.keys Whether or not data is in key/value pairs
   * @param {Array} data.data Data to be saved
   *
   * @returns {Promise} A promise that will resolve to an array of the keys of
   *   the data saved
   */
  function save(data) {
    void 0;
    var args = data.args;

    if (options.cacheData) {
      let saves = [], i;
      let keys = [];

      if (data.keys) {
        for (i = 0; i < args.length; i = i + 2) {
          if (data.replace === true || cachedData[args[i]] === undefined) {
            saves.push(saveData(args[i], args[i+1]));
            keys.push(args[i]);
          } else {
            saves.push(saveData(args[i],
                merge(cachedData[args[i]], args[i+1])));
            keys.push(args[i]);
          }
        }
      } else {
        for(i = 0; i < args.length; i++) {
          if (data.replace === true
              || cachedData[args[i][options.id]] === undefined) {
            saves.push(saveData(args[i][options.id], args[i+1]));
          } else {
            saves.push(saveData(args[i][options.id],
                merge(cachedData[args[i]], args[i+1])));
          }
        }
      }

      return Promise.all(saves).then(() => {
        return Promise.resolve(keys);
      });
    } else {
      // TODO Could possibly cause a race condition if multiple saves happen
      // at the same time, ie if multiple saves are called at once
      var keysPromise;
      if (data.replace === true) {
        keysPromise = Promise.resolve(false);
      } else if (options.cacheKeys) {
        keysPromise = Promise.resolve(cachedKeys);
      } else {
        keysPromise = readKeys();
      }

      return keysPromise.then(function(keys) {
        var i, saves = [];

        void 0;

        if (data.keys) {
          for (i = 0; i + 1 < args.length; i = i + 2) {
            let id, newData;
            if (data.replace === true) {
              saves.push(saveData(args[i], args[i+1]));
              keys.push(args[i]);
            } else {
              id = args[i];
              newData = args[i+1];
              saves.push(readData(id).then(function(currentData) {
                if (data === undefined) {
                  keys.push(id);
                  return saveData(id, newData);
                } else {
                  keys.push(id);
                  // Merge if both are mergable, otherwise replace
                  if (['object', 'array'].indexOf(typeof newData) !== -1
                      && typeof currentData === typeof newData) {
                    return saveData(id, merge(currentData, newData));
                  } else {
                    return saveData(id, newData);
                  }
                }
              }));
            }
          }
        } else {
          for(i = 0; i < args.length; i++) {
            let id, newData;
            if (data.replace === true) {
              saves.push(saveData(args[i], args[i+1]));
              keys.push(args[i]);
            } else {
              id = args[i][options.id];
              newData = args[i];
              saves.push(readData(id).then(function(currentData) {
                if (data === undefined) {
                  keys.push(id);
                  return saveData(id, newData);
                } else {
                  keys.push(id);
                  return saveData(id, merge(currentData, newData));
                }
              }));
            }
          }
        }

        return Promise.all(saves).then(function() {
          return Promise.resolve(keys);
        });
      });
    }
  }

  /**@private
   * Extracts the values for the given keys from the data Object
   *
   * @param {Key[]} keys Keys to get values for
   * @param {Boolean} [expectSingle] If true, the single value will be returned
   *   as only the value (as opposed to the normal key/value Object. If a single
   *   value is not going to be returned, the Promise will reject with an error.
   *
   * @returns {Promise} A promise that resolves to the data. If only one key is
   *   given, only the value will be returned. Otherwise it will be a Object
   *   containing the key/value pairs.
   */
  function getValues(keys, expectSingle) {
    void 0;
    var keyPromise;
    var result = {};
    if (options.cacheValues) {
      let data = cachedData;
      if (expectSingle) {
        if (keys.length === 1) {
          return Promise.resolve(cachedData[keys[0]]);
        } else {
          return Promise.reject(new Error('More than one value going to be '
              + 'returned: ' + keys));
        }
      } else {
        keys.forEach(function(key) {
          result[key] = data[key];
        });

        return Promise.resolve(result);
      }
    } else {
      if (options.cacheKeys) {
        keyPromise = Promise.resolve(cachedKeys);
      } else {
        keyPromise = readKeys();
      }

      return keyPromise.then(function(storedKeys) {
        var gets = [];

        if (expectSingle) {
          if (keys.length === 1) {
            void 0;
            return readData(keys[0]);
          } else {
            return Promise.reject(new Error('More than one value going to be '
                + 'returned: ' + keys));
          }
        } else {
          keys.forEach(function(key) {
            if (storedKeys.indexOf(key) !== -1) {
              gets.push(readData(key).then(function(data) {
                result[key] = data;
              }));
            }
          });

          return Promise.all(gets).then(function() {
            return Promise.resolve(result);
          });
        }
      });
    }
  }

  /**
   * Implements retrieving a value for the given key
   *
   * @param {Key|Key[]|Object} [filter] Filter to use to find values to retrieve
   * @param {Boolean} [expectSingle] If true, the single value will be returned
   *   as only the value (as opposed to the normal key/value Object. If a single
   *   value is not going to be returned, the Promise will reject with an error.
   *
   * @returns {Promise} A promise that will resolve to the value(s) for the given
   *   key(s)/filter(s).
   */
  function doRead(filter, expectSingle) {
    void 0;
    return new Promise(function(resolve, reject) {
      var fetchedData = {};
      if (common.keyTypes.indexOf(typeof filter) !== -1) {
        filter = [filter];
      } else if (filter instanceof Array) {
        // Check keys are all valid
        var f, length = filter.length;
        for(f = 0; f < length; f++) {
          if (common.keyTypes.indexOf(typeof filter[f]) === -1) {
            reject(new Error('Invalid key given: ' + filter[f]));
            return;
          }
        }
      } else if (typeof filter === 'undefined' || filter === null) {
        // Return all values
        if (options.cacheData) {
          resolve(cachedData);
        } else {
          readData().then(function(data) {
            resolve(data);
          });
        }
      } else if (typeof filter !== 'object') {
        reject(new Error('filter needs to be a key, an array of keys or a '
            + 'filter Object'));
        return;
      } else {
        if (options.cacheValues) {
          common.processFilter(cachedData, filter, function(id, itemData) {
            fetchedData[id] = itemData;
          }).then(function() {
            resolve(fetchedData);
          }, function(err) {
            reject(err);
          });
        } else {
          var keysPromise;
          if(options.cacheKeys) {
            keysPromise = Promise.resolve(cachedKeys);
          } else {
            keysPromise = readKeys();
          }

          keysPromise.then(function(keys) {
            var fetchPromises = [];
            keys.forEach(function(key) {
              fetchPromises.push(readData(key).then(function(data) {
                if (common.runFilter(data, filter)) {
                  fetchedData[key] = data;
                }
              }));
            });

            Promise.all(fetchPromises).then(function() {
              resolve(fetchedData);
            });
          });
        }
        return;
      }

      // Get values for keys
      return getValues(filter, expectSingle).then(function(data) {
        resolve(data);
      });
    });
  }

  /**
   * Delete a value/values from the JSON database
   *
   * @param {Key|Key[]|Object|true} filter Filter to use to find values to
   *   retrieve. If true, all will be deleted
   *
   * @returns {Key[]} An array containing the keys of the deleted data.
   */
  function doDelete(filter) {
    return new Promise(function(resolve, reject) {
      var keysPromise;

      if (filter === true) {
        // Delete all
        reject(new Error('TODO delete all'));
        return;
      } else if (common.keyTypes.indexOf(typeof filter) !== -1) {
        filter = [filter];
      } else if (filter instanceof Array) {
      } else if (typeof filter === 'object') {
        // Determine execution path for filter

        reject(new Error('TODO complex filters'));
      } else {
        reject({
          message: 'filter needs to be an object containing a filter'
        });
        return;
      }

      /* Get the list of keys */
      if (options.cacheKeys) {
        keysPromise = Promise.resolve(cachedKeys);
      } else {
        keysPromise = readKeys();
      }

      keysPromise.then(function(keys) {
        var deletes = [], deleteKeys = [];

        filter.forEach(function(id) {
          if (keys.indexOf(id) !== -1) {
            // TODO XXX Remove once file watch implemented
            if (options.cacheValues) {
              delete cachedData[id];
            }

            deleteKeys.push(id);
            deletes.push(saveData(id));
          }
        });

        Promise.all(deletes).then(function() {
          resolve(deleteKeys);
        });
      });
    });
  }

  /** @private
   * Called when the data file changes or is renamed
   *
   * @param {String} event Event type - rename or changed
   * @param {String} filename Filename of file that triggered event
   *
   * @returns {undefined}
   */
  function listener(event, filename) {
    if (event == 'rename') {
    } else {
      if (filename.match(/\.json$/)) {
        // Reload file
        cachedData = require(filename);
      }
    }
  }

  return common.newCrud(save, doRead,
      readKeys, doDelete, close, options);
};
