"use strict";

var merge = require('merge');
var fs = require('fs');
var Promise = require('promise');
var common = require('./common');

var readFile = Promise.denodeify(fs.readFile);
var writeFile = Promise.denodeify(fs.writeFile);

/**@private
 * Reads the data from the file
 *
 * @this JsonFileDB
 *
 * @returns {Promise} A promise that resolves to the data
 */
function readData() {
  return readFile(this.file).then(function(data) {
    try {
      //TODO Handle empty file/non-object file?
      return JSON.parse(data);
    } catch(err) {
      return Promise.reject(err);
    }
  });
}

/**
 * Checks the filter for validity and chooses the best order to do matches
 * based on indexes and difficulty of test
 *
 * @param {Object} filter Filter to validate and find best execution path
 *
 * @returns {Array} Containing best steps to do
 *
 */
function checkExecutionPath(filter) {
    var executionPlan = [];
    var filterStack = [];

    
}

/**@private
 * Reads the keys from the file
 *
 * @returns {Promise} A promise that resolves to an array of the keys
 */
function readKeys() {
  return readData.call(this).then(function(data) {
    void 0;
    try {
      return Promise.resolve(Object.keys(data));
    } catch(err) {
      return Promise.reject(err);
    }
  });
}

/**@private
 * Saves the data to the file
 * @this JsonFileDB
 *
 * @param {*} data Data to save to file
 *
 * @returns {Promise} A promise that resolves to the data
 */
function saveData(data) {
  void 0;
  if (this.options.cacheKeys) {
    this.keys = Object.keys(data);
  }
  return writeFile(this.file, JSON.stringify(data, null, 2));
}

/**
 * Saves the data back to the file
 *
 * @this JsonFileDB
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
  var cData, args = data.args, i;

  if (this.options.cacheData) {
    cData = Promise.resolve(this.data);
  } else {
    cData = readData.call(this);
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
            || currentData[args[i][this.options.id]] === undefined) {
          currentData[args[i][this.options.id]] = args[i];
        } else {
          currentData[args[i][this.options.id]]
              = merge(currentData[args[i]], args[i]);
        }
      }
    }

    if (this.options.cacheData) {
      this.data = currentData;
    }

    return saveData.call(this, currentData);
  }.bind(this));
}

/**
 * Implements checking for if a value for a key exists
 *
 * @this JsonFileDB
 *
 * @param {Key} key Key to see if there is a value for
 *
 * @returns {Promise} A promise that will resolve to a Boolean value of
 *   whether or not a value for the given key exists
 */
function has(key) {
  if (this.cacheValues) {
    return Promise.resolve((this.data[key] !== undefined));
  } else if (this.options.cacheKeys) {
    return Promise.resolve((this.keys.indexOf(key) !== -1));
  } else {
    return readData.call(this).then(function(data) {
      return (data[key] !== undefined);
    });
  }
}

/**
 * Implements retrieving a value for the given key
 *
 * @this JsonFileDB
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
    var keys, dataPromise;
    if (common.keyTypes.indexOf(typeof filter) !== -1) {
      keys = [filter];
    } else if (filter instanceof Array) {
      // Check keys are all valid
      var f, length = filter.length;
      for(f = 0; f < length; f++) {
        if (common.keyTypes.indexOf(typeof filter[f]) === -1) {
          reject(new Error('Invalid key given: ' + filter[f]));
          return;
        }
      }
      keys = filter;
    } else if (typeof filter === 'undefined') {
      // Return all values
      if (this.cacheData) {
        resolve(this.data);
      } else {
        readData.call(this).then(function(data) {
          resolve(data);
        });
      }
      return;
    } else if (typeof filter !== 'object') {
      reject(new Error('filter needs to be a key, an array of keys or a '
          + 'filter Object'));
      return;
    } else {
      // Determine execution path for filter
      if (this.cacheValues) {
        dataPromise = Promise.resolve(this.data);
      } else {
        dataPromise = readData.call(this);
      }

      dataPromise.then(function(data) {
        var fetchedData = {};
        common.processFilter(data, filter, function(id, itemData) {
          fetchedData[id] = itemData;
        }).then(function() {
          resolve(fetchedData);
        }, function(err) {
          reject(err);
        });
      });

      return;
    }
  
    void 0;

    // Get values for keys
    var promise;
    if (this.cacheValues) {
      promise = getValues(keys, this.data, expectSingle);
    } else {
      promise = readData.call(this).then(function(data) {
        return getValues(keys, data, expectSingle);
      });
    }

    promise.then(function(data) {
      resolve(data);
    }, function(err) {
      reject(err);
    });
  }.bind(this));
}

/**@private
 * Extracts the values for the given keys from the data Object
 *
 * @param {Key[]} keys Keys to get values for
 * @param {Object} data Object to extract values from
 * @param {Boolean} [expectSingle] If true, the single value will be returned
 *   as only the value (as opposed to the normal key/value Object. If a single
 *   value is not going to be returned, the Promise will reject with an error.
 *
 * @returns {Promise} A promise that resolves to the data. If only one key is
 *   given, only the value will be returned. Otherwise it will be a Object
 *   containing the key/value pairs.
 */
