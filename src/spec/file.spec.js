var jsonDb = require('../lib/json-db.js');
describe('File JSON DB', function() {
  it('should fail when trying to open a file that don\'t have access to',
      function(done) {
        jsonDb('src/testFiles/readonly.json').then(function() {
          fail('Expected promise to reject');
          done()
        }, function(err) {
          expect(err).toEqual(new Error('EACCES: permission denied, access '
              + '\'/mnt/data/home/jack/Development/json-db/src/testFiles'
              + '/readonly.json\''));
          done()
        });
      }
  );

  it('should be able to retrieve a previously stored value', function(done) {
    jsonDb('src/testFiles/existing.json').then(function(db) {
      console.log(db)
      return db.read('test').then(function(val) {
        console.log('get resolve');
        expect(val).toBe('stored');
        done();
      });
    }).catch(function(err) {
      fail(err);
      done();
    });
  });
})
