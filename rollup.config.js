/* globals process */
const babel = require('rollup-plugin-babel');
const uglify = require('rollup-plugin-uglify');
const resolve = require('rollup-plugin-node-resolve');

let environment = process.env.ENV || 'development';
let isDevelopmentEnv = (environment === 'development');

module.exports = [
  {
    input: 'src/index.js',
    output: {
      name: 'Datafeeds',
      sourcemap: true,
      format: 'umd',
      file: 'dist/bundle.js',
      globals: {
        underscore: '_'
      }
    },
    external: ['underscore'],
    plugins: [
      resolve(),
      babel(),
      !isDevelopmentEnv && uglify({output: {inline_script: true}}),
    ]
  }
];
