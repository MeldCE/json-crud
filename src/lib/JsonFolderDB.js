'use strict';

var assert = require('assert');
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

var allowedTypes = ['string', 'number'];

/** @private
 * Get the filename for a given id
 *
 * @param {String} id Id of parameter to get filename for
 *
 * @returns {String} The filename for the given id
 */
function getFilename(id) {
  // @TODO Sanitise id string
  return path.join(this.file, id + '.json');
}

/** @private
 * Retreives the value for a given id from the associated file
 *
 * @param {String} id Id of parameter to get filename for
 *
 * @returns {Promise} A promise that will resolve to the data
 */
function readData(id) {
  var file = getFilename.call(this, id);

  //TODO Retrieve all data
  if (typeof id === 'undefined') {
    var keysPromise;
    if (this.cacheKeys) {
      keysPromise = Promise.resolve(this.keys);
    } else {
      keysPromise = readKeys.call(this);
    }
    return keysPromise.then(function(keys) {
      return Promise.reject(new Error('TODO Read all data'));
    });
  } else {
    // Check if file exists
    return access(file, fs.R_OK | fs.W_OK).then(function() {
      return readFile(file).then(function(buffer) {
        try {
          return JSON.parse(buffer.toString());
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
  return readdir(this.file).then(function(files) {
    var keys = [];

    files.forEach(function(file) {
      if (file.endsWith('.json')) {
        keys.push(file.replace(/\.json$/, ''));
      }
    });

    return Promise.resolve(keys);
  });
}
 

/** @private
 * Does the actual saving of the data to the file. Called by (@see save)
 *
 * @this JsonFolderDB
 *
 * @param {String} id String identifier of parameter that is to be saved
 * @param {*} data Data to be saved. If undefined, current value will be
 *   deleted.
 *
 * @returns {Promise} A promise that will resolve when the save is complete
 */
function saveData(id, data) {
  console.log('saveData', arguments);
  var filename = getFilename.call(this, id);
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
 * @this JsonFolderDB
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
  console.log('save', data, arguments);
  var cData, args = data.args;

  if (this.options.cacheData) {
    let saves = [], i;
    let keys = [];

    if (data.keys) {
      for (i = 0; i < args.length; i = i + 2) {
        if (data.replace === true || this.data[args[i]] === undefined) {
          saves.push(saveData.call(this, args[i], args[i+1]));
          keys.push(args[i]);
        } else {
          saves.push(saveData.call(this, args[i],
              merge(this.data[args[i]], args[i+1])));
          keys.push(args[i]);
        }
      }
    } else {
      for(i = 0; i < args.length; i++) {
        if (data.replace === true
            || this.data[args[i][this.options.id]] === undefined) {
          saves.push(saveData.call(this, args[i][this.options.id], args[i+1]));
        } else {
          saves.push(saveData.call(this, args[i][this.options.id],
              merge(this.data[args[i]], args[i+1])));
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
    } else if (this.cacheKeys) {
      keysPromise = Promise.resolve(this.keys);
    } else {
      keysPromise = readKeys.call(this);
    }

    return keysPromise.then(function(keys) {
      var i, saves = [];

      console.log('save args is', args);

      if (data.keys) {
        for (i = 0; i + 1 < args.length; i = i + 2) {
          let id, newData;
          if (data.replace === true) {
            saves.push(saveData.call(this, args[i], args[i+1]));
            keys.push(args[i]);
          } else {
            id = args[i];
            newData = args[i+1];
            saves.push(readData.call(this, id).then(function(currentData) {
              if (data === undefined) {
                keys.push(id);
                return saveData.call(this, id, newData);
              } else {
                keys.push(id);
                // Merge if both are mergable, otherwise replace
                if (['object', 'array'].indexOf(typeof newData) !== -1
                    && typeof currentData === typeof newData) {
                  return saveData.call(this, id, merge(currentData, newData));
                } else {
                  return saveData.call(this, id, newData);
                }
              }
            }.bind(this)));
          }
        }
      } else {
        for(i = 0; i < args.length; i++) {
          let id, newData;
          if (data.replace === true) {
            saves.push(saveData.call(this, args[i], args[i+1]));
            keys.push(args[i]);
          } else {
            id = args[i][this.options.id];
            newData = args[i];
            saves.push(readData.call(this, id).then(function(currentData) {
              if (data === undefined) {
                keys.push(id);
                return saveData.call(this, id, newData);
              } else {
                keys.push(id);
                return saveData.call(this, id, merge(currentData, newData));
              }
            }));
          }
        }
      }

      return Promise.all(saves).then(function() {
        return Promise.resolve(keys);
      });
    }.bind(this));
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
  console.log('getValues called', arguments);
  var keyPromise;
  var result = {};
  if (this.cacheValues) {
    let data = this.data;
    if (expectSingle) {
      if (keys.length === 1) {
        return Promise.resolve(this.data[keys[0]]);
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
    if (this.cacheKeys) {
      keyPromise = Promise.resolve(this.keys);
    } else {
      keyPromise = readKeys.call(this);
    }

    return keyPromise.then(function(storedKeys) {
      var gets = [];

      if (expectSingle) {
        if (keys.length === 1) {
          console.log('getting single value for', keys[0]);
          return readData.call(this, keys[0]);
        } else {
          return Promise.reject(new Error('More than one value going to be '
              + 'returned: ' + keys));
        }
      } else {
        keys.forEach(function(key) {
          if (storedKeys.indexOf(key) !== -1) {
            gets.push(readData.call(this, key).then(function(data) {
              result[key] = data;
            }));
          }
        }.bind(this));

        return Promise.all(gets).then(function() {
          return Promise.resolve(result);
        });
      }
    }.bind(this));
  }
}

/**
 * Implements retrieving a value for the given key
 *
 * @this JsonFolderDB
 *
 * @param {Key|Key[]|Object} filter Filter to use to find values to retrieve
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
    } else if (typeof filter === 'undefined') {
    } else if (typeof filter !== 'object') {
      reject(new Error('filter needs to be a key, an array of keys or a '
          + 'filter Object'));
      return;
    } else {
      if (this.cacheValues) {
        common.processFilter(this.data, filter, function(id, itemData) {
          fetchedData[id] = itemData;
        }).then(function() {
          resolve(fetchedData);
        }, function(err) {
          reject(err);
        });
      } else {
        var keysPromise;
        if(this.cacheKeys) {
          keysPromise = Promise.resolve(this.keys);
        } else {
          keysPromise = readKeys.call(this);
        }

        keysPromise.then(function(keys) {
          var fetchPromises = [];
          keys.forEach(function(key) {
            fetchPromises.push(readData.call(this, key).then(function(data) {
              if (common.runFilter(data, filter)) {
                fetchedData[key] = data;
              }
            }));
          }.bind(this));
          
          Promise.all(fetchPromises).then(function() {
            resolve(fetchedData);
          });
        }.bind(this));
      }
      return;
    }
  
    console.log('this is', this, filter);

    // Get values for keys
    return getValues.call(this, filter, expectSingle).then(function(data) {
      resolve(data);
    });
  }.bind(this));
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
    var i, data, keysPromise;

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
    if (this.cacheKeys) {
      keysPromise = Promise.resolve(this.keys);
    } else {
      keysPromise = readKeys.call(this);
    }

    keysPromise.then(function(keys) {
      var deletes = [], deleteKeys = [];

      filter.forEach(function(id) {
        if (keys.indexOf(id) !== -1) {
          // XXX Remove once file watch implemented
          if (this.cacheValues) {
            delete this.data[id];
          }

          deleteKeys.push(id);
          deletes.push(saveData.call(this, id));
        }
      }.bind(this));

      Promise.all(deletes).then(function() {
        resolve(deleteKeys);
      }.bind(this));
    }.bind(this));
  }.bind(this));
}


/** @private
 * Returns the ids of the items that much the given filter
 *
 * @param {Object} filter Object containing the filter
 *        (@see (@link filterSchema)).
 *
 * @returns {Promise} A promise that will resolve to an array of ids that much
 *          the given filter
 */
function idsFromFilter(filter) {
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
    // Reload file
    this.data = require(this.file);
  }
}

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
  var priv = {
    options: options,
    file: file
  };

  //this.file = file;
  //this.data = require(file);
  //this.options = options || {};

  // TODO Attach listener on to file
  if (options.listen) {
    fs.watch(file, { persistent: true }, listener);
  }

  return common.newCrud(save.bind(priv), doRead.bind(priv),
      readKeys.bind(priv), doDelete.bind(priv), options);
};
