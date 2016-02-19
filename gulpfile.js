
// This gulpfile extends the Jekyll build flow,
// and deploys to two free GitHub Pages servers.
// The main Jekyll site,
// and a static assets repo.
// File optimizations are done with Gulp and Kraken.
// A development server with watchers and BrowserSync.
// And a test production server too.

// Dependencies
var browserSync = require('browser-sync').create();
var cssnano = require('gulp-cssnano');
var deploy = require('gulp-gh-pages');
var del = require('del');
var eslint = require('gulp-eslint');
var gulp = require('gulp');
var htmlmin = require('gulp-htmlmin');
var htmlreplace = require('gulp-html-replace');
var shell = require('gulp-shell');
var uglify = require('gulp-uglify');
var uglifyInline = require('gulp-uglify-inline');
var rename = require('gulp-rename');
var sass = require('gulp-sass');
var webpack = require('webpack-stream');

// Config
var htmlminConfig = { collapseWhitespace: true };
var privateConfig = require('./_private/config');
var webpackConfig = require('./webpack.config');

// Using a kraken fork that
// adds their resizing API to the library.
// (My changes are upstream in a pull request.)
var kraken = require('./lib/gulp-kraken');
// var kraken = require('gulp-kraken');

// Allow things to break gracefully
// for example, parse errors in JS builds
function errorGraceful (error) {
  console.log(error.toString());
  this.emit('end');
}

// Empty the _site directory
gulp.task('clean', function () {
  return del('_site/**/*');
});

// Lint the JS
gulp.task('lint', function () {
  return gulp.src(['**/*.js',
      '!node_modules/**',
      '!_site/**',
      '!lib/**',
      '!assets/js/analytics.js'
    ])
    .pipe(eslint())
    .pipe(eslint.format());
});

gulp.task('lint:build', ['jekyll build'], function () {
  return gulp.src(['**/*.js',
      '!node_modules/**',
      '!_site/**',
      '!lib/**',
      '!assets/js/analytics.js'
    ])
    .pipe(eslint())
    .pipe(eslint.format());
    // .pipe(eslint.failAfterError());
});

// Serve _site directory
// // Disabled the `jekyll` dev server
// // so that we can use watch to stream sass changes (see next task)
// gulp.task('serve', shell.task([
//   'jekyll serve'
// ]));

// Serve _site directory
// // Watch for changes
gulp.task('serve', ['jekyll build', 'sass:build', 'javascript:build'], function () {
  browserSync.init({
    server: './_site',
    port: '7777'
  });

  gulp.watch([
    '_drafts/**/*',
    '_layouts/**/*',
    '_includes/**/*',
    '_posts/**/*',
    'index.html'
  ], ['build']);

  gulp.watch([
    'assets/js/**/*.js',
    'assets/js/**/*.jsx',
    'assets/js/**/*.scss',
    '!assets/js/posts/**/*'
  ], ['javascript']);

  gulp.watch([
    'assets/js/posts/**/*.js'
  ], ['javascript:posts']);

  gulp.watch([
    '_sass/**/*.scss',
    'assets/css/**/*.scss',
    'assets/css/**/*.css'
  ], ['sass']);
});

// Serve _site directory, production version
gulp.task('serve:production', ['build'], function () {
  browserSync.init(null, {
    server: {
      baseDir: './_site'
    }
  });
});

// Build _site directory
// Default `jekyll` is responsible for building the HTML files
gulp.task('jekyll build', ['clean'], shell.task([
  'jekyll build'
]));

// HTML
gulp.task('htmlmin', ['jekyll build'], function () {
  return gulp.src([
    '_site/*.html',
    '!_site/node_modules'])
    .pipe(htmlmin(htmlminConfig))
    .pipe(gulp.dest('_site'));
});

// CSS
gulp.task('cssnano', ['jekyll build'], function () {
  return gulp.src('_site/assets/css/main.css')
      .pipe(cssnano())
      .pipe(gulp.dest('_site/assets/css'));
});

// Images
gulp.task('kraken', ['jekyll build'], function () {
  if (!privateConfig.kraken) {
    console.log('--- Missing Kraken Config');
    console.log('--- Contact @jasonhargrove');
    return;
  }

  return gulp.src([
    '_site/assets/images/**/*.*',
    '!_site/assets/images/favicon/**/*.*'
  ])
  .pipe(kraken(privateConfig.kraken));
});

