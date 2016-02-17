var assert = require('assert');
var merge = require('merge');
var fs = require('fs');
var path = require('path');

/** @private
 * Get the filename for a given id
 *
 * @param {String} id Id of parameter to get filename for
 */
function getFilename(id) {
  // @TODO Sanitise id string
  return path.join(this.file, id + '.json');
}

/**
 * Saves the data back to the file
 *
 * @param {String} id String identifier of parameter that brought about save
 *
 * @returns {Promise} A promise that will resolve when the save is complete
 */
function save(id) {
  return Promise(function(resolve, reject) {
    var filename = getFilename.call(this, id);
    if (this.data[id] === 'undefined') {
      // Delete file if exists
    } else {
      fs.writeFile(filename, this.data, function(err) {
        if (err) {
          reject({
            message: 'Error saving data to file ' + filename,
            error: err
          });
        }
      });
    }
    resolve();
  });
}

/** @private
 * Returns the ids of the items that much the given filter
 *
 * @TODO Is there a @context parameter?
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
  this.file = file;
  this.data = require(file);
  this.options = options;

  // Attach listener on to file
  if (options.listen) {
    fs.watch(file, { persistent: true }, listener);
  }
}

JsonFolderDB.prototype = {
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
    return Promise(function(resolv, reject) {
      if (typeof folter !== 'object') {
        reject({
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
    });
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
      save.call(this, id);
    }
  }
};

module.exports = JsonFolderDB;

