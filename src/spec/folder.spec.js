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
      jsonDb(file).then(function() {
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

  describe('complex filters', function() {
    var db;

    beforeAll(function(done) {
      var file = path.join(testFolder, 'existing');

      jsonDb(file).then(function(database) {
        db = database;
      }, fail).finally(done);
    });

    it('should treat multiple specified values as logical AND',
        function(done) {
      db.read({ someVar: 'some', another: 'another' }).then(function(values) {

        expect(values).toEqual(jasmine.any(Object));
        expect(Object.keys(values).length).toEqual(2);

        Object.keys(values).forEach(function(value) {
          expect(values[value]).toEqual(jasmine.any(Object));
          expect(values[value].someVar).toEqual('some');
          expect(values[value].another).toEqual('another');
        });
      }).catch(fail).finally(done);
    });

    describe('$or', function() {
      it('should logical OR tests in $or array', function(done) {
        db.read({ $or: [{someVar: 'some'}, {another: 'another'}] })
            .then(function(values) {
          expect(values).toEqual(jasmine.any(Object));
          expect(Object.keys(values).length).toEqual(4);

          Object.keys(values).forEach(function(value) {
            expect(values[value]).toEqual(jasmine.any(Object));
            expect(values[value].someVar === 'some'
                || values[value].another === 'another').toEqual(true);
          });
        }).catch(fail).finally(done);
      });
    });

    describe('$and', function() {
      it('should logical AND tests in $and array', function(done) {
        db.read({ $and: [{someVar: 'some'}, {another: 'another'}] })
            .then(function(values) {
          expect(values).toEqual(jasmine.any(Object));
          expect(Object.keys(values).length).toEqual(2);

          Object.keys(values).forEach(function(value) {
            expect(values[value]).toEqual(jasmine.any(Object));
            expect(values[value].someVar).toEqual('some');
            expect(values[value].another).toEqual('another');
          });

        }).catch(fail).finally(done);
      });
    });

    it('should be able to have nested logical statements', function(done) {
      db.read({ $or: [
        {$and: [{someVar: 'some'}, {another: 'else'}]},
        {$and: [{someVar: 'not'}, {another: 'another'}]}
      ] }).then(function(values) {

        expect(values).toEqual(jasmine.any(Object));
        expect(Object.keys(values).length).toEqual(2);

        Object.keys(values).forEach(function(value) {
          expect(values[value]).toEqual(jasmine.any(Object));
          expect(['some', 'not'].indexOf(values[value].someVar)).not.toEqual(-1);
          if (values[value].someVar === 'some') {
            expect(values[value].another).toEqual('else');
          } else {
            expect(values[value].another).toEqual('another');
          }
        });
      }).catch(fail).finally(done);
    });

    describe('$not', function() {
      it('should invert results of given test', function(done) {
        db.read({ $not: { someVar: 'some' } }).then(function(values) {
          expect(Object.keys(values).length).toEqual(5);
          Object.keys(values).forEach(function(value) {
            if (typeof value === 'object' && value.someVar) {
              expect(value.someVar).not.toEqual('some');
            }
          });
        }, fail).finally(done);
      });
    });
  });

  describe('comparisons operators', () => {
    var db;

    beforeAll(function(done) {
      var file = path.join(testFolder, 'existing');

      jsonDb(file).then(function(database) {
        db = database;
      }, fail).finally(done);
    });

    describe('$eq', () => {
      it('should test for equality', (done) => {
        db.read({ someVar: { $eq: 'some'} }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(values[v].someVar).toEqual('some');
          });
        }, fail).finally(done);
      });

      it('should match if the value is in an array', (done) => {
        db.read({ array: { $eq: 'val1'} }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(values[v].array.indexOf('val1')).not.toEqual(-1);
          });
        }, fail).finally(done);
      });
    });

    describe('$ne', () => {
      it('should test for inequality', (done) => {
        db.read({ someVar: { $ne: 'some'} }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(values[v].someVar).not.toEqual('some');
          });
        }, fail).finally(done);
      });

      it('should not match if the value is in an array', (done) => {
        db.read({ array: { $ne: 'val1'} }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            if (values[v].array instanceof Array) {
              expect(values[v].array.indexOf('val1')).toEqual(-1);
            }
          });
        }, fail).finally(done);
      });
    });

    describe('$gt', () => {
      it('should test for mathmatical greatness', (done) => {
        db.read({ numeric: { $gt: 3 } }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(values[v].numeric).toBeGreaterThan(3);
          });
        }, fail).finally(done);
      });
    });

    describe('$gte', () => {
      it('should test for mathmatical equality or greatness', (done) => {
        db.read({ numeric: { $gte: 3 } }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(values[v].numeric).toBeGreaterThan(2);
          });
        }, fail).finally(done);
      });
    });

    describe('$lt', () => {
      it('should test for mathmatical lessness', (done) => {
        db.read({ numeric: { $lt: 3 } }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(values[v].numeric).toBeLessThan(3);
          });
        }, fail).finally(done);
      });
    });

    describe('$lte', () => {
      it('should test for mathmatical equality or lessness', (done) => {
        db.read({ numeric: { $lte: 3 } }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(values[v].numeric).toBeLessThan(4);
          });
        }, fail).finally(done);
      });
    });

    describe('$in', () => {
      it('should test if specified field value is in array of values',
          (done) => {
        var valuesArray = [1, 2, 'not'];
        db.read({ numeric: { $in: valuesArray } }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(valuesArray.indexOf(values[v].numeric)).not.toEqual(-1);
          });
        }, fail).finally(done);
      });
    });

    describe('$nin', () => {
      it('should test if specified field value is not in array of values',
          (done) => {
        var valuesArray = [1, 2, 'not'];
        db.read({ numeric: { $nin: valuesArray } }).then(function(values) {
          expect(Object.keys(values).length).toBeTruthy();
          Object.keys(values).forEach(function(v) {
            expect(values[v]).toEqual(jasmine.any(Object));
            expect(valuesArray.indexOf(values[v].numeric)).toEqual(-1);
          });
        }, fail).finally(done);
      });
    });
  });
});
