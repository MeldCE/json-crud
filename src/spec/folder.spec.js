var jsonDb = require('../lib/json-crud');
var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var deasync = require('deasync');
var cp = require('node-cp');
cp.sync = deasync(cp);
var mkdirp = require('mkdirp');
var Promise = require('promise');

require('promise/lib/rejection-tracking').enable(
  {allRejections: true}
);

describe('Folder JSON DB', function() {
  var testFolder = path.resolve(__dirname, '../testFiles');
  var tempTestFolder = path.join(testFolder, 'temp');
  // Remove all existing test files
  try {
    fs.accessSync(testFolder, fs.R_OK | fs.W_OK);
    fs.accessSync(tempTestFolder, fs.R_OK | fs.W_OK);

    // Delete current folder
    rimraf.sync(tempTestFolder);
  } catch(err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  // Double check readonly folder exists
  try {
    var readonly = path.join(testFolder, 'readonly');
    fs.accessSync(readonly, fs.R_OK | fs.W_OK);
  } catch(err) {
    if (err.code !== 'ENOENT') {
      mkdirp.sync(readonly, 511 /*0555*/);
    }
  }

  // Create the temporary test folder
  mkdirp.sync(tempTestFolder);

  it('should fail when trying to open a file that don\'t have access to',
    function(done) {
      var file = path.join(testFolder, 'readonly');
      jsonDb(file).then(function(db) {
        fail('Expected promise to reject');
        done();
      }, function(err) {
        expect(err).toEqual(new Error('EACCES: permission denied, access \''
            + file + '\''));
        done();
      });
    }
  );

  it('should return a single value in an key/value object', function(done) {
    var file = path.join(testFolder, 'existing');
    jsonDb(file).then(function(db) {
      return db.read('test').then(function(val) {
        expect(val).toEqual({ test: 'stored' });
        done();
      });
    }).catch(function(err) {
      fail(err);
      done();
    });
  });

  it('should retrieve a previously stored complex value in key/value object', function(done) {
    var file = path.join(testFolder, 'existing');
    jsonDb(file).then(function(db) {
      return db.read('testcomplex').then(function(val) {
        expect(val).toEqual({ testcomplex: { value: 'cool', another: 'notcool' } });
        done();
      });
    }).catch(function(err) {
      fail(err);
      done();
    });
  });

  it('should retrieve a previously stored complex value based off key/value value within value', function(done) {
    var file = path.join(testFolder, 'existing');
    jsonDb(file).then(function(db) {
      return db.read({ value: 'cool' }).then(function(val) {
        expect(val).toEqual({ testcomplex: { value: 'cool', another: 'notcool' } });
        done();
      });
    }).catch(function(err) {
      fail(err);
      done();
    });
  });

  it('should be able to retrieve a previously stored value as the value only', function(done) {
    var file = path.join(testFolder, 'existing');
    jsonDb(file).then(function(db) {
      return db.read('test', true).then(function(val) {
        expect(val).toBe('stored');
        done();
      });
    }).catch(function(err) {
      fail(err);
      done();
    });
  });

  it('should be able to store a value and retrieve the same value then delete it', function(done) {
    var file = path.join(tempTestFolder, 'new');
    jsonDb(file).then(function(db) {
      return db.create('test', 'some value').then(function() {
        return db.read('test', true);
      }).then(function(val) {
        expect(val).toBe('some value');
        delete db;
        return jsonDb(file);
      });
    }).then(function(db) {
        return db.read('test', true).then(function(val) {
          expect(val).toBe('some value');
          return db.delete('test');
        }).then(function(deleted) {
          expect(deleted).toEqual(['test']);
          delete db;
          // Reopen DB
          return jsonDb(file);
        });
    }).then(function(db) {
        return db.read('test', true).then(function(val) {
          expect(val).toBe(undefined);
          return db.delete('test');
        }).then(function(deleted) {
          expect(deleted).toEqual([]);
          done();
        });
      return Promise.resolve();
    }).catch(function(err) {
      fail(err.stack);
      done();
    });
  });
});
