import { getErrorMessage, logMessage } from './helpers';
export class WS {
  constructor (url, opts = {}) {
    this.connectState = false
    this.listeners = {}
    this.connectionUrl = url
    this.opts = opts
    this.reconnection = this.opts.reconnection || false
    this.reconnectionAttempts = this.opts.reconnectionAttempts || 5
    this.reconnectionDelay = this.opts.reconnectionDelay || 1000
    this.reconnectTimeoutId = 0
    this.reconnectionCount = 0
    this.connect(url, opts)
  }
  connect (connectionUrl, opts = {}) {
    this.webSocket = new WebSocket(connectionUrl)
    this.webSocket.binaryType = 'arraybuffer'
    if (!('sendObj' in this.webSocket)) {
      this.webSocket.sendObj = (obj) => this.webSocket.send(JSON.stringify(obj))
    }
    this.initEvent()
    return this.webSocket
  }

  reconnect() {
    if (this.reconnectionCount <= this.reconnectionAttempts) {
      this.reconnectionCount++
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = setTimeout(() => {
        this.connect(this.connectionUrl, this.opts)
        this.initEvent()
      }, this.reconnectionDelay)
    }
  }

  initEvent() {
    ['onmessage', 'onopen', 'onclose', 'onerror'].forEach((eventType, index) => {
      this.listeners[eventType] = this.listeners[eventType] || []
      this.webSocket[eventType] = (event) => {
        if (eventType === 'onopen') {
          this.connectState = true
        }
        if (this.reconnection && eventType === 'onopen') {
          this.reconnectionCount = 0
        }
        if (this.reconnection && eventType === 'onclose') {
          this.reconnect(event)
        }
        this.listeners[eventType].forEach((handler) => {
          handler(event)
        })
      }
    })
  }

  on (eventType, handler) {
    if (!['message', 'open', 'close', 'error'].includes(eventType)) {
      throw new Error('event type error')
    }
    let listeners = this.listeners['on'+eventType] || []
    listeners.push(handler)

    this.listeners['on'+eventType] = listeners
  }

  send (data) {
    // if (data.type === 0) {
    //   logMessage(`ws订阅消息：api: ${data.api}, topic: ${data.topic}`)
    // } else if (data.type === 1) {
    //   logMessage(`ws取消订阅消息：api: ${data.api}, topic: ${data.topic}`)
    // } else {
    //   logMessage(`ws发送消息： ${JSON.stringify(data)}`)
    // }
    this.webSocket.sendObj(data);
  }

  close() {
    this.reconnectionCount = 0
    this.reconnectionAttempts = -1
    this.webSocket.close()
  }

}
