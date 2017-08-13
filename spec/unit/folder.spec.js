var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var deasync = require('deasync');
var cp = require('node-cp');
cp.sync = deasync(cp);
var mkdirp = require('mkdirp');
var Promise = require('promise');
var common = require('./common');

var rmrf = Promise.denodeify(rimraf);
var stat = Promise.denodeify(fs.stat);
var unlink = Promise.denodeify(fs.unlink);

/*require('promise/lib/rejection-tracking').enable(
  {allRejections: true}
);*/

describe('Folder JSON DB', function() {
  var testFolder = path.resolve(__dirname, '../../testFolder'),
      badFolder = path.resolve(__dirname, '../../readOnly');

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
  checkFileNoExist(testFolder);
  checkFileNoExist(badFolder);

  beforeAll(function() {
    mkdirp.sync(badFolder, { mode: 0444 });
  });

  afterAll(function(done) {
    return rmrf(badFolder).finally(done);
  });

  afterEach(function(done) {
    return stat(testFolder).then(function() {
      return rmrf(testFolder);
    }, function() {}).finally(done);
  });

  common.instanceTests(testFolder, badFolder);
});
