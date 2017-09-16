"use strict";

var merge = require('merge');
var fs = require('fs');
var Promise = require('promise');
var common = require('./common');

var readFile = Promise.denodeify(fs.readFile);
var writeFile = Promise.denodeify(fs.writeFile);

/**
 *
 * Creates a JSON file database instance
 *
 * @param {String} file Filename of the database
 * @param {Object} options Options for the file database
 *
 * @constructor
 */
module.exports = function JsonFileDB(file, options) {
  var cachedData, cachedKeys;


  /**@private
   * Reads the data from the file
   *
   * @returns {Promise} A promise that resolves to the data
   */
  function readData() {
    return readFile(file).then(function(fileData) {
      try {
        //TODO Handle empty file/non-object file?
        return JSON.parse(fileData);
      } catch(err) {
        return Promise.reject(err);
      }
    });
  }

  /**@private
   * Reads the keys from the file
   *
   * @returns {Promise} A promise that resolves to an array of the keys
   */
  function readKeys() {
    return readData().then(function(data) {
      try {
        return Promise.resolve(Object.keys(data));
      } catch(err) {
        return Promise.reject(err);
      }
    });
  }

  /**@private
   * Saves the data to the file
   *
   * @param {*} data Data to save to file
   *
   * @returns {Promise} A promise that resolves to the data
   */
  function saveData(data) {
    console.log('saving data', data);
    if (options.cacheKeys) {
      cachedKeys = Object.keys(data);
    }
    return writeFile(file, JSON.stringify(data, null, 2));
  }

  /**
   * Saves the data back to the file
   *
   * @param {Object} data Data for saving
   * @param {Boolean} [data.replace] Whether data should be replaced. If true,
   *   data should be replaced, if false an error should thrown / the promise
   *   rejected. If undefined, data should be merged/replaced
   * @param {Boolean} data.keys Whether or not data is in key/value pairs
   * @param {Array} data.args Data to be saved
   *
   * @returns {Promise} A promise that will resolve to an array of the keys of
   *   the data saved
   */
  function save(data) {
    console.log('save', data);
    var cData, args = data.args, i;

    if (options.cacheData) {
      cData = Promise.resolve(cachedData);
    } else {
      cData = readData();
    }

    return cData.then(function(currentData) {
      if (data.keys) {
        for (i = 0; i < args.length; i = i + 2) {
          if (data.replace === true || currentData[args[i]] === undefined) {
            currentData[args[i]] = args[i+1];
          } else {
            currentData[args[i]] = merge(currentData[args[i]], args[i+1]);
          }
        }
      } else {
        for(i = 0; i < args.length; i++) {
          if (data.replace === true
              || currentData[args[i][options.id]] === undefined) {
            currentData[args[i][options.id]] = args[i];
          } else {
            currentData[args[i][options.id]]
                = merge(currentData[args[i]], args[i]);
          }
        }
      }

      if (options.cacheData) {
        cachedData = currentData;
      }

      return saveData(currentData);
    });
  }

  /**
   * Implements checking for if a value for a key exists
   *
   * @param {Key} key Key to see if there is a value for
   *
   * @returns {Promise} A promise that will resolve to a Boolean value of
   *   whether or not a value for the given key exists
   */
  function has(key) {
    if (options.cacheValues) {
      return Promise.resolve((cachedData[key] !== undefined));
    } else if (options.cacheKeys) {
      return Promise.resolve((cachedKeys.indexOf(key) !== -1));
    } else {
      return readData().then(function(data) {
        return (data[key] !== undefined);
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
    console.log('doRead called', filter);
    return new Promise(function(resolve, reject) {
      var ids, dataPromise;
      if (common.keyTypes.indexOf(typeof filter) !== -1) {
        ids = [filter];
      } else if (filter instanceof Array) {
        // Check keys are all valid
        var f, length = filter.length;
        for(f = 0; f < length; f++) {
          if (common.keyTypes.indexOf(typeof filter[f]) === -1) {
            reject(new Error('Invalid key given: ' + filter[f]));
            return;
          }
        }
        ids = filter;
      } else if (typeof filter === 'undefined' || filter === null) {
        // Return all values
        if (options.cacheData) {
          resolve(cachedData);
        } else {
          readData().then(function(data) {
            resolve(data);
          });
        }
        return;
      } else if (typeof filter !== 'object') {
        reject(new Error('filter needs to be a key, an array of keys or a '
            + 'filter Object'));
        return;
      } else {
        console.log('filter is an object');
        // Determine execution path for filter
        if (options.cacheValues) {
          dataPromise = Promise.resolve(cachedData);
        } else {
          dataPromise = readData();
        }

        dataPromise.then(function(data) {
          var fetchedData = {};
          var promises = [];
          Object.keys(data).forEach(function(id) {
            promises.push(new Promise(function(fresolve) {
              if (common.runFilter(data[id], filter)) {
                fetchedData[id] = data[id];
              }
              fresolve();
            }));
          });

          Promise.all(promises).then(function() {
            resolve(fetchedData);
          }, function(err) {
            reject(err);
          });
        });

        return;
      }

      // Get values for keys
      var promise;
      if (options.cacheValues) {
        promise = getValues(ids, cachedData, expectSingle);
      } else {
        promise = readData().then(function(data) {
          return getValues(ids, data, expectSingle);
        });
      }

      promise.then(function(data) {
        resolve(data);
      }, function(err) {
        reject(err);
      });
    });
  }

  /**@private
   * Extracts the values for the given keys from the data Object
   *
   * @param {Key[]} ids Keys to get values for
   * @param {Object} data Object to extract values from
   * @param {Boolean} [expectSingle] If true, the single value will be returned
   *   as only the value (as opposed to the normal key/value Object. If a single
   *   value is not going to be returned, the Promise will reject with an error.
   *
   * @returns {Promise} A promise that resolves to the data. If only one key is
   *   given, only the value will be returned. Otherwise it will be a Object
   *   containing the key/value pairs.
   */
  function getValues(ids, data, expectSingle) {
    console.log('getValues', arguments);
    if (expectSingle) {
      if (ids.length === 1) {
        return Promise.resolve(data[ids[0]]);
      } else {
        return Promise.reject(new Error('More than one value going to be '
            + 'returned: ' + ids));
      }
    } else {
      var result = {};

      ids.forEach(function(arg) {
        result[arg] = data[arg];
      });

      return Promise.resolve(result);
    }
  }

  /**
   * Retrieves a value from the JSON database
   *
   * @param {Key|Key[]|Object|true} filter Filter to use to find values to
   *   retrieve. If true, all will be deleted
   *
   * @returns {Key[]} An array containing the keys of the deleted data.
   */
  function doDelete(filter) {
    console.log('doDelete', filter);
    return new Promise(function(resolve, reject) {
      var i, keysPromise, dataPromise;

      if (filter === true) {
        // Delete all
        if (options.cacheKeys) {
          keysPromise = Promise.resolve(cachedKeys);
        } else {
          keysPromise = readKeys();
        }

        keysPromise.then(function(existingKeys) {
          if (options.cacheValues) {
            cachedData = {};
          }

          saveData({}).then(function() {
            resolve(existingKeys);
          });
        });
      } else if (common.keyTypes.indexOf(typeof filter) !== -1) {
        filter = [filter];
      } else if (filter instanceof Array) {
      } else if (typeof filter === 'object') {
        // Determine execution path for filter
        if (options.cacheValues) {
          dataPromise = Promise.resolve(cachedData);
        } else {
          dataPromise = readData();
        }

        dataPromise.then(function(data) {
          var deletedKeys = [];
          common.processFilter(data, filter, function(id) {
            deletedKeys.push(id);
            delete data[id];
          }).then(function() {
            return saveData(data);
          }).then(function() {
            resolve(deletedKeys);
          }, function(err) {
            reject(err);
          });
        });

        return;
      } else {
        reject({
          message: 'filter needs to be an object containing a filter'
        });
        return;
      }

      /* Check if we need to load the values key checking if the keys are
       *   actually in the database */
      if (!options.cacheValues && options.cacheKeys) {
        var haveKey = false;
        for (i in filter) {
          if(cachedKeys.indexOf(filter[i]) !== -1) {
            haveKey = true;
            break;
          }
        }
        if (haveKey) {
          dataPromise = readData();
        } else {
          resolve([]);
          return;
        }
      } else if (options.cacheValues) {
        dataPromise = Promise.resolve(cachedData);
      } else {
        dataPromise = readData();
      }

      dataPromise.then(function(data) {
        var deletedIds = [];
        // Go through and delete
        filter.forEach(function(id) {
          if (data[id] !== undefined) {
            delete data[id];
            deletedIds.push(id);
          }
        });

        return saveData(data).then(function() {
          resolve(deletedIds);
          return Promise.resolve();
        });
      });
    });

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
   * Called when the data file changes or is renamed
   *
   * @param {string} event Event type - rename or changed
   *
   * @returns {undefined}
   */
  function listener(event) {
    if (event == 'rename') {
    } else {
      // Reload file
      cachedData = readData();
    }
  }


  // Load existing data
  options = options || {};


  if (options.cacheValues) {
    cachedData = readData();
  } else if (options.cacheKeys) {
    cachedKeys = readKeys();
  }

  // TODO Attach listener on to file
  if (options.listen) {
    fs.watch(file, { persistent: true }, listener);
  }

  return common.newCrud(save, doRead,
      readKeys, doDelete, close, options);
};
