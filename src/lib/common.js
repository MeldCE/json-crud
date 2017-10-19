"use strict";

var Promise = require('promise');

var keyTypes = exports.keyTypes = ['string', 'number'];

/**
 * Inserts data into the JSON database.
 *
 * @param {Array|Object} data Either an object of key-value pairs, an array
 *   containing key/value pairs ([key, value,...]) or, if the key field has
 *   been specified, an array of object values each with the key field set
 *
 * @returns {Promise} A promise that will resolve with an array containing
 *   keys or errors in creating the data of the inserted data.
 */
function doCreate(data) {
  console.log('create called', data);

  var i, keys = false;

  if (data instanceof Array) {
    if (typeof data[0] === 'undefined') {
      return Promise.reject(new Error('Can\'t have undefined keys'));
    }
    // Check if a key is the first element
    if (keyTypes.indexOf(typeof data[0]) !== -1) {
      // Check for an even amount of elements
      if (data.length % 2) {
        return Promise.reject(new Error('uneven number of key/values given to create'));
      }

      // Check every second item are keys
      for (i = 2; i < data.length; i = i + 2) {
        if (keyTypes.indexOf(typeof data[i]) === -1) {
          return Promise.reject(new Error('Invalid key value for key ' + (i + 1)
              + ' (' + typeof data[i] + ' given)'));
        }
      }

      keys = true;
    } else {
      if (!this.options.id) {
        return Promise.reject('Can\'t give an array of data objects if not key has been specified');
      }

      // Check if each object value has or doesn't have an id
      for (i = 0; i < data.length; i++) {
        if (typeof data[i][this.options.id] === 'undefined') {
          return Promise.reject(new Error('Can\'t have objects in array without a key'));
        }
      }
    }

    return this.save.call(this, {
      keys: keys,
      data: data,
      replace: false
    });
  } else if (data instanceof Object) {
    // Find and update
    return this.save.call(this, {
      keys: true,
      data: data,
      replace: false
    });
  } else {
    return Promise.reject(new Error('Unknown data type given'));
  }
}

/**
 * Updates data in the JSON database. Data can either be given as
 * key-value parameter pairs, OR if the key field has been specified Object
 * values. New values will be merge into any existing values.
 *
 * @param {Object|Object[]|Array} data Either:
 *   - an array of key-value pairs,
 *   - an object containing the data to update
 *   - object value(s) containing the key value (if a key has been specified)
 * @param {Object|true} [filter] If a object containing the data to update, a
 *   filter to select the items that should be updated, or if object value(s)
 *   have been given, true if the existing items should be replaced instead of
 *   merged into
 *
 * @returns {Promise} A promise that will resolve with an array containing
 *   keys of the updated data.
 */
function doUpdate(data, filter) {
  console.log('update called', data, filter);

  var i, keys = false;

  if (data instanceof Array) {
    if (typeof data[0] === 'undefined') {
      return Promise.reject(new Error('Can\'t have undefined keys'));
    }
    // Check if a key is the first element
    if (keyTypes.indexOf(typeof data[0]) !== -1) {
      // Check for an even amount of elements
      if (data.length % 2) {
        return Promise.reject(new Error('uneven number of key/values given to update'));
      }

      // Check every second item are keys
      for (i = 2; i < data.length; i = i + 2) {
        if (keyTypes.indexOf(typeof data[i]) === -1) {
          return Promise.reject(new Error('Invalid key value for key ' + ((i/2) + 1)
              + ' (' + typeof data[i] + ' given)'));
        }
      }

      keys = true;
    } else {
      if (!this.options.id) {
        return Promise.reject(new Error('Can\'t give an array of data objects if not key has been specified'));
      }

      // Check if each object value has or doesn't have an id
      for (i = 0; i < data.length; i++) {
        if (typeof data[i][this.options.id] === 'undefined') {
          return Promise.reject(new Error('Can\'t have objects in array without a key'));
        }
      }
    }

    // Check if given a filter object
    if (typeof filter === 'object') {
      return Promise.reject(new Error('can\'t use a filter with an array keyed objects'));
    }

    return this.save.call(this, {
      keys: keys,
      replace: filter === true ? true : undefined,
      data: data
    });
  } else if(data instanceof Object) {
    if (this.options.id && typeof data[this.options.id] !== 'undefined') {
      return Promise.reject(new Error('Can\'t include key value when updating with object'));
    }

    if (typeof filter === 'boolean') {
      // Object of key value pairs to put into database
      return this.save.call(this, {
        keys: true,
        replace: filter ? true : undefined,
        data: data
      });
    } else if (typeof filter === 'object') {
      // Object of fields to update in object values selected with a filter
      return this.save.call(this, {
        data: data,
        filter: filter
      });
    } else {
      // Object of fields to update in all object values
      return this.save.call(this, {
        data: data
      });
    }
  } else {
    return Promise.reject(new Error('Unknown data type given'));
  }
}

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
  console.log('processFilter called', data, filter, keys);

  keys.forEach(function(id) {
    console.log('checking filter against', id);
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
