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

  if (file === false) {
    options.cacheValues = true;
    cachedData = {};
  }

  /**@private
   * Reads the data from the file
   *
   * @param {boolean} [force] Whether or not to force a reread of the data
   *   from the file
   *
   * @returns {Promise} A promise that resolves to the data
   */
  function readData(force) {
    if (file === false || !force && options.cacheValues) {
      return  Promise.resolve(cachedData);
    }

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
   * @param {boolean} [force] Whether or not to force a reread of the data
   *   from the file
   *
   * @returns {Promise} A promise that resolves to an array of the keys
   */
  function readKeys(force) {
    if (!force && options.cacheKeys) {
      return Promise.resolve(cachedKeys);
    }

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
    if (file === false) {
      return Promise.resolve();
    } else {
      return writeFile(file, JSON.stringify(data, null, 2));
    }
  }

  /**
   * Saves the data back to the file
   *
   * @param {Object} saveArgs Data for saving
   * @param {Boolean} [saveArgs.replace] Whether data should be replaced. If true,
   *   data should be replaced, if false an error should thrown / the promise
   *   rejected. If undefined, data should be merged/replaced
   * @param {Boolean} saveArgs.keys Whether or not data is in key/value pairs
   * @param {Array|Object} saveArgs.data Data to be saved
   *
   * @returns {Promise} A promise that will resolve to an array of the keys or
   *   errors of the data saved
   */
  function save(saveArgs) {
    console.log('file save called', saveArgs);
    var cData, data = saveArgs.data, i, savedKeys = [];

    if (options.cacheValues) {
      cData = Promise.resolve(cachedData);
    } else {
      cData = readData();
    }

    return cData.then(function(currentData) {
      var error;
      console.log('current data is', currentData);
      if (saveArgs.data instanceof Array) {
        if (saveArgs.keys) {
          for (i = 0; i < data.length; i = i + 2) {
            if (saveArgs.replace === true
                || typeof currentData[data[i]] === 'undefined') {
              currentData[data[i]] = data[i+1];
            } else {
              if (saveArgs.replace === false) {
                error = new Error('Value for `' + data[i] + '` already exists');
                error.id = data[i];
                error.data = data[i+1];
                savedKeys.push(error);
                continue;
              }
              if (['object', 'array'].indexOf(typeof newData) !== -1
                  && typeof currentData[data[i]] === typeof data[i+1]) {
                currentData[data[i]] = merge(currentData[data[i]], data[i+1]);
              } else {
                currentData[data[i]] = data[i+1];
              }
            }
            savedKeys.push(data[i]);
          }
        } else {
          for(i = 0; i < data.length; i++) {
            var id = data[i][options.id];
            if (saveArgs.replace === true
                || currentData[id] === undefined) {
              currentData[id] = data[i];
            } else {
              if (saveArgs.replace === false) {
                console.log('rejecting');
                error = new Error('Value for `' + id + '` already exists');
                error.id = id;
                error.data = data[i];
                savedKeys.push(error);
                continue;
              }
              // Values must be an object so only need to check if the current
              // value is an object (but not an array)
              if (!(currentData[id] instanceof Array)
                  && typeof currentData[id] == 'object') {
                currentData[id]
                    = merge(currentData[id], data[i]);
              } else {
                currentData[id] = data[i];
              }
            }
            // TODO Remove _id value
            savedKeys.push(id);
          }
        }
      } else if (saveArgs.data instanceof Object) {
        if (saveArgs.keys) {
          // Object of key/value pairs to update
          savedKeys = Object.keys(saveArgs.data).map(function(key) {
            if (saveArgs.replace === false && typeof currentData[key] !== 'undefined') {
              error = new Error('Value for `' + key + '` already exists');
              error.id = key;
              error.data = saveArgs.data[key];
              return error;
            }
            if (saveArgs.replace === true || typeof saveArgs.data[key] !== 'object'
                || typeof currentData !== 'object') {
              currentData[key] = saveArgs.data[key];
            } else if (currentData[key] instanceof Array
                && saveArgs.data[key] instanceof Array) {
                  currentData[key] = currentData[key].concat(saveArgs.data[key]);
            } else if (currentData[key] instanceof Array
                || saveArgs.data[key] instanceof Array) {
                  currentData[key] = saveArgs.data[key];
            } else {
              currentData[key] = merge(currentData[key], saveArgs.data[key]);
            }
            return key;
          });
        } else if (saveArgs.filter) {
          // Update all current object values that match filter with given data
          Object.keys(currentData).forEach(function(key) {
            if (!(currentData[key] instanceof Array)
                && typeof currentData[key] === 'object') {
              if (common.runFilter(currentData[key], saveArgs.filter)) {
                savedKeys.push(key);
                // run update
                currentData[key] = merge(currentData[key], saveArgs.data);
              }
            }
          });
        } else {
          // Update all current object values with given data
          Object.keys(currentData).forEach(function(key) {
            if (!(currentData[key] instanceof Array)
                && typeof currentData[key] === 'object') {
              savedKeys.push(key);
              // run update
              currentData[key] = merge(currentData[key], saveArgs.data);
            }
          });
        }
      } else {
        return Promise.reject(new Error('Unknown data given to save'));
      }

      if (options.cacheValues) {
        cachedData = currentData;
      }

      return saveData(currentData).then(function() {
        return Promise.resolve(savedKeys);
      });
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
        if (options.cacheValues) {
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

        return keysPromise.then(function(existingKeys) {
          console.log('delete got existing keys', existingKeys);
          if (options.cacheValues) {
            cachedData = {};
          }
          if (options.cacheKeys) {
            cachedKeys = [];
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
   * @returns {Promise} A Promise that resolves when the instance is closed
   */
  function close() {
    if (file !== false && options.listen) {
      fs.unwatch(file, listener);
    }

    return Promise.resolve();
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
      cachedData = readData(true);
      cachedKeys = readKeys(true);
    }
  }


  // Load existing data
  options = options || {};

  var initialisePromises = [];
  var valuePromise;

  if (options.cacheValues) {
    valuePromise = readData(true).then(function(data) {
      cachedData = data;
    });
    initialisePromises.push(valuePromise);
  }
  if (options.cacheKeys) {
    var keyPromise;
    if (options.cacheValues) {
      keyPromise = valuePromise.then(function() {
        return readKeys(true);
      });
    } else {
      keyPromise = readKeys(true);
    }
    initialisePromises.push(keyPromise.then(function(keys) {
      cachedKeys = keys;
    }));
  }

  // TODO Attach listener on to file
  if (file !== false && options.listen) {
    fs.watch(file, { persistent: true }, listener);
  }

  return Promise.all(initialisePromises).then(function() {
    return common.newCrud(save, doRead,
        readKeys, doDelete, close, options);
  });
};
