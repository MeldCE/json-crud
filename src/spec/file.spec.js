var jsonDb = require('../lib/json-db.js');
var path = require('path');

describe('File JSON DB', function() {
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

  it('should be able to store a value and retrieve the same value', function(done) {
    var file = path.resolve(__dirname, '../testFiles/new.json');
    jsonDb(file).then(function(db) {
      return db.create('test', 'some value').then(function() {
        return db.read('test').then(function(val) {
          expect(val).toBe('some value');
          done();
        });
      });
    }).catch(function(err) {
      fail(err);
      done();
    });
  });
})