// SASS
gulp.task('sass', function () {
  gulp.src('./assets/css/main.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./_site/assets/css'))
    .pipe(browserSync.stream());
});

gulp.task('sass:build', ['jekyll build'], function () {
  gulp.src('./assets/css/main.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./_site/assets/css'))
    .pipe(browserSync.stream());
});

// Javascript
gulp.task('javascript', ['lint', 'html'], function () {
  return gulp.src('./assets/js/app.js')
    .pipe(webpack(webpackConfig))
    .on('error', errorGraceful)
    .pipe(rename('bundle.js'))
    .pipe(gulp.dest('_site/assets/js'))
    .pipe(browserSync.reload({ stream: true }));
});

gulp.task('javascript:posts', function () {
  var path;
  return gulp.src('./assets/js/posts/**/*.js')
    .pipe(rename(function (_path) {
      path = _path;
      return _path;
    }))
    .pipe(webpack(webpackConfig))
    .on('error', errorGraceful)
    .pipe(rename(function (_path) {
      _path.dirname = path.dirname;
      _path.basename = path.basename;
      return _path;
    }))
    .pipe(gulp.dest('_site/assets/js/posts'))
    .pipe(browserSync.reload({ stream: true }));
});

gulp.task('javascript:build', ['jekyll build', 'lint', 'javascript:posts:build'], function () {
  return gulp.src('_site/assets/js/app.js')
  .pipe(webpack(webpackConfig))
  .on('error', errorGraceful)
  .pipe(rename('bundle.js'))
  .pipe(gulp.dest('_site/assets/js'))
  .pipe(eslint())
  .pipe(uglify())
  .pipe(rename('bundle.min.js'))
  .pipe(gulp.dest('_site/assets/js'))
  .pipe(browserSync.reload({ stream: true }));
});

gulp.task('javascript:posts:build', ['jekyll build', 'lint'], function () {
  var path;
  return gulp.src('_site/assets/js/posts/**/*.js')
  .pipe(rename(function (_path) {
    path = _path;
    return _path;
  }))
  .pipe(webpack(webpackConfig))
  .on('error', errorGraceful)
  .pipe(rename(function (_path) {
    _path.dirname = path.dirname;
    _path.basename = path.basename;
    return _path;
  }))
  .pipe(eslint())
  .pipe(uglify())
  .pipe(gulp.dest('_site/assets/js/posts'))
  .pipe(browserSync.reload({ stream: true }));
});

// HTML
gulp.task('html', function () {
  return gulp.src('_site/index.html')
    .pipe(htmlreplace({
      javascript: '/assets/js/bundle.js?b=' + new Date().getTime()
    }))
    .pipe(gulp.dest('_site'));
});

gulp.task('html:build', ['jekyll build'], function () {
  return gulp.src('_site/**/*.html')
    .pipe(htmlreplace({
      javascript: '/assets/js/bundle.min.js?b=' + new Date().getTime()
    }))
    .pipe(htmlmin(htmlminConfig))
    .pipe(uglifyInline())
    .pipe(gulp.dest('_site'));
});

// Deploy _site/assets/ to production assets server
// This will deploy to a project site
// branched off our main site.
// We'll use this for serving assets (it's free!)
// and this will allow us to use Kraken
// a few times per week (on demand)
// rather than every time we build the production _site
// (reducing our Kraken costs)
// The gh-pages branch of the `shootsofficial.assets` repo
// (the org's project's GitHub Page)
// // http://shootsofficial.com/shootsofficial.assets
// Usage example:
// http://shootsofficial.com/shootsofficial.assets/images/duy-montreal-fashion-week-jasonhargrove.jpg

gulp.task('deploy:assets', ['kraken'], function () {
  return gulp.src('./_site/assets/**/*')
    .pipe(deploy({
      remoteUrl: 'https://github.com/shootsofficial/shootsofficial.assets',
      branch: 'gh-pages'
    }));
});

// Deploy _site to production server
// The master branch of the shootsofficial.github.io repo
// (the organization's main GitHub Page)
// http://shootsofficial.com
gulp.task('deploy:production', ['build'], function () {
  return gulp.src('./_site/**/*')
    .pipe(deploy({
      remoteUrl: 'https://github.com/shootsofficial/shootsofficial.github.io',
      branch: 'master'
    }));
});

// Build jekyll site
gulp.task('build', ['jekyll build', 'sass:build', 'javascript:build', 'cssnano', 'html:build'],
function () {
  browserSync.reload();
});

// Shortcut
gulp.task('default', ['build']);
