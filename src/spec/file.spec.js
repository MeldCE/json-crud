var jsonDb = require('../lib/json-db.js');
var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var deasync = require('deasync');
var cp = require('node-cp');
cp.sync = deasync(cp);

describe('File JSON DB', function() {
  var testFolder = path.resolve(__dirname, '../testFiles');
  // Remove all existing test files
  try {
    fs.accessSync(testFolder, fs.R_OK | fs.W_OK);

    // Delete current folder
    rimraf.sync(testFolder);
  } catch(err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  /// Copy folder over
  cp.sync(path.resolve(__dirname, 'testFiles'), testFolder);

  it('should fail when trying to open a file that don\'t have access to',
      function(done) {
        var file = path.resolve(__dirname, '../testFiles/readonly.json');
        jsonDb(file).then(function() {
          fail('Expected promise to reject');
          done()
        }, function(err) {
          expect(err).toEqual(new Error('EACCES: permission denied, access \''
              + file + '\''));
          done()
        });
      }
  );

  it('should be able to retrieve a previously stored value', function(done) {
    var file = path.resolve(__dirname, '../testFiles/existing.json');
    jsonDb(file).then(function(db) {
      return db.read('test').then(function(val) {
        expect(val).toBe('stored');
        done();
      });
    }).catch(function(err) {
      fail(err);
      done();
    });
  });

  it('should be able to retrieve a previously stored complex value', function(done) {
    var file = path.resolve(__dirname, '../testFiles/existing.json');
    jsonDb(file).then(function(db) {
      return db.read('testcomplex').then(function(val) {
        expect(val).toEqual({ value: 'cool', another: 'notcool' });
        done();
      });
    }).catch(function(err) {
      fail(err);
      done();
    });
  });

  it('should be able to store a value and retrieve the same value then delete it', function(done) {
    var file = path.resolve(__dirname, '../testFiles/new.json');
    jsonDb(file).then(function(db) {
      return db.create('test', 'some value').then(function() {
        return db.read('test');
      }).then(function(val) {
        expect(val).toBe('some value');
        delete db;
        return jsonDb(file);
      });
    }).then(function(db) {
        return db.read('test').then(function(val) {
          expect(val).toBe('some value');
          return db.delete('test');
        }).then(function(deleted) {
          expect(deleted).toBe(true);
          delete db;
          // Reopen DB
          return jsonDb(file);
        });
    }).then(function(db) {
        return db.read('test').then(function(val) {
          expect(val).toBe(undefined);
          return db.delete('test');
        }).then(function(deleted) {
          expect(deleted).toBe(false);
          done();
        });
      return Promise.resolve();
    }).catch(function(err) {
      fail(err.stack);
      done();
    });
  });
})
