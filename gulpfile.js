var path = require('path');
var del = require('del');
var rename = require('rename');
var packageInfo = require('./package.json');

var gulp = require('gulp');
var gutil = require('gulp-util');
var eslint = require('gulp-eslint');
var jasmine = require('gulp-jasmine');
var documentation = require('gulp-documentation');
var concat = require('gulp-concat');
var checkDeps = require('gulp-check-deps');
var replace = require('gulp-replace');
var istanbul = require('gulp-istanbul');
var stripDebug = require('gulp-strip-debug');
var coveralls = require('gulp-coveralls');
var foreach = require('gulp-foreach');
var rename = require('gulp-rename');
var include = require('gulp-include');
var coolReporter = require('jasmine2-reporter').Jasmine2Reporter;
var complexity = require('gulp-complexity');


var paths = {
  dist: './',
  build: 'build/',
  reports: 'reports/',
  docs: 'docs/',
  src: 'src/lib/**/*.js',
  srcJson: 'src/lib/**/*.json',
  testDir: 'src/spec',
  testSrc: 'src/*.spec.js',
  srcTests: 'src/spec/**/*.js',
  srcMain: 'src/json-crud.js',
  srcTestLib: 'src/spec/lib/*.js',
  srcJasmineJson: 'src/spec/support/jasmine.json',
  tests: 'spec/**/*.js',
  lcov: 'coverage/lcov.info',
  mddoc: 'doc.md'
};

gulp.task('clean', [], function() {
  del([
    path.join(paths.dist, '**'),
    path.join(paths.build, '**')
  ], {force: true});
});

gulp.task('check:deps', function() {
  return gulp.src('package.json')
      .pipe(checkDeps());
});

gulp.task('lint', function() {
  return gulp.src([paths.src, paths.srcMain])
      .pipe(eslint({
        useEslintrc: true,
        env: {
          node: true,
          es6: true
        }
      }))
      .pipe(eslint.format())
      .pipe(eslint.failAfterError());
});

gulp.task('lint:test', function() {
  return gulp.src([paths.srcTests, paths.srcTestLib])
      .pipe(eslint({
        useEslintrc: true,
        env: {
          node: true,
          es6: true,
          jasmine: true
        }
      }))
      .pipe(eslint.format())
      .pipe(eslint.failAfterError());
});

gulp.task('compile:tests', function() {
  return gulp.src(paths.testSrc)
      .pipe(include())
      .pipe(eslint({
        useEslintrc: true,
        env: {
          node: true,
          es6: true,
          jasmine: true
        }
      }))
      .pipe(eslint.format())
      .pipe(eslint.failAfterError())
      .pipe(gulp.dest(paths.testDir));
});

gulp.task('pre-test', ['lint', 'lint:test'], function() {
  return gulp.src([paths.src, paths.srcMain])
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire())
    // Write the covered files to a temporary directory
    .pipe(gulp.dest('test-tmp/'));
});

gulp.task('jasmine', ['compile:tests', 'lint', 'lint:test', 'pre-test'], function() {
  return gulp.src(paths.srcTests)
      .pipe(jasmine())
      //.pipe(istanbul.writeReports());
});

gulp.task('jasmine:production', ['copy', 'jasmine'], function() {
  return gulp.src(paths.tests)
      .pipe(jasmine())
      .pipe(istanbul.writeReports())
      .pipe(istanbul.enforceThresholds({ thresholds: { each: {
        statements: 80,
        branches: 75,
        lines: 80
      } } }));
});

gulp.task('coveralls', ['jasmine:production'], function() {
  return gulp.src(paths.lcov)
        .pipe(coveralls());
});

gulp.task('complexity', ['lint', 'lint:test'], function() {
  return gulp.src([paths.src, paths.srcMain])
      .pipe(complexity());
});

gulp.task('docs', ['htmldocs', 'mddocs', 'readme']);

gulp.task('htmldocs', ['lint'], function() {
  return gulp.src([paths.src, paths.srcMain])
      .pipe(documentation({ format: 'html' }))
      .pipe(gulp.dest(paths.docs));
});

gulp.task('mddocs', ['lint'], function() {
  return gulp.src([paths.src, paths.srcMain])
      .pipe(foreach(function(stream, file) {
        return stream
            .pipe(documentation({ format: 'md', shallow: true }))
            .pipe(replace(/^#/gm, '##'))
            .pipe(concat(file.relative + '.md'));
            //.pipe(rename({
            //  basename: file.name,
            //  extname: '.md'
            //}));
      }))
      //.pipe(concat(paths.mddoc))
      .pipe(gulp.dest(paths.build));
});

/*gulp.task('mddocs', ['lint'], function() {
  return gulp.src([paths.src, paths.srcMain])
      .pipe(documentation({ format: 'md' }))
      //.pipe(concat(paths.mddoc))
      .pipe(gulp.dest(paths.build));
});*/

gulp.task('readme', ['mddocs'], function() {
  return gulp.src(['src/README.md', path.join(paths.build, paths.mddoc)])
      .pipe(concat('README.md'))
      .pipe(replace(/%%([a-zA-Z0-9-_.]+)%%/g, function(match, param) {
        if (packageInfo[param]) {
          return packageInfo[param];
        } else {
          return match;
        }
      }))
      .pipe(include())
      .pipe(gulp.dest('./'));
});

gulp.task('copy', ['jasmine', 'copy:json'], function() {
  return gulp.src([paths.src, paths.srcMain, paths.srcTests, paths.srcTestLib], { base: 'src' })
    .pipe(stripDebug())
    .pipe(gulp.dest(paths.dist));
});

gulp.task('copy:dev', ['jasmine', 'copy:json'], function() {
  return gulp.src([paths.src, paths.srcMain, paths.srcTests, paths.srcTestLib], { base: 'src' })
    .pipe(gulp.dest(paths.dist));
});

gulp.task('copy:json', ['jasmine'], function() {
  return gulp.src([paths.srcJasmineJson, paths.srcJson], { base: 'src' })
    .pipe(gulp.dest(paths.dist));
});

gulp.task('test', ['lint', 'lint:test', 'compile:tests'], function() {
  return gulp.src(paths.srcTests)
      .pipe(jasmine({
        reporter: new coolReporter({
          inColors: true
        })
      }))
});

gulp.task('watch', function() {
  gulp.watch([paths.src, paths.srcJson, paths.srcMain, paths.srcTests], ['jasmine']);
  gulp.watch([paths.src, paths.srcMain], ['lint']);
  gulp.watch(paths.testSrc, ['compile:tests']);
  gulp.watch(paths.srcTests, ['lint:test']);
  gulp.watch(['src/README.md', paths.src, paths.srcMain], ['readme']);
  gulp.watch([paths.src, paths.srcMain], ['docs']);
  gulp.watch('package.json', ['check:deps']);
});

defaultTasks = ['check:deps', 'jasmine', /*'complexity',*/ 'docs', 'readme'];

gulp.task('one', defaultTasks);

gulp.task('default', defaultTasks.concat(['watch']));

gulp.task('dev', defaultTasks.concat(['copy:dev', 'watch']));

//gulp.task('production', defaultTasks.concat(['copy', 'jasmine:production', 'coveralls']));
gulp.task('production', defaultTasks.concat(['copy', 'jasmine:production']));
