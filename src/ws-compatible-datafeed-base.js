import _ from 'underscore';
import { getErrorMessage, logMessage } from './helpers';
import { Requester } from './requester';
import pako from 'pako';


function parseDate(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
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
    supports_time: true,
  };
}
function getPeriodByInterval(interval) {
  try {
    const matched = interval.toString().match(/^(\d+)?([SDWM]?)?$/);
    const num = matched[1] || 1; // 数量
    const resolution = matched[2]; // 单位
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

function unzip(b64Data){
    var strData   = atob(b64Data);
    // Convert binary string to character-number array
    var charData  = strData.split('').map(function(x){return x.charCodeAt(0);});
    // Turn number array into byte-array
    var binData   = new Uint8Array(charData);
    // // unzip
    var data    = pako.inflate(binData);
    // Convert gunzipped byteArray back to ascii string:
    strData   = String.fromCharCode.apply(null, new Uint16Array(data));
    return strData;
}

export class WSCompatibleDatafeedBase {
  constructor (datafeedUrl) {
    this._subscribers = {}; // 订阅的回调
    this._resetCacheNeededCallbacks = {};
    this._datafeedUrl = datafeedUrl;
    this._configuration = defaultConfiguration();
    this._requester = new Requester(datafeedUrl);
  }

  _send (urlPath, params) {
    return this._requester.sendRequest(urlPath, params)
  }

  onReady (callback) {
    setTimeout(() => {
      callback(this._configuration)
    }, 0)
  }

  searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
    // 暂不实现
  }

  getIntervalByPeriod(period) {
        try {
            let matched = period.match(/^(\d+)(s|min|hour|day|mon|week|year)$/)
            let input = matched[0]
            let r = matched[1] || 1
            let type = matched[2]
            switch (type) {
                case 's':
                    return r + 'S';
                case 'hour':
                    return '' + 60 * r;
                case 'day':
                    return r + 'D';
                case 'week':
                    return 7 * parseInt(r, 10) + 'D';
                case 'mon':
                    return r + 'M';
                case 'year':
                    return 12 * parseInt(r, 10) + 'M';
                default:
                    return r
            }
        } catch(e) {
            throw t
        }
    }
  /**
   * @param symbolJsonStr symbol的json字符串
   * @param onSymbolResolvedCallback
   * @param onResolveErrorCallback
   */
  resolveSymbol(symbolStr, onSymbolResolvedCallback, onResolveErrorCallback) {
    logMessage(`获取币对信息${symbolStr}`);
    const exch_abb = symbolStr.split(':')[0];
    const symbol_name = symbolStr.split(':')[1];
    const exch_type = symbolStr.split(':')[2];
    this._send('getSymbol', exch_abb + '.' + symbol_name.replace('/', '').toLowerCase())
      .then(data => {
        logMessage(`解析到币对信息${data.content}`);
        const symbolData = JSON.parse(data.content);
        if (!symbolData) {
          throw new Error('no such symbol');
        }
        const symbolInfo = {
          name: `${symbol_name}:${exch_type}`,
          ticker: `${data.topic}`, // {exch}.{symbol} 唯一标识
          type: 'bitcoin',
          session: '24x7',
          timezone: 'Asia/Shanghai',
          exchange: exch_abb,
          exch_type: exch_type,
          minmov: 1,
          pricescale: Number(`1e${symbolData.price_preci}`),
          volumescale: Number(`1e${symbolData.qty_preci}`),
          has_intraday: true,
          intraday_multipliers: ['1', '5', '15', '30', '60', '240'],
          has_daily: true,
          has_weekly_and_monthly: true,
        }
        onSymbolResolvedCallback(symbolInfo);
      }).catch(err => onResolveErrorCallback(err));
  }

  getBars(symbolInfo, resolution, rangeStartDate, rangeEndDate, onHistoryCallback, onErrorCallback, firstDataRequest) {
    logMessage(`获取Bars: ${resolution}, 从${parseDate(new Date(rangeStartDate * 1000))}到${parseDate(new Date(rangeEndDate * 1000))}`)
    resolution = getPeriodByInterval(resolution);
    const params = {
      exchange: symbolInfo.exchange,
      symbol: symbolInfo.ticker.split('.')[1],
      type: resolution,
      startTime: rangeStartDate,
      endTime: rangeEndDate,
    }
    let api = '';
    console.log(`symbolInfo.exch_type: ${symbolInfo.exch_type}`);
    if (symbolInfo.exch_type == 1 || symbolInfo.exch_type == 4) { // 普通或者智能的
      api = 'getKlineGz'
    } else if (symbolInfo.exch_type == 3){ // 聚合交易市场
      api = 'getCmbKlineGz'
    }
    this._send(api, JSON.stringify(params)).then(resp => {
      const unzipStr = unzip(resp.content);
      let klines = JSON.parse(unzipStr)
      let bars = []
      klines.forEach((kline, index) => {
        bars.push({
          time : kline[0] * 1000,
          open : Number(kline[1]),
          close : Number(kline[2]),
          high : Number(kline[3]),
          low : Number(kline[4]),
          volume : Number(kline[5])
        })
      })
      onHistoryCallback(bars, {
        noData: !bars.length
      })
    }, resp => {
      let reasonString = getErrorMessage(resp)
      logMessage('获取Bars失败, error=' + reasonString)
    })
  }

  subscribeBars (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
    if (this._subscribers.hasOwnProperty(subscriberUID)) {
      logMessage(`${subscriberUID}已经被订阅了,无需再次订阅`)
      return;
    }
    resolution = getPeriodByInterval(resolution);
    // cmb1.btcusdt.resolution
    let topic =  `${symbolInfo.ticker}.${resolution}`;
    let api = '';
    console.log(`symbolInfo.exch_type: ${symbolInfo.exch_type}`);
    if (symbolInfo.exch_type == 1 || symbolInfo.exch_type == 4) { // 普通或者智能的
      api = 'quote.kline';
    } else if (symbolInfo.exch_type == 3) { // 聚合的
      api = 'quote.cmbkline';
    }
    this._subscribers[subscriberUID] = {
      lastBarTime: null,
      api,
      topic,
    }
    this._resetCacheNeededCallbacks[subscriberUID] = onResetCacheNeededCallback;
    this._requester.subscribe(api, topic, _.bind(function(resp) {
      //如果subscription在等待数据的时候被取消了
      if (!this._subscribers.hasOwnProperty(subscriberUID)) {
        logMessage('等待数据的时候已经被取消了 #' + subscriberUID)
        return
      }

      let bars = resp.data
      if (!bars || bars.leng === 0) return
      let lastBar = bars[bars.length - 1]
      let subscriptionRecord = this._subscribers[subscriberUID]
      if (subscriptionRecord.lastBarTime !== null && lastBar.id < subscriptionRecord.lastBarTime) {
        return
      }
      resp.data.forEach((kline, index) => {
        let bar = {
          time : kline.id * 1000,
          open : Number(kline.open),
          close : Number(kline.close),
          high : Number(kline.high),
          low : Number(kline.low),
          volume : Number(kline.vol)
        }
        onRealtimeCallback(bar);
      })
      subscriptionRecord.lastBarTime = lastBar.id
    }, this))
  }

  unsubscribeBars (subscriberUID) {
    const obj = this._subscribers[subscriberUID]
    this._subscribers[subscriberUID] = null
    delete this._subscribers[subscriberUID]
    this._requester.unsubscribe(obj.api, obj.topic)
    delete this._resetCacheNeededCallbacks[subscriberUID]
  }

  calculateHistoryDepth (resolution, resolutionBack, intervalBack) {
    return undefined
  }

  getMarks() {
    // 您的 datafeed 是否支持时间刻度标记。
  }
  getTimescaleMarks (symbolInfo, startDate, endDate, onDataCallback, resolution) {
    // 暂不实现
    if (!this._configuration.supports_timescale_marks) {
      return
    }
  }

  getServerTime (callback) {
    // supports_time 设置为true，需要知道系统时间
    if (!this._configuration.supports_time) {
      return
    }
    logMessage('获取系统时间')
    this._send('getServerTime').then(function(data){
      callback(data.content)
    })
  }

  close() {
    this._requester.close()
  }

  resetCache() {
    for (let listenerGuid in this._resetCacheNeededCallbacks) {
      if (this._resetCacheNeededCallbacks.hasOwnProperty(listenerGuid)) {
        this._resetCacheNeededCallbacks[listenerGuid]();
      }
    }
  }
}
