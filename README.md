# UDF Compatible Datafeed

This folder contains UDF & WS datafeed adapter. It implements [JS API](https://github.com/tradingview/charting_library/wiki/JS%20API) and makes HTTP requests using WS protocol.


This datafeed is implemented in JavaScript

## Folders content

- `./src` folder contains the source code in JavaScript.

- `./dist` folder contains bundled JavaScript files which can be inlined into a page and used in the Widget Constructor.

## Build & bundle

Before building or bundling your code you need to run `npm install` to install dependencies.

`package.json` contains some handy scripts to build or generate the bundle:
- `npm run compile` to compile TypeScript source code into JavaScript files (output will be in `./lib` folder)
- `npm run bundle-js` to bundle multiple JavaScript files into one bundle (it also bundle polyfills)
- `npm run build` to compile and bundle (it is a combination of all above commands)

NOTE: if you want to minify the bundle code, you need to set `ENV` environment variable to a value different from `development`.

For example:
```bash
export ENV=prod
npm run bundle-js # or npm run build
```

or

```bash
ENV=prod npm run bundle-js
```

or

```bash
ENV=prod npm run build
```
