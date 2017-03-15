"use strict";

var Promise = require('promise');

var keyTypes = exports.keyTypes = ['string', 'number'];




/**@private
 * Checks  the parameters for both the create and update functions.
 *
 * @param {Boolean} create If true, this function will check for the replace
 *   Boolean and ensure that data for a given key does not already exist if
 *   the replace Boolean is not given or not true
 * @param {Arguments} args Arugments to process
 *
 * @returns {Promise} A promise that will resolve to an Object containing
 */
function processSave(create, args) {
  args = Array.prototype.slice.call(args);
  return new Promise(function(resolve, reject) {
    var ids = [], replace, i;
    // Check if we have a replace flag
    if (create) {
      if (typeof args[0] === 'boolean') {
        replace = args.shift();
      } else {
        replace = false;
      }
    }

    if (!args.length) {
      return reject(new Error('No data given'));
    }

    if (args.length === 1 && args[0] instanceof Array) {
      args = args[0];
    }

    var promise;
    if (replace === false) {
      void 0;
      promise = this.getKeys();
    } else {
      promise = Promise.resolve();
    }

    promise.then(function(existingKeys) {
      void 0;
      // Check the arguments are all objects containing the id or are key
      // value pairs
      var keys = false;
      if (args[0] instanceof Object) {
        if (!this.options.id) {
          reject(new Error('id field must be given in options to be able '
              + 'to use create without an id'));
          return;
        }

        for (i = 0; i < args.length; i++) {
          if (!args[i] instanceof Object) {
            reject(new Error('Create value ' + (i + 1)
                + ' was not an object (' + typeof args[i][this.options.id]
                + ' given)'));
            return;
          } else if (keyTypes.indexOf(typeof args[i][this.options.id]) === -1) {
            reject(new Error('Invalid id value for value ' + (i + 1)
                + ' (' + typeof args[i][this.options.id] + ' given)'));
            return;
          } else if (replace === false
              && existingKeys.indexOf(args[i][this.options.id]) !== -1) {
            reject(new Error('Value for ' + args[i][this.options.id]
                + ' already exists'));
            return;
          }

          ids.push(args[i][this.options.id]);
        }
      } else if (args.length === 1) {
        reject(new Error('Non-object value must be given with a key value'));
        return;
      } else {
        keys = true;

        if (args.length % 2) {
          reject(new Error('Uneven number of key/value arguments given'
              + ' (' + args.length + ' given)'));
          return;
        }

        for (i = 0; i < args.length; i = i + 2) {
          if (keyTypes.indexOf(typeof args[i]) === -1) {
            reject(new Error('Invalid id value for key ' + (i + 1)
                + ' (' + typeof args[i] + ' given)'));
            return;
          } else if (replace === false
              && existingKeys.indexOf(args[i]) !== -1) {
            reject(new Error('Value for ' + args[i]
                + ' already exists'));
            return;
          }

          ids.push(args[i]);
        }
      }

      resolve({
        keys: keys,
        replace: replace,
        args: args
      });
    }.bind(this));
  }.bind(this));
}

/**
 * Inserts data into the JSON database. Data can either be given as
 * key-value parameter pairs, OR if the key field has been specified Object
 * values. This function will fail if data was a given key already exists
 * unless a Boolean is given for the first parameter, in which case, any
 * data for an existing key will be replaced.
 *
 * @param {Boolean} [replace=false] If true, if data already exists for a
 *   given key, that data will be replaced with the given data
 * @param {...*} data Either key-value pairs, if the key field has been
 *   specified, Object values containing the key value, or a single Array
 *   containing one of the previous two options
 *
 * @returns {Promise} A promise that will resolve with an array containing
 *   keys of the inserted data.
 */
function doCreate() {
  void 0;

  return processSave.call(this, true, arguments).then(this.save);
}

/**
 * Updates data in the JSON database. Data can either be given as
 * key-value parameter pairs, OR if the key field has been specified Object
 * values. New values will be merge into any existing values.
 *
 * @param {...*} data Either key-value pairs, if the key field has been
 *   specified, Object values containing the key value, or a single Array
 *   containing one of the previous two options
 *
 * @returns {Promise} A promise that will resolve with an array containing
 *   keys of the updated data.
 */
function doUpdate() {
  void 0;

  return processSave.call(this, false, arguments).then(this.save);
}

//TODO var logicalOperators = ['$and', '$or', '$not', '$nor'];

/**
 * Checks if the given data hits on the given filter
 *
 * @param {*} data Data to check against filter
 * @param {Object} filter Filter to check the data against
 *
 * @returns {Boolean} Whether the data matches the filter or not.
 */
