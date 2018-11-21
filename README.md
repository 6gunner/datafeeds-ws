# UDFDatafeed-WS

这个项目用ws的方式实现了[JS API](https://github.com/tradingview/charting_library/wiki/JS%20API)
帮组大家通过ws的方式来订阅trading view的数据

## 目录内容

- `./src` 源代码.
- `./dist` 打包内容

## 打包方式

打包前运行 `npm install` 安装依赖

`package.json` 包含了以下2个脚本:
- `npm run build` 编译打包生产环境的代码，不包含注释
- `npm run dev` 编译打包测试环境的代码，包含注释

## 备注

这个只是客户端的连接数据的ws实现方式，具体的数据还需要有对应的ws的服务端进行提供
