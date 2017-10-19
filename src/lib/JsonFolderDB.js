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
  console.log('folder  constructor');
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
   * @returns {Promise} A Promise that resolves when the instance is closed
   */
  function close() {
    if (options.listen) {
      fs.unwatch(file, listener);
    }

    return Promise.resolve();
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
   * @param {boolean} [force] Whether or not to force a reread of the data
   *   from the file
   *
   * @returns {Promise} A promise that will resolve to the data
   */
  function readData(id, force) {
    if (typeof id === 'undefined') {
      if (!force && options.cacheValues) {
        return Promise.resolve(cachedData);
      }

      return readKeys(force).then(function(keys) {
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
      // Return the cached value if we are caching values
      if (!force && options.cacheValues) {
        return Promise.resolve(cachedData[id]);
      }

      // Check if we have a key for the data if we have cached the keys
      if (!force && options.cacheKeys && cachedKeys.indexOf(id) === -1) {
        return Promise.resolve(undefined);
      }

      var filename = getFilename(id);

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
   * @param {boolean} [force] Whether or not to force a reread of the data
   *   from the file
   *
   * @returns {Promise} A promise that resolves to an array of the keys
   */
  function readKeys(force) {
    if (!force && options.cacheKeys) {
      return Promise.resolve(cachedKeys);
    }
    if (!force && options.cacheValues) {
      return Promise.resolve(Object.keys(cachedData));
    }

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
    console.log('saveData', arguments);
    var filename = getFilename(id);
    if (typeof data === 'undefined') {
      // Check if the file exists
      if (options.cacheValues) {
       if (typeof cachedData[id] !== 'undefined') {
         return unlink(filename);
       }
      } else if (options.cacheKeys) {
         if (cachedKeys.indexOf(id) !== -1) {
           return unlink(filename);
         }
      } else {
        // Check if file exists
        return access(filename, fs.R_OK | fs.W_OK).then(function() {
          return unlink(filename);
        }, function(err) {
          if (err.code === 'ENOENT') {
            return Promise.resolve(undefined);
          } else {
            return Promise.reject(err);
          }
        });
      }
    } else {
      return writeFile(filename, JSON.stringify(data, null, 2));
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
    console.log('save', saveArgs, arguments);
    var data = saveArgs.data;

    // TODO Could possibly cause a race condition if multiple saves happen
    // at the same time
    var keysPromise;
    if (saveArgs.replace === true) {
      keysPromise = Promise.resolve(false);
    } else {
      keysPromise = readKeys();
    }

    return keysPromise.then(function(keys) {
      var i, saves = [], savedKeys = [];

      console.log('save data is', data);

      const doSave = function(key, value) {
        return saveData(key, value).then(function() {
          savedKeys.push(key);
          if (typeof value === 'undefined') {
            if (options.cacheValues) {
              delete cachedData[key];
            }
            // TODO not going to handle value of undefined
            if (options.cacheKeys && cachedKeys.indexOf(key) !== -1) {
              cachedKeys.splice(cachedKeys.indexOf(key), 1);
            }
          } else {
            if (options.cacheValues) {
              if (value instanceof Object) {
                cachedData[key] = merge(true, value);
              } else {
                cachedData[key] = value;
              }
            }
            if (options.cacheKeys && cachedKeys.indexOf(key) === -1) {
              cachedKeys.push(key);
            }
          }
        }, function(error) {
          error.id = key;
          error.value = value;
        });
      };

      if (data instanceof Array) {
        if (saveArgs.keys) {
          for (i = 0; i + 1 < data.length; i = i + 2) {
            let id, newData;
            if (saveArgs.replace === true) {
              saves.push(doSave(data[i], data[i+1]));
            } else {
              id = data[i];
              newData = data[i+1];
              saves.push(readData(id).then(function(currentData) {
                if (typeof currentData === 'undefined') {
                  return doSave(id, newData);
                } else {
                  if (saveArgs.replace === false) {
                    console.log('rejecting');
                    var error = new Error('Value for `' + id + '` already exists');
                    error.id = id;
                    error.data = newData;
                    savedKeys.push(error);
                    return Promise.resolve();
                  }
                  // Merge if both are mergable, otherwise replace
                  if (['object', 'array'].indexOf(typeof newData) !== -1
                      && typeof currentData === typeof newData) {
                    return doSave(id, merge(currentData, newData));
                  } else {
                    return doSave(id, newData);
                  }
                }
              }));
            }
          }
        } else {
          for(i = 0; i < data.length; i++) {
            let id, newData;
            if (saveArgs.replace === true) {
              saves.push(doSave(data[i][options.id], data[i]));
            } else {
              id = data[i][options.id];
              newData = data[i];
              saves.push(readData(id).then(function(currentData) {
                if (typeof currentData === 'undefined') {
                  return doSave(id, newData);
                } else {
                  if (saveArgs.replace === false) {
                    console.log('rejecting');
                    var error = new Error('Value for `' + id + '` already exists');
                    error.id = id;
                    error.data = newData;
                    savedKeys.push(error);
                    return Promise.resolve();
                  }
                  return doSave(id, merge(currentData, newData));
                }
              }));
            }
          }
        }
      } else if (data instanceof Object) {
        if (saveArgs.keys) {
          // Object of key/value pairs to update
          Object.keys(data).forEach(function(key) {
            if (saveArgs.replace === true) {
              saves.push(doSave(key, data[key]));
            } else {
              saves.push(readData(key).then(function(currentData) {
                console.log('got current data', key, currentData);
                if (saveArgs.replace === false && typeof currentData !== 'undefined') {
                  console.log('rejecting');
                  var error = new Error('Value for `' + key + '` already exists');
                  error.id = key;
                  error.data = data[key];
                  savedKeys.push(error);
                  return Promise.resolve();
                }
                if (typeof data[key] !== 'object'
                    || typeof currentData !== 'object') {
                  return doSave(key, data[key]);
                } else if (currentData instanceof Array
                    && data[key] instanceof Array) {
                      return doSave(key, currentData.concat(saveArgs.data[key]));
                } else if (currentData instanceof Array
                    || data[key] instanceof Array) {
                      return doSave(key, data[key]);
                } else {
                  return doSave(key, merge(currentData, data[key]));
                }
              }));
            }
          });
        } else if (saveArgs.filter) {
          // Update all current object values that match filter with given data
          keys.forEach(function(key) {
            saves.push(readData(key).then(function(currentData) {
              if (!(currentData instanceof Array)
                  && typeof currentData === 'object') {
                if (common.runFilter(currentData, saveArgs.filter)) {
                  savedKeys.push(key);
                  // run update
                  return saveData(key, merge(currentData, data));
                }
              }
            }));
          });
        } else {
          // Update all current object values with given data
          keys.forEach(function(key) {
            saves.push(readData(key).then(function(currentData) {
              if (!(currentData instanceof Array)
                  && typeof currentData === 'object') {
                savedKeys.push(key);
                // run update
                return saveData(key, merge(currentData, data));
              }
            }));
          });
        }
      } else {
        return Promise.reject(new Error('Unknown data given to save'));
      }

      return Promise.all(saves).then(function() {
        return Promise.resolve(savedKeys);
      });
    });
  }

  /**@private
   * Extracts the values for the given keys from the data Object
   *
   * @param {Key[]} [keys] Keys to get values for
   * @param {Boolean} [expectSingle] If true, the single value will be returned
   *   as only the value (as opposed to the normal key/value Object. If a single
   *   value is not going to be returned, the Promise will reject with an error.
   *
   * @returns {Promise} A promise that resolves to the data. If only one key is
   *   given, only the value will be returned. Otherwise it will be a Object
   *   containing the key/value pairs.
   */
  function getValues(keys, expectSingle) {
    console.log('getValues called', arguments);
    var keyPromise;
    var result = {};
    if (options.cacheValues) {
      if (expectSingle) {
        if (keys instanceof Array
            && (Object.keys(cachedData).length <=0 || keys.length === 1)) {
          return Promise.resolve(cachedData[keys[0]]);
        } else {
          return Promise.reject(new Error('More than one value going to be '
              + 'returned: ' + keys));
        }
      } else {
        if (typeof keys === 'undefined') {
          return Promise.resolve(cachedData);
        } else {
          keys.forEach(function(key) {
            result[key] = cachedData[key];
          });

          return Promise.resolve(result);
        }
      }
    } else {
      if (options.cacheKeys) {
        keyPromise = Promise.resolve(cachedKeys);
      } else {
        keyPromise = readKeys();
      }

      return keyPromise.then(function(storedKeys) {
        console.log('keyPromise got', storedKeys);
        var gets = [];

        if (expectSingle) {
          if (keys instanceof Array
              && (storedKeys.length <=0 || keys.length === 1)) {
            console.log('getting single value for', keys[0]);
            return readData(keys[0]);
          } else {
            return Promise.reject(new Error('More than one value going to be '
                + 'returned: ' + keys));
          }
        } else {
          if (typeof keys === 'undefined') {
            storedKeys.forEach(function(key) {
              gets.push(readData(key).then(function(data) {
                result[key] = data;
              }));
            });
          } else {
            keys.forEach(function(key) {
              if (storedKeys.indexOf(key) !== -1) {
                gets.push(readData(key).then(function(data) {
                  result[key] = data;
                }));
              }
            });
          }

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
    console.log('doRead called', filter);
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
        if (options.cacheValues) {
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
    console.log('folder delete called', filter);
    return new Promise(function(resolve, reject) {
      var keysPromise;
      var deletes = [], deletedKeys = [];

      if (common.keyTypes.indexOf(typeof filter) !== -1) {
        filter = [filter];
      } else if (filter instanceof Array) {
      } else if (filter === true || typeof filter === 'object') {
        console.log('object/true delete handler');
        // Get the existing keys
        return readKeys().then(function(existingKeys) {
          console.log('existing keys are', existingKeys);
          if (filter === true) {
            deletedKeys = existingKeys;
            existingKeys.forEach(function(key) {
              deletes.push(saveData(key));
            });
          } else {
            if (options.cacheValues) {
              console.log('processing filter', filter);
              common.processFilter(cachedData, filter, function(key) {
                console.log('deleting matching item', key);
                deletes.push(saveData(key).then(function() {
                  delete cachedData[key];
                  deletedKeys.push(key);
                }));
              });
            } else {
              console.log('processing filter on non-cached data');
              existingKeys.forEach(function(key) {
                deletes.push(readData(key).then(function(data) {
                  console.log('loaded data for', key);
                  if (common.runFilter(data, filter)) {
                    return saveData(key).then(function() {
                      if (options.cacheKeys) {
                        cachedKeys.splice(cachedKeys.indexOf(key), 1);
                      }
                      deletedKeys.push(key);
                    });
                  } else {
                    return Promise.resolve();
                  }
                }));
              });
            }
          }

          return Promise.all(deletes).then(function() {
            if (filter === true && options.cacheValues) {
              cachedData = {};
            }
            if (options.cacheValues && options.cacheKeys) {
              cachedKeys = Object.keys(cachedData);
            } else if (filter === true && options.cacheKeys) {
              cachedKeys = [];
            }
            resolve(deletedKeys);
          }, reject);
        });
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
        console.log('got current keys', keys);
        filter.forEach(function(id) {
          if (keys.indexOf(id) !== -1) {
            // TODO XXX Remove once file watch implemented
            deletes.push(saveData(id).then(function() {
              if (options.cacheValues) {
                delete cachedData[id];
              } else if (options.cacheKeys) {
                // Delete remove key from cached keys if caching keys but not values
                cachedKeys.splice(cachedKeys.indexOf(id), 1);
              }

              deletedKeys.push(id);
            }));
          }
        });

        Promise.all(deletes).then(function() {
          // Redo cached keys if caching keys and values (otherwise done above)
          if (options.cacheKeys && options.cacheValues) {
            cachedKeys = Object.keys(cachedData);
          }
          resolve(deletedKeys);
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

  var initialisePromises = [];
  var valuePromise;

  if (options.cacheValues) {
    valuePromise = readData(undefined, true).then(function(data) {
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

  return Promise.all(initialisePromises).then(function() {
    return common.newCrud(save, doRead,
        readKeys, doDelete, close, options);
  });
};