function runFilter(data, filter) {
  var k, key, keys = Object.keys(filter), keysLength = keys.length;
  var i;

  if (!Object.keys(filter).length) {
    return true;
  }

  keyCheck: for (k = 0; k < keysLength; k++) {
    key = keys[k];

    // Match
    if (key.startsWith('$')) {
      //if (key.startsWith(
      switch (key) {
        case '$or':
          for (i = 0; i < filter[key].length; i++) {
            if (runFilter(data, filter[key][i])) {
              continue keyCheck;
            }
          }
          return false;
        case '$and':
          for (i = 0; i < filter[key].length; i++) {
            if (!runFilter(data, filter[key][i])) {
              return false;
            }
          }
          break;
        case '$not':
          if(runFilter(data, filter[key])) {
            return false;
          }
          break;
      }
    } else if (typeof data === 'object') {
      if (typeof filter[key] === 'object') {
        if (Object.keys(filter[key]).find(function(operator) {
          switch (operator) {
            case '$eq':
              if (data[key] instanceof Array) {
                return data[key].indexOf(filter[key]['$eq']) === -1;
              } else {
                return !data[key] || data[key] !== filter[key]['$eq'];
              }
            case '$ne':
              if (data[key] instanceof Array) {
                return data[key].indexOf(filter[key]['$ne']) !== -1;
              } else {
                return data[key] === filter[key]['$ne'];
              }
            case '$gt':
              return !data[key] || data[key] <= filter[key]['$gt'];
            case '$gte':
              return !data[key] || data[key] < filter[key]['$gte'];
            case '$lt':
              return !data[key] || data[key] >= filter[key]['$lt'];
            case '$lte':
              return !data[key] || data[key] > filter[key]['$lte'];
            case '$in':
              if (!filter[key]['$in'] instanceof Array) {
                throw new Error('$in test values should be an array');
              }

              return filter[key]['$in'].indexOf(data[key]) === -1;
            case '$nin':
              if (!filter[key]['$nin'] instanceof Array) {
                throw new Error('$in test values should be an array');
              }

              return filter[key]['$nin'].indexOf(data[key]) !== -1;
            default:
              throw new Error('Unknown operator ' + operator);
          }
        })) {
          return false;
        }
      } else if (!((data[key] instanceof Array
          && data[key].indexOf(filter[key]) !== -1)
          || data[key] === filter[key])) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
  // TODO Handle logical operators
}
exports.runFilter = runFilter;

/**
 * Processes the data against the given filter and runs the given callback
 * against each item that matches
 *
 * @param {Object} data Data to process against filter
 * @param {Object} filter Filter to filter data with
 * @param {Function} callback Function to run against matching data
 *
 * @returns {Promise} A promise that will resolve when the filtering and
 *   callbacks are complete.
 */
exports.processFilter = function processFilter(data, filter, callback) {
  var keys = Object.keys(data), callbacks = [];
  void 0;

  keys.forEach(function(id) {
    void 0;
    if (runFilter(data[id], filter)) {
      callbacks.push(callback(id, data[id]));
    }
  }.bind(this));

  return Promise.all(callbacks);
};

/**
 * Generates a new CRUD instance.
 *
 * @param {saveFunction} save Function used to save the given data
 * @param {doReadFunction} doRead Function used to get data
 * @param {getKeysFunction} getKeys Function to be used to retrieve a list of
 *   keys currently in the database
 * @param {getFunction} doDelete Function used to delete data
 * @param {Function} close Function to close and clean up the CRUD instance
 * @param {Object} [options] Options to be used in the CRUD operations
 *
 * @returns {Object} The new CRUD instance
 */
exports.newCrud = function newCrud(save, doRead, getKeys, doDelete, close,
    options) {
  var priv = {
    options: options,
    save: save,
    getKeys: getKeys
  };

  return {
    create: doCreate.bind(priv),
    read: doRead,
    update: doUpdate.bind(priv),
    delete: doDelete,
    close: close
  };
};

/**
 * @callback saveFunction
 *
 * @param {Object} data
 * @param {Boolean} [data.replace] Whether data should be replaced. If true,
 *   data should be replaced, if false an error should thrown / the promise
 *   rejected. If undefined, data should be merged/replaced
 * @param {Boolean} data.keys Whether or not data is in key/value pairs
 * @param {Array) data.data Data to be saved
 *
 * @returns {Promise} A promise that will resolve to an array of the keys of
 *   the data saved
 */

/**
 * @callback hasFunction
 *
 * @param {Key} key Key to see if there is a value for
 *
 * @returns {Promise} A promise that will resolve to a Boolean value of
 *   whether or not a value for the given key exists
 */

/**@callback getFunction
 * Implements retrieving a value for the given key(s)/filter
 *
 * @param {Key|Key[]|Object} filter Filter to use to find values to retrieve
 * @param {Boolean} [expectSingle] If true, the single value will be returned
 *   as only the value (as opposed to the normal key/value Object. If a single
 *   value is not going to be returned, the Promise will reject with an error.
 *
 * @returns {Promise} A promise that will resolve to the value(s) for the given
 *   key(s)/filter(s).
 */
