var jsonDb = require('../../json-crud');
var fs = require('fs');
var merge = require('merge');

/**
 * Defines the read tests
 *
 * @this Test environment
 */
module.exports.instanceTests = function (dbPath, badDbPath) {
  const testData = {
    "test": "stored",
    "testcomplex": {
      "value": "cool",
      "another": "notcool"
    },
    "complex1": {
      "someVar": "some",
      "another": "another",
      "numeric": 1,
      "array": ["val1"]
    },
    "complex2": {
      "someVar": "some",
      "another": "another",
      "numeric": 2,
      "array": ["val1", "val2"]
    },
    "complex3": {
      "someVar": "some",
      "another": "else",
      "numeric": 3,
      "array": ["val1", "val3"]
    },
    "complex4": {
      "someVar": "not",
      "another": "else",
      "numeric": 4,
      "array": ["val2", "val3", "val4"]
    },
    "complex5": {
      "someVar": "not",
      "another": "else",
      "numeric": 5,
      "array": ["val2"]
    },
    "complex6": {
      "someVar": "not",
      "another": "another",
      "numeric": 2,
      "array": ["val1", "val2"]
    }
  };
  //TODO Need a spy on the testData to ensure it isn't change by json-crud!
  const testOptions = [
    {
      label: '',
      options: {}
    },
    {
      label: 'caching values',
      options: {
        cacheValues: true
      }
    },
    {
      label: 'caching keys',
      options: {
        cacheKeys: true
      }
    },
    {
      label: 'caching values and keys',
      options: {
        cacheValues: true,
        cacheKeys: true
      }
    }
  ];
  var keyedTestData = [];
  var keyValueTestData = [];
  Object.keys(testData).forEach(function(key) {
    var value = testData[key];
    keyValueTestData.push(key);
    keyValueTestData.push(value);
    if (typeof value === 'object' && !(value instanceof Array)) {
      keyedTestData.push(Object.assign({}, value, { _id: key }));
    }
  });

  describe('instance creation tests', function() {
    it('should return a Promise that rejects if no options are given', function(done) {
      return jsonDb().then(fail).finally(done);
    });

    it('should return a Promise that rejects if an empty options object is given', function(done) {
      return jsonDb({}).then(fail).finally(done);
    });

    if (badDbPath) {
      it('should return a Promise that rejects if get path that don\'t have access to', function(done) {
        return jsonDb(badDbPath).then(fail, function() {}).finally(done);
      });
    }

    it('should return a Promise that reselves to a JsonDB instance with good options', function(done) {
      return jsonDb(dbPath).then(function(db) {
        expect(db.create).toEqual(jasmine.any(Function));
        expect(db.read).toEqual(jasmine.any(Function));
        expect(db.update).toEqual(jasmine.any(Function));
        expect(db.delete).toEqual(jasmine.any(Function));
        expect(db.close).toEqual(jasmine.any(Function));
      }).finally(done);
    });
  });

  testOptions.forEach(function(testOption) {
    describe('instance tests' + testOption.label, function() {
      var db;
      beforeEach(function(done) {
        return jsonDb(merge(testOption.options, {
          path: dbPath,
          id: '_id'
        })).then(function(dbInstance) {
          db = dbInstance;
        }).catch(fail).finally(done);
      });

      afterEach(function(done) {
        return db.close().finally(done);
        db = null;
      });

      describe('create()', function() {
        it('should return a Promise that rejects on no data', function(done) {
          return db.create().then(fail).finally(done);
        });

        it('should return a Promise that rejects if an object array is given '
            + 'with key field not set', function(done) {
          return db.close().then(function() {
            return jsonDb(dbPath);
          }).then(function(dbInstance) {
            var data = Object.keys(testData).map(function(key) {
              return Object.assign({_id: key}, testData[key]);
            });

            return dbInstance.create(data).then(fail, function() {});
          }).catch(fail).finally(done);
        });

        describe('should return a Promise that resolves to an array of inserted keys',
            function() {
          it('for key/value array', function(done) {
            return db.create(keyValueTestData).then(function(keys) {
              expect(keys).toEqual(jasmine.any(Array));
              expect(keys.length).toEqual(Object.keys(testData).length);
              Object.keys(testData).forEach(function(key) {
                expect(keys.indexOf(key)).not.toEqual(-1);
              });
            }).catch(fail).finally(done);
          });

          it('for an object array if key field set', function(done) {
            return db.create(keyedTestData).then(function(keys) {
              expect(keys).toEqual(jasmine.any(Array));
              expect(keys.length).toEqual(keyedTestData.length);
              keyedTestData.forEach(function(value) {
                expect(keys.indexOf(value._id)).not.toEqual(-1);
              });
            }).catch(fail).finally(done);
          });

          it('for key/value object', function(done) {
            return db.create(testData).then(function(keys) {
              expect(keys).toEqual(jasmine.any(Array));
              expect(keys.length).toEqual(Object.keys(testData).length);
              Object.keys(testData).forEach(function(key) {
                expect(keys.indexOf(key)).not.toEqual(-1);
              });
            }).catch(fail).finally(done);
          });
        });

        describe('should return an Error object with id and data properties for any '
            + 'create that failed within the resolved array', function() {
          var key = 'testcomplex';
          beforeEach(function(done) {
            console.log('adding to dbl', key);
            return db.create([key, testData[key]]).catch(fail).finally(done);
          });

          it('for key/value pair array', function(done) {
            return db.create(keyValueTestData).then(function(secondKeys) {
              expect(secondKeys.length).toEqual(Object.keys(testData).length);
              secondKeys.forEach(function(secondKey) {
                expect(secondKey).not.toEqual(key);
                if (secondKey instanceof Error) {
                  expect(secondKey.id).toEqual(key);
                  expect(secondKey.data).toEqual(testData[key]);
                }
              });
            }).catch(fail).finally(done);
          });

          it('for array of keyed objects', function(done) {
            return db.create(keyedTestData).then(function(secondKeys) {
              console.log('XXXXX', secondKeys);
              expect(secondKeys.length).toEqual(keyedTestData.length);
              secondKeys.forEach(function(secondKey) {
                expect(secondKey).not.toEqual(key);
                if (secondKey instanceof Error) {
                  expect(secondKey.id).toEqual(key);
                  expect(secondKey.data).toEqual(keyedTestData.find(function(data) {
                    return data._id === key;
                  }));
                }
              });
            }).catch(fail).finally(done);
          });

          it('for key/value object', function(done) {
            return db.create(testData).then(function(secondKeys) {
              expect(secondKeys.length).toEqual(Object.keys(testData).length);
              console.log('XXXXX', secondKeys);
              secondKeys.forEach(function(secondKey) {
                expect(secondKey).not.toEqual(key);
                if (secondKey instanceof Error) {
                  expect(secondKey.id).toEqual(key);
                  expect(secondKey.data).toEqual(testData[key]);
                }
              });
            }).catch(fail).finally(done);
          });
        });

        it('should not store/cache the given data Object', function(done) {
          var testDataCopy = merge(true, testData);
          return db.create(testData).then(function() {
            testDataCopy.complex1.someVar = 'bad';
            return db.read('complex1');
          }).then(function(results) {
            expect(results.complex1.someVar).not.toEqual('bad');
          }).catch(fail).finally(done);
        });
      });

      describe('read()', function() {
        beforeEach(function(done) {
          console.log('SPEC adding testdata', testData);
          return db.create(testData).catch(fail).finally(done);
        });

        describe('complex filters', function() {
          it('should treat multiple specified values as logical AND',
              function(done) {
            db.read({ someVar: 'some', another: 'another' }).then(function(values) {
              console.log('read got values', values);

              expect(values).toEqual(jasmine.any(Object));
              expect(Object.keys(values).length).toEqual(2, 'two matching items');

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
                  if (values[v].array instanceof  Array) {
                    expect(values[v].array.indexOf('val1')).toEqual(-1);
                  }
                });
              }, fail).finally(done);
            });
          });

          describe('$gt', () => {
            it('should test for mathmatical greatness', (done) => {
              db.read({ numeric: { $gt: 3 } }).then(function(values) {
                console.log('from got', values);
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

      describe('update()', function() {
        beforeEach(function(done) {
          return db.create(testData).catch(fail).finally(done);
        });

        it('should return a Promise that resolves to an array of the ids of '
            + 'the values that were updated', function(done) {
          return db.update({ test: 'newValue' }, true).then(function(ids) {
            expect(ids).toEqual(jasmine.any(Array));
            expect(ids.length).toEqual(1);
            expect(ids[0]).toEqual('test');
            return db.read('test').then(function(results) {
              expect(results.test).toEqual('newValue');
            });
          }, fail).finally(done);
        });

        it('should merge object values if given with false',
            function(done) {
          var newValue = {
            _id: 'testcomplex',
            another: 'cool',
            newValue: 'new'
          };

          return db.update([newValue], false).then(function(ids) {
            expect(ids).toEqual(['testcomplex']);

            return db.read().then(function(results) {
              Object.keys(results).forEach(function(key) {
                if (key === 'testcomplex') {
                  expect(results[key]).toEqual(merge({}, testData['testcomplex'], newValue));
                } else {
                  expect(results[key]).toEqual(testData[key]);
                }
              });
            });
          }).catch(fail).finally(done);
        });

        it('should replace object values in array if given with true',
            function(done) {
          var newValue = {
            _id: 'testcomplex',
            another: 'cool',
            newValue: 'new'
          };

          return db.update([newValue], true).then(function(ids) {
            expect(ids).toEqual(['testcomplex']);

            return db.read().then(function(results) {
              Object.keys(results).forEach(function(key) {
                if (key === 'testcomplex') {
                  expect(results[key]).toEqual(newValue);
                } else {
                  expect(results[key]).toEqual(testData[key]);
                }
              });
            });
          }).catch(fail).finally(done);
        });

        it('should update values with given an array of key/value pairs',
            function(done) {
          var newValues = {
            test: { key: 'value' },
            testComplex: 'stringValue',
            complex1: {
              someVar: 'newValue'
            }
          };

          var newValuesArray = Object.keys(newValues).reduce(function(acc, key) {
            acc.push(key);
            acc.push(newValues[key]);

            return acc;
          }, []);

          return db.update(newValuesArray).then(function(ids) {
            expect(ids).toEqual(jasmine.any(Array));
            expect(ids.length).toEqual(Object.keys(newValues).length);
          }).catch(fail).finally(done);
        });

        it('should replace existing values if filter set to true with an object '
            + 'of key/value pairs to update the database with', function(done) {
          var newValues = {
            test: { key: 'value' },
            testComplex: 'stringValue',
            complex1: {
              someVar: 'newValue'
            }
          };

          return db.update(newValues, true).then(function(ids) {
            return db.read(ids);
          }).then(function(results) {
            Object.keys(newValues).forEach(function(id) {
              expect(results[id]).toEqual(newValues[id]);
            });
          }).catch(fail).finally(done);
        });

        it('should merge existing object values if new object value given and '
            + 'replace the current value for non-object values if filter is set '
            + 'to false with an object of key/value pairs to update the database '
            + 'with', function(done) {
          var newValues = {
            test: { key: 'value' },
            testComplex: 'stringValue',
            complex1: {
              someVar: 'newValue'
            }
          };

          return db.update(newValues, false).then(function(ids) {
            console.log('got ids', ids);
            return db.read(ids);
          }).then(function(results) {
            expect(results['test']).toEqual(newValues['test']);
            expect(results['testComplex']).toEqual(newValues['testComplex']);
            expect(results['complex1']).toEqual(merge({}, testData['complex1'],
                newValues['complex1']));
          }).catch(fail).finally(done);
        });

        it('should update all object values when object of key/values pairs is '
            + 'given for data and filter is undefined', function(done) {
          var newValues = { newValue: 'myNewValue' };
          return db.update(newValues).then(function(ids) {
            var objectKeys = Object.keys(testData).reduce(function(acc, key) {
              if (!(testData[key] instanceof Array) && testData[key] instanceof Object) {
                acc.push(key);
              }

              return acc;
            }, []);
            console.log('ids from update all', ids);
            expect(ids.length).toEqual(objectKeys.length);

            return db.read(ids).then(function(results) {
              Object.keys(results).forEach(function(id) {
                expect(objectKeys.indexOf(id)).not.toEqual(-1);
                expect(results[id]).toEqual(merge({}, testData[id], newValues));
              });
            });
          }).catch(fail).finally(done);
        });

        it('should update only object values matching filter when object of '
            + 'key/values pairs is given for data with a filter', function(done) {
          var newValues = { newValue: 'myNewValue' };
          var filter = { numeric: 2 };
          return db.update(newValues, filter).then(function(ids) {
            var objectKeys = Object.keys(testData).reduce(function(acc, key) {
              if (!(testData[key] instanceof Array) && testData[key] instanceof Object
                  && testData[key]['numeric'] === 2) {
                acc.push(key);
              }

              return acc;
            }, []);
            expect(ids.length).toEqual(objectKeys.length);

            return db.read(ids).then(function(results) {
              Object.keys(results).forEach(function(id) {
                expect(objectKeys.indexOf(id)).not.toEqual(-1);
                expect(results[id]).toEqual(merge({}, testData[id], newValues));
              });
            });
          }).catch(fail).finally(done);
        });
      });

      describe('delete()', function() {
        beforeEach(function(done) {
          return db.create(testData).catch(fail).finally(done);
        });

        it('should return a promise that rejects if no parameters are given',
            function(done) {
          return db.delete().then(fail, function() {}).finally(done);
        });

        it('should return a promise that resolves to an array of the keys of '
           + 'the values deleted', function(done) {
          var keys = ['test', 'testcomplex'];

          return db.delete(keys).then(function(ids) {
            expect(ids).toEqual(jasmine.any(Array));
            expect(ids).toEqual(keys);
          }).catch(fail).finally(done);
        });

        it('should delete only the values of the keys given if an array of keys '
            + 'to delete is given', function(done) {
          var keys = ['test', 'testcomplex'];

          return db.delete(keys).then(function(ids) {
            expect(ids.length).toEqual(keys.length);

            keys.forEach(function(key) {
              ids.splice(ids.indexOf(key), 1);
            });

            expect(ids.length).toEqual(0, 'ids and keys contain the same elements');

            return db.read();
          }).then(function(results) {
            Object.keys(testData).forEach(function(key) {
              if (keys.indexOf(key) === -1) {
                expect(results[key]).toBeDefined();
              }
            });
          }).catch(fail).finally(done);
        });

        it('should not include keys that weren\'t deleted if they were given '
            + 'didn\'t exist', function(done) {
          var keys = ['test', 'testcomplex', 'notInTestData'];

          return db.delete(keys).then(function(ids) {
            expect(ids.length).toEqual(2);

            expect(ids.indexOf('notInTestData')).toEqual(-1);
          }).catch(fail).finally(done);
        });

        it('should delete only items that match the given filter', function(done) {
          var filter = { numeric: 2 };

          return db.delete(filter).then(function(ids) {
            var objectKeys = Object.keys(testData).reduce(function(acc, key) {
              if (!(testData[key] instanceof Array) && testData[key] instanceof Object
                  && testData[key]['numeric'] === 2) {
                acc.push(key);
              }

              return acc;
            }, []);
            expect(ids.length).toEqual(objectKeys.length);

            return db.read().then(function(results) {
              Object.keys(results).forEach(function(key) {
                expect(objectKeys.indexOf(key)).toEqual(-1);
                expect(ids.indexOf(key)).toEqual(-1);
              });
            });
          }).catch(fail).finally(done);
        });

        it('should delete all values if a value of true is given', function(done) {
          return db.delete(true).then(function(ids) {
            expect(ids.length).toEqual(Object.keys(testData).length, 'total number of items');

            return db.read();
          }).then(function(results) {
            expect(Object.keys(results).length).toEqual(0, 'no items left');
          }).catch(fail).finally(done);
        });
      });

      describe('close()', function() {
        it('should return a Promise that resolves when the instance is closed',
            function(done) {
          return db.close().catch(fail).finally(done);
        });
      });
    });
  });

};