function getValues(keys, data, expectSingle) {
  void 0;
  if (expectSingle) {
    if (keys.length === 1) {
      return Promise.resolve(data[keys[0]]);
    } else {
      return Promise.reject(new Error('More than one value going to be '
          + 'returned: ' + keys));
    }
  } else {
    var result = {};

    keys.forEach(function(arg) {
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
  void 0;
  return new Promise(function(resolve, reject) {
    var i, keysPromise, dataPromise;

    if (filter === true) {
      // Delete all
      if (this.options.cacheKeys) {
        keysPromise = Promise.resolve(this.keys);
      } else {
        keysPromise = readKeys.call(this);
      }

      keysPromise.then(function(keys) {
        if (this.options.cacheValues) {
          this.data = {};
        }

        saveData({}).then(function() {
          resolve(keys);
        }.bind(this));
      }.bind(this));
    } else if (common.keyTypes.indexOf(typeof filter) !== -1) {
      filter = [filter];
    } else if (filter instanceof Array) {
    } else if (typeof filter === 'object') {
      // Determine execution path for filter
      if (this.cacheValues) {
        dataPromise = Promise.resolve(this.data);
      } else {
        dataPromise = readData.call(this);
      }

      dataPromise.then(function(data) {
        var deletedKeys = [];
        common.processFilter(data, filter, function(id, itemData) {
          deletedKeys.push(id);
          delete data[id];
        }).then(function() {
          return saveData.call(this, data);
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
    if (!this.options.cacheValues && this.options.cacheKeys) {
      var haveKey = false;
      for (i in filter) {
        if(this.keys.indexOf(filter[i]) !== -1) {
          haveKey = true;
          break;
        }
      }
      if (haveKey) {
        dataPromise = readData.call(this);
      } else {
        resolve([]);
        return;
      }
    } else if (this.options.cacheValues) {
      dataPromise = Promise.resolve(this.data);
    } else {
      dataPromise = readData.call(this);
    }

    dataPromise.then(function(newData) {
      var deletedIds = [];
      // Go through and delete
      filter.forEach(function(id) {
        if (newData[id] !== undefined) {
          delete newData[id];
          deletedIds.push(id);
        }
      });

      return saveData.call(this, newData).then(function() {
        resolve(deletedIds);
        return Promise.resolve();
      });
    }.bind(this));
  }.bind(this));

}

/** @private
 * Called when the data file changes or is renamed
 *
 * @param {string} event Event type - rename or changed
 * @param {String} filename Filename of file that triggered event
 *
 * @returns {undefined}
 */
function listener(event, filename) {
  if (event == 'rename') {
  } else {
    // Reload file
    this.data = require(this.file);
  }
}

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
  // Load existing data
  void 0;
  options = options || {};
  var priv = {
    options: options,
    file: file
  };

  if (options.cacheValues) {
    priv.data = readData.call(priv);
  } else if (options.cacheKeys) {
    priv.keys = readKeys.call(priv);
  }

  // TODO Attach listener on to file
  if (options.listen) {
    fs.watch(file, { persistent: true }, listener);
  }

  return common.newCrud(save.bind(priv), doRead.bind(priv),
      readKeys.bind(priv), doDelete.bind(priv), options);
};
