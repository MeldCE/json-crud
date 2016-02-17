var assert = require('assert');
var merge = require('merge');
var fs = require('fs');

var allowedTypes = ['string', 'number'];

/**
 * Saves the data back to the file
 *
 * @returns {Promise} A promise that will resolve when the save is complete
 */
function save() {
  return Promise(function(resolve, reject) {
    fs.writeFile(this.file, this.data, function(err) {
      if (err) {
        reject({
          message: 'Error saving data to file',
          error: err
        });
      }

      resolve();
    });
  });
}

/** @private
 * Returns the ids of the items that much the given filter
 *
 * @TODO Is there a @context parameter?
 *
 * @param {Object} filter Object containing the filter
 *        (@see (@link filterSchema)).
 * @param {string} Logical Queru Operator and not or nor
 *
 * @returns {Promise} A promise that will resolve to an array of ids that much
 *          the given filter
 */
function idsFromFilter(filter, operator) {
  var i, f;
  /* @TODO
  // Check for logical query operators
  if (filter

  var ids = [];

  data: for (i in this.data) {
    for (f in filter) {
      if (this.data[f]) {
        if (this.data[f] instanceof Object 
      }
  */
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

function JsonFileDB(file, options) {
  // Load existing data
  this.file = file;
  this.data = require(file);
  this.options = options;

  // Attach listener on to file
  if (options.listen) {
    fs.watch(file, { persistent: true }, listener);
  }
}

JsonFileDB.prototype = {
  create: function() {
    return Promise(function(resolve, reject) {
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

      // Check if value already exists and reject if it does and not replace
      if (!replace && this.data[id] !== 'undefined') {
        reject({
          message: 'Item ' + id + ' already exists (and not replacing)'
        })
      }

      this.data[id] = data;

      if (this.options.sync) {
        // TODO do we need to call resolve here?
        save.call(this, id);
      }
      
      resolve(id);
    });
  },

  read: function(filter, expectOne) {
    return new Promise(function(resolve, reject) {
      if (allowedTypes.indexOf(typeof filter) !== -1) {
        resolve(this.data[filter]);
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
  },

  update: function() {
    return Promise(function(resolve, reject) {
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
    });
  },

  delete: function(filter) {
    assert(typeof folter === 'object');

    var ids = idsFromFilter.call(this, filter);

    if (ids.length === 0) {
      return;
    }

    var i, items;
    for (i in ids) {
      items[ids[i]] = this.data[ids[i]];
    }
    
    if (this.options.sync) {
      save.call(this);
    }
  }
};

module.exports = JsonFileDB;
