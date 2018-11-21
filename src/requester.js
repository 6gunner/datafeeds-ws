import _ from 'underscore'
import { getErrorMessage, logMessage } from './helpers';
import {WS} from './ws'
export class Requester {
  constructor (url) {
    let ws = new WS(url, {
      reconnection: true
    })
    ws.on('open', event => {
      logMessage(`k线行情连接成功`)
      _.each(this._callbacks, (callback, callbackKey) => {
          this.ws.send(callback.req)
      })
    })
    ws.on('message', event => {
      let data = event.data
      if (!data) {
        return
      }
      data = JSON.parse(data)
      if(data.id > 0 && this._callbacks[data.id]){
        let callback = this._callbacks[data.id].callback;
        callback(event, data)
      } else {
        let func = this._callbacks[data.api+'#'+data.topic];
        if(func){
          func.callback(data)
        }
      }
    })
    ws.on('close', event => {
      logMessage(`k线行情断开成功`)
    })
    this.ws = ws
    this._url = url
    this._callbacks = {}
    this._requests = []
  }
  subscribe (api, topic, onSubscriberDataReceived) {
    logMessage(`订阅新的主题：api: ${api}, topic: ${topic}`)
    let req = {
      id: _.uniqueId(),
      api: api,
      topic: topic,
      type: 0
    }
    this.ws.send(req)
    this._callbacks[api+'#'+topic] = {req, callback: onSubscriberDataReceived}
  }

  unsubscribe (api, topic) {
    logMessage(`取消订阅主题：api: ${api}, topic: ${topic}`)
    let req = {
      id: _.uniqueId(),
      api: api,
      topic: topic,
      type: 1
    }
    this.ws.send(req)
    this._callbacks[api+'#'+topic] = null;
    delete this._callbacks[api+'#'+topic]
  }

  sendRequest (api, params = '') {
    logMessage(`发送请求: ${api}, 参数: ${params}`)
    let id = _.uniqueId()
    let req = {
      id: id,
      api: api,
      topic: params,
      type: 2
    }
    return new Promise((resolve, reject) => {
      if (this.ws.connectState) {
        this.ws.send(req)
      }
      let callback = function (event, resp) {
        if (resp.error_code !== '0') {
          reject(resp)
          return
        }
        resolve(resp)
      }
      // 缓存所有请求连接上再发送
      this._callbacks[id] = {
        req: req,
        callback: callback
      }
    })
  }
  close() {
    this.ws.close()
  }
}
