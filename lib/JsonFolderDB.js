'use strict';

var assert = require('assert');
var merge = require('merge');
var fs = require('fs');
var path = require('path');
var Promise = require('promise');


var writeFile = Promise.denodeify(fs.writeFile);
let readFile = Promise.denodeify(fs.readFile);
var unlink = Promise.denodeify(fs.unlink);
let access = Promise.denodeify(fs.access);

var allowedTypes = ['string', 'number'];

/** @private
 * Get the filename for a given id
 *
 * @param {String} id Id of parameter to get filename for
 */
function getFilename(id) {
  // @TODO Sanitise id string
  return path.join(this.file, id + '.json');
}

function getData(id) {
  //return new Promise(resolve, reject
  if (this.data[id]) {
    return Promise.resolve(this.data[id]);
  }

  let file = getFilename.call(this, id);

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
      return Promise.reject(err)
    }
  });
}

/** @private
 * Does the actual saving of the data to the file. Called by (@see save)
 *
 * @param {String} id String identifier of parameter that is to be saved
 *
 * @returns {Promise} A promise that will resolve when the save is complete
 */
function doSave(id) {
  var filename = getFilename.call(this, id);
  if (this.data[id] === undefined) {
    // Delete file if exists
    return unlink(filename);
  } else {
    return writeFile(filename, JSON.stringify(this.data[id], null, 2)); 
  }
}

/** @private
 * Saves the data back to the file
 *
 * @param {String|String[]} id String identifier or array of string
 *        indentifiers of parameter that brought about save
 *
 * @returns {Promise} A promise that will resolve when the save is complete
 */
function save(id) {
  return new Promise(function(resolve, reject) {
    if (id instanceof Array) {
      let i, saves = [];
      for (i in id) {
        saves.push(doSave.call(this, id[i]));
      }
      Promise.all(saves).then(function() {
        resolve(id);
      }, function(err) {
        reject(err, id);
      });
    } else {
      doSave.call(this, id).then(function() {
        resolve(id);
      }, function(err) {
        reject(err, id);
      });
    }
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
 * @param {'rename'|'changed'} event Event type
 * @param {String} filename Filename of file that triggered event
 */
function listener(event, filename) {
  if (event == 'rename') {
  } else {
    // Reload file
    this.data = require(this.file);
  }
}

function JsonFolderDB(file, options) {
  // Load existing data
  Object.defineProperties(this, {
    file: {
      value: file,
      writable: true
    },
    data: {
      value: {},
      writable: true
    },
    // @TODO this.files = {} Add for monitoring if we have tried to load files
    options: {
      value: options || {}
    }
  });

  // Attach listener on to file
  if (this.options.listen) {
    fs.watch(file, { persistent: true }, listener);
  }
}

JsonFolderDB.prototype = {
  create: function() {
    var args = Array.prototype.slice.call(arguments);
    return new Promise(function(resolve, reject) {
      var newData = {}, ids = [], replace;
      // Check if we have a replace flag
      if (args.length >= 2) {
        if (typeof args[0] === 'boolean') {
          replace = args.shift();
        }
      }

      if (!args.length) {
        return reject(new Error('No data given'));
      }

      // Check if the next argument is a string if we have more than one
      while (args.length >= 2 && typeof args[0] === 'string') {
          if (!replace && this.data[args[0]] !== undefined) {
            return reject(new Error('valur for ' + args[0]
                + ' already exists'));
          }
          ids.push(args[0]);
          newData[args.shift()] = args.shift();
          continue;
      }
      
      if (args.length && this.options && this.options.id) {
        while (args.length) {
          if (!(args[0] instanceof Object
              && args[0][this.options.id] !== undefined)) {
            return reject(new Error('Found value without an id field'));
          }
          if (!replace && this.data[args[0][this.options.id]] !== undefined) {
            return reject(new Error('Value for ' + args[0][this.options.id]
                + ' already exists'));
          }
          ids.push(args[0][this.options.id]);
          newData[args[0][this.options.id]] = args.shift();
        }
      }

      // Merge new data into old
      var i;
      for (i in newData) {
        this.data[i] = newData[i];
      }

      if (!(this.options && this.options.noSync)) {
        // TODO do we need to call resolve here?
        save.call(this, ids).then(function() {
          resolve(ids);
        }, function(err) {
          reject(err);
        });
      } else {
        resolve(ids);
      }
    }.bind(this));
  },

  read: function(filter, expectOne) {
    if (allowedTypes.indexOf(typeof filter) !== -1) {
      return getData.call(this, filter);
    }
    /*return new Promise(function(resolve, reject) {
      // Check for id
      } else if (typeof filter !== 'object') {
        return reject({
          message: 'filter needs to be an object containing a filter'
        });
      }

      idsFromFilter.call(this, filter).then(function(ids) {
        if (ids.length === 0) {
          if (expectOne) {
            resolve();
          }
          resolve({});
        }

        var i, items;
        for (i in ids) {
          items[ids[i]] = this.data[ids[i]];
        }

        resolve(items);
      });
    }.bind(this));*/
  },

  update: function() {
    return new Promise(function(resolve, reject) {
      var data, id, replace;
      if (this.options.id) {
        data = arguments[0];

        // Check id is there and TODO is indexable
        if (data[this.options.id]) {
          id = data[this.options.id];
        }

        if (arguments.length >= 2) {
          if (typeof arguments[1] !== 'boolean') {
            reject({
              message: 'Value for replace not a Boolean'
            });
          }

          replace = arguments[1];
        }
      } else {
        // TODO Check if id is indexable
        id = arguments[0];

        data = arguments[1];
      }

      if (data === 'undefined') {
        reject({
          message: 'No data given'
        });
      }

      // Update data
      this.data[id] = merge(this.data[id], data);

      if (this.options.sync) {
        // TODO do we need to call resolve here?
        save.call(this, id);
      }
      
      resolve(id);
    }.bind(this));
  },

  delete: function(filter) {
    return new Promise(function(resolve, reject) {
      if (allowedTypes.indexOf(typeof filter) !== -1) {
        getData.call(this, filter).then(function(data) {
          if (data !== undefined) {
            delete this.data[filter];
            save.call(this, filter).then(function() {
              resolve(true);
            });
          } else {
            resolve(false);
          }
        }.bind(this), function(err) {
          reject(err);
        });
      } else if (filter instanceof Array) {
        var i, data = {};
        for (i in filter) {
          if (allowedTypes.indexOf(typeof filter[f]) !== -1) {
            if (this.data[filter[f]] !== undefined) {
              data[filter[f]] = this.data[filter[f]];
            }
          }
        }
        resolve(data);
      } else if (typeof filter !== 'object') {
        reject({
          message: 'filter needs to be an object containing a filter'
        });
      } else {
        idsFromFilter.call(this, filter).then(function(ids) {
          if (ids.length === 0) {
            if (expectOne) {
              resolve();
            }
            resolve({});
          }

          var i, items;
          for (i in ids) {
            items[ids[i]] = this.data[ids[i]];
          }

          resolve(items);
        });
      }
    }.bind(this));
  }
};

module.exports = JsonFolderDB;

