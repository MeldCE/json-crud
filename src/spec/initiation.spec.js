var jsonCrud = require('../lib/json-crud');
var path = require('path');

describe('Initiation of json database', function() {
  var testFolder = path.resolve(__dirname, '../testFiles');
  
  it('should reject with no parameters', function(done) {
    jsonCrud().then(function(db) {
      fail('Promise resolve when it should have failed');
      done();
    }, function(err) {
      expect(err).toEqual(new Error('No path or options given'));
      done();
    });
  });
});
