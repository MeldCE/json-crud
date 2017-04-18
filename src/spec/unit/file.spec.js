var path = require('path');
var fs = require('fs');
var deasync = require('deasync');
var cp = require('node-cp');
cp.sync = deasync(cp);
var rimraf = require('rimraf');
var Promise = require('promise');

var common = require('./common');

var unlink = Promise.denodeify(fs.unlink);
var stat = Promise.denodeify(fs.stat);
var rmrf = Promise.denodeify(rimraf);

require('promise/lib/rejection-tracking').enable(
  {allRejections: true}
);

describe('File JSON DB', function() {
  var testFile = path.resolve(__dirname, '../../testFile.json'),
      badFile = path.resolve(__dirname, '../../readOnly.json');

  var checkFileNoExist = function(file) {
    try {
      var filestat = fs.statSync(file);

      if (filestat) {
        throw new Error('test file already exists: ' + file);
      }
    } catch(err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  };

  fs.accessSync(__dirname, fs.R_OK | fs.W_OK);
  checkFileNoExist(testFile);
  checkFileNoExist(badFile);

  beforeAll(function() {
    fs.writeFileSync(badFile, '');
    fs.chmodSync(badFile, 0444);
  });

  afterAll(function(done) {
    return rmrf(badFile).finally(done);
  });

  afterEach(function(done) {
    return stat(testFile).then(function() {
      return unlink(testFile);
    }, function(err) {
    }).finally(done);
  });

  common.instanceTests(testFile, badFile);
});
