(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('underscore')) :
  typeof define === 'function' && define.amd ? define(['exports', 'underscore'], factory) :
  (factory((global.Datafeeds = {}),global._));
}(this, (function (exports,_) { 'use strict';

  _ = _ && _.hasOwnProperty('default') ? _['default'] : _;

  /**
   * If you want to enable logs from datafeed set it to `true`
   */

  function logMessage(message) {
  }

  function getErrorMessage(error) {
    if (error === undefined) {
      return '';
    } else if (typeof error === 'string') {
      return error;
    }
    return error.message;
  }

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var inherits = function (subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  };

  var possibleConstructorReturn = function (self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  };

  var WS = function () {
    function WS(url) {
      var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      classCallCheck(this, WS);

      this.connectState = false;
      this.listeners = {};
      this.connectionUrl = url;
      this.opts = opts;
      this.reconnection = this.opts.reconnection || false;
      this.reconnectionAttempts = this.opts.reconnectionAttempts || 5;
      this.reconnectionDelay = this.opts.reconnectionDelay || 1000;
      this.reconnectTimeoutId = 0;
      this.reconnectionCount = 0;
      this.connect(url, opts);
    }

    createClass(WS, [{
      key: 'connect',
      value: function connect(connectionUrl) {
        var _this = this;

        this.webSocket = new WebSocket(connectionUrl);
        this.webSocket.binaryType = 'arraybuffer';
        if (!('sendObj' in this.webSocket)) {
          this.webSocket.sendObj = function (obj) {
            return _this.webSocket.send(JSON.stringify(obj));
          };
        }
        this.initEvent();
        return this.webSocket;
      }
    }, {
      key: 'reconnect',
      value: function reconnect() {
        var _this2 = this;

        if (this.reconnectionCount <= this.reconnectionAttempts) {
          this.reconnectionCount++;
          clearTimeout(this.reconnectTimeoutId);
          this.reconnectTimeoutId = setTimeout(function () {
            _this2.connect(_this2.connectionUrl, _this2.opts);
            _this2.initEvent();
          }, this.reconnectionDelay);
        }
      }
    }, {
      key: 'initEvent',
      value: function initEvent() {
        var _this3 = this;

        ['onmessage', 'onopen', 'onclose', 'onerror'].forEach(function (eventType, index) {
          _this3.listeners[eventType] = _this3.listeners[eventType] || [];
          _this3.webSocket[eventType] = function (event) {
            if (eventType === 'onopen') {
              _this3.connectState = true;
            }
            if (_this3.reconnection && eventType === 'onopen') {
              _this3.reconnectionCount = 0;
            }
            if (_this3.reconnection && eventType === 'onclose') {
              _this3.reconnect(event);
            }
            _this3.listeners[eventType].forEach(function (handler) {
              handler(event);
            });
          };
        });
      }
    }, {
      key: 'on',
      value: function on(eventType, handler) {
        if (!['message', 'open', 'close', 'error'].includes(eventType)) {
          throw new Error('event type error');
        }
        var listeners = this.listeners['on' + eventType] || [];
        listeners.push(handler);

        this.listeners['on' + eventType] = listeners;
      }
    }, {
      key: 'send',
      value: function send(data) {
        // if (data.type === 0) {
        //   logMessage(`ws订阅消息：api: ${data.api}, topic: ${data.topic}`)
        // } else if (data.type === 1) {
        //   logMessage(`ws取消订阅消息：api: ${data.api}, topic: ${data.topic}`)
        // } else {
        //   logMessage(`ws发送消息： ${JSON.stringify(data)}`)
        // }
        this.webSocket.sendObj(data);
      }
    }, {
      key: 'close',
      value: function close() {
        this.reconnectionCount = 0;
        this.reconnectionAttempts = -1;
        this.webSocket.close();
      }
    }]);
    return WS;
  }();

  var Requester = function () {
    function Requester(url) {
      var _this = this;

      classCallCheck(this, Requester);

      var ws = new WS(url, {
        reconnection: true
      });
      ws.on('open', function () {
        _.each(_this._callbacks, function (callback) {
          _this.ws.send(callback.req);
        });
      });
      ws.on('message', function (event) {
        var data = event.data;

        if (!data) {
          return;
        }
        var dataJson = JSON.parse(data);
        // getServerTime || getSymbol || getKline
        if (dataJson.id > 0 && _this._callbacks[dataJson.api]) {
          var callback = _this._callbacks[dataJson.api].callback;

          callback(event, dataJson);
        } else {
          // 订阅的币对数据
          var func = _this._callbacks[dataJson.api + '#' + dataJson.topic];
          if (func) {
            func.callback(dataJson);
          }
        }
      });
      ws.on('close', function () {
      });
      this.ws = ws;
      this._callbacks = {};
      this._requests = [];
    }

    createClass(Requester, [{
      key: 'subscribe',
      value: function subscribe(api, topic, onSubscriberDataReceived) {
        var req = {
          id: _.uniqueId(),
          api: api,
          topic: topic,
          type: 0
        };
        this.ws.send(req);
        this._callbacks[api + '#' + topic] = { req: req, callback: onSubscriberDataReceived };
      }
    }, {
      key: 'unsubscribe',
      value: function unsubscribe(api, topic) {
        var req = {
          id: _.uniqueId(),
          api: api,
          topic: topic,
          type: 1
        };
        this.ws.send(req);
        this._callbacks[api + '#' + topic] = null;
        delete this._callbacks[api + '#' + topic];
      }
    }, {
      key: 'sendRequest',
      value: function sendRequest(api) {
        var _this2 = this;

        var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
        var id = _.uniqueId();
        var req = {
          id: id,
          api: api,
          topic: params,
          type: 2
        };
        return new Promise(function (resolve, reject) {
          if (_this2.ws.connectState) {
            _this2.ws.send(req);
          }
          var callback = function callback(event, resp) {
            if (resp.error_code !== '0') {
              reject(resp);
              return;
            }
            resolve(resp);
          };
          // 缓存所有请求连接上再发送
          _this2._callbacks[api] = {
            req: req,
            callback: callback
          };
        });
      }
    }, {
      key: 'close',
      value: function close() {
        this.ws.close();
      }
    }]);
    return Requester;
  }();

  function parseDate(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
  }
  function defaultConfiguration() {
    return {
      supports_search: false,
      supports_group_request: false,
      exchanges: '', // []表示不过滤交易市场, ''表示包括所有交易市场
      symbols_types: '', // []表示不过滤币对，''表示包括所有交易币对
      supported_resolutions: ['1', '5', '15', '30', '60', 'D'],
      supports_marks: false,
      supports_timescale_marks: false, // 是否支持时间缩放
      supports_time: true
    };
  }
  function getPeriodByInterval(interval) {
    try {
      var matched = interval.toString().match(/^(\d+)?([SDWM]?)?$/);
      var num = matched[1] || 1; // 数量
      var resolution = matched[2]; // 单位
      switch (resolution) {
        case 'S':
          return num * 60;
        case 'D':
        case 'W':
        case 'M':
          return 86400;
        default:
          return num * 60;
      }
    } catch (e) {
      throw interval;
    }
  }

  var WSCompatibleDatafeedBase = function () {
    function WSCompatibleDatafeedBase(datafeedUrl) {
      classCallCheck(this, WSCompatibleDatafeedBase);

      this._subscribers = {}; // 订阅的回调
      this._resetCacheNeededCallbacks = {};
      this._datafeedUrl = datafeedUrl;
      this._configuration = defaultConfiguration();
      this._requester = new Requester(datafeedUrl);
    }

    createClass(WSCompatibleDatafeedBase, [{
      key: '_send',
      value: function _send(urlPath, params) {
        return this._requester.sendRequest(urlPath, params);
      }
    }, {
      key: 'onReady',
      value: function onReady(callback) {
        var _this = this;

        setTimeout(function () {
          callback(_this._configuration);
        }, 0);
      }
    }, {
      key: 'searchSymbols',
      value: function searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {}
      // 暂不实现


      /**
       * @param symbolJsonStr symbol的json字符串
       * @param onSymbolResolvedCallback
       * @param onResolveErrorCallback
       */

    }, {
      key: 'resolveSymbol',
      value: function resolveSymbol(symbolStr, onSymbolResolvedCallback, onResolveErrorCallback) {
        var exch_abb = symbolStr.split(':')[0];
        var symbol_name = symbolStr.split(':')[1];
        this._send('getSymbol', exch_abb + '.' + symbol_name.replace('/', '').toLowerCase()).then(function (data) {
          logMessage('\u89E3\u6790\u5230\u5E01\u5BF9\u4FE1\u606F' + data.content);
          var symbolData = JSON.parse(data.content);
          if (!symbolData) {
            throw new Error('no such symbol');
          }
          var symbolInfo = {
            name: symbol_name.toUpperCase(),
            ticker: data.topic, // {exch}.{symbol} 唯一标示
            type: 'bitcoin',
            session: '24x7',
            timezone: 'Asia/Shanghai',
            exchange: exch_abb,
            minmov: 1,
            pricescale: Number('1e' + symbolData.price_preci),
            volumescale: Number('1e' + symbolData.qty_preci),
            has_intraday: true,
            intraday_multipliers: ['1', '5', '15', '30', '60', '240'],
            has_daily: true,
            has_weekly_and_monthly: true
          };
          onSymbolResolvedCallback(symbolInfo);
        }).catch(function (err) {
          return onResolveErrorCallback(err);
        });
      }
    }, {
      key: 'getBars',
      value: function getBars(symbolInfo, resolution, rangeStartDate, rangeEndDate, onHistoryCallback, onErrorCallback, firstDataRequest) {
        logMessage('\u83B7\u53D6Bars: ' + resolution + ', \u4ECE' + parseDate(new Date(rangeStartDate * 1000)) + '\u5230' + parseDate(new Date(rangeEndDate * 1000)));
        resolution = getPeriodByInterval(resolution);
        var params = {
          exchange: symbolInfo.exchange,
          symbol: symbolInfo.ticker.split('.')[1],
          type: resolution,
          startTime: rangeStartDate,
          endTime: rangeEndDate
        };
        this._send('getKline', JSON.stringify(params)).then(function (resp) {
          var klines = JSON.parse(resp.content);
          var bars = [];
          klines.forEach(function (kline, index) {
            bars.push({
              time: kline[0] * 1000,
              open: Number(kline[1]),
              close: Number(kline[2]),
              high: Number(kline[3]),
              low: Number(kline[4]),
              volume: Number(kline[5])
            });
          });
          onHistoryCallback(bars, {
            noData: !bars.length
          });
        }, function (resp) {
          var reasonString = getErrorMessage(resp);
        });
      }
    }, {
      key: 'subscribeBars',
      value: function subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        if (this._subscribers.hasOwnProperty(subscriberUID)) {
          return;
        }
        resolution = getPeriodByInterval(resolution);
        var topic = symbolInfo.ticker + '.' + resolution;
        this._subscribers[subscriberUID] = {
          lastBarTime: null,
          api: 'quote.kline',
          topic: topic
        };
        this._resetCacheNeededCallbacks[subscriberUID] = onResetCacheNeededCallback;
        this._requester.subscribe('quote.kline', topic, _.bind(function (resp) {
          //如果subscription在等待数据的时候被取消了
          if (!this._subscribers.hasOwnProperty(subscriberUID)) {
            return;
          }

          var bars = resp.data;
          if (!bars || bars.leng === 0) return;
          var lastBar = bars[bars.length - 1];
          var subscriptionRecord = this._subscribers[subscriberUID];
          if (subscriptionRecord.lastBarTime !== null && lastBar.id < subscriptionRecord.lastBarTime) {
            return;
          }
          resp.data.forEach(function (kline, index) {
            var bar = {
              time: kline.id * 1000,
              open: Number(kline.open),
              close: Number(kline.close),
              high: Number(kline.high),
              low: Number(kline.low),
              volume: Number(kline.vol)
            };
            onRealtimeCallback(bar);
          });
          subscriptionRecord.lastBarTime = lastBar.id;
        }, this));
      }
    }, {
      key: 'unsubscribeBars',
      value: function unsubscribeBars(subscriberUID) {
        var obj = this._subscribers[subscriberUID];
        this._subscribers[subscriberUID] = null;
        delete this._subscribers[subscriberUID];
        this._requester.unsubscribe(obj.api, obj.topic);
        delete this._resetCacheNeededCallbacks[subscriberUID];
      }
    }, {
      key: 'calculateHistoryDepth',
      value: function calculateHistoryDepth(resolution, resolutionBack, intervalBack) {
        return undefined;
      }
    }, {
      key: 'getMarks',
      value: function getMarks() {
        // 您的 datafeed 是否支持时间刻度标记。
      }
    }, {
      key: 'getTimescaleMarks',
      value: function getTimescaleMarks(symbolInfo, startDate, endDate, onDataCallback, resolution) {
        // 暂不实现
        if (!this._configuration.supports_timescale_marks) {
          return;
        }
      }
    }, {
      key: 'getServerTime',
      value: function getServerTime(callback) {
        // supports_time 设置为true，需要知道系统时间
        if (!this._configuration.supports_time) {
          return;
        }
        this._send('getServerTime').then(function (data) {
          callback(data.content);
        });
      }
    }, {
      key: 'close',
      value: function close() {
        this._requester.close();
      }
    }, {
      key: 'resetCache',
      value: function resetCache() {
        for (var listenerGuid in this._resetCacheNeededCallbacks) {
          if (this._resetCacheNeededCallbacks.hasOwnProperty(listenerGuid)) {
            this._resetCacheNeededCallbacks[listenerGuid]();
          }
        }
      }
    }]);
    return WSCompatibleDatafeedBase;
  }();

  var WSCompatibleDatafeed = function (_WSCompatibleDatafeed) {
    inherits(WSCompatibleDatafeed, _WSCompatibleDatafeed);

    function WSCompatibleDatafeed(datafeedURL) {
      classCallCheck(this, WSCompatibleDatafeed);
      return possibleConstructorReturn(this, (WSCompatibleDatafeed.__proto__ || Object.getPrototypeOf(WSCompatibleDatafeed)).call(this, datafeedURL));
    }

    return WSCompatibleDatafeed;
  }(WSCompatibleDatafeedBase);

  exports.WSCompatibleDatafeed = WSCompatibleDatafeed;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=bundle.js.map
