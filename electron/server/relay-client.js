/**
 * 班级管理大师 - PC 端 Relay 客户端
 *
 * 配对模型（无状态服务器）：
 *   - 手机持有永久 mobileId
 *   - PC 本地持久化授权名单，每次 register 全量上报
 *   - 新手机用配对码首次 join → 服务器通知 mobilePaired → PC 落盘
 *   - PC 可随时 revokeMobile，服务器立即踢人
 *
 * 与 electron/server/relay-core.js 协议严格对应。
 */

const { EventEmitter } = require('events')
const WebSocket = require('ws')
const crypto = require('crypto')
const os = require('os')

function genDeviceId() {
  // 32 位 hex，同一台机器稳定
  const raw = [os.hostname(), os.userInfo().username, os.platform(), os.cpus()[0]?.model].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

class RelayClient extends EventEmitter {
  constructor() {
    super()
    this.ws = null
    this.relayUrl = ''
    this.name = ''
    this.deviceId = genDeviceId()
    this.pairCode = ''
    this.connected = false
    // PC 本地授权名单：[{mobileId, sender, joinedAt}]
    this.authorizedMobiles = []
    this._stopped = true
    this._reconnectAttempts = 0
    this._heartbeatTimer = null
    this._reconnectTimer = null
    // EventEmitter 的 'error' 事件无监听者时会抛崩主进程，加空监听兜底
    this.on('error', () => {})
  }

  /**
   * 连接 Relay
   * @param {string} relayUrl  ws://host:port 或 wss://host（可带 /relay 后缀）
   * @param {string} name      教室名
   * @param {Array}  authorizedMobiles 本地持久化的授权名单
   */
  connect(relayUrl, name, authorizedMobiles = []) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve({ ok: true })
    if (!relayUrl) return Promise.resolve({ ok: false, error: 'Relay 地址未配置' })

    this._stopped = false
    this.relayUrl = relayUrl.replace(/\/+$/, '').replace(/\/relay$/, '') + '/relay'
    this.name = name || '未命名教室'
    this.authorizedMobiles = Array.isArray(authorizedMobiles) ? authorizedMobiles : []

    return new Promise((resolve) => {
      let settled = false
      const ok = (v) => { if (!settled) { settled = true; resolve(v) } }

      try {
        this.emit('connecting')
        this.ws = new WebSocket(this.relayUrl)

        this.ws.on('open', () => {
          this.connected = true
          this._reconnectAttempts = 0
          this._startHeartbeat()
          this._register()
          this.emit('connected')
          ok({ ok: true })
        })

        this.ws.on('message', (raw) => {
          let msg
          try { msg = JSON.parse(raw.toString()) } catch { return }
          this._onMessage(msg)
        })

        this.ws.on('close', () => {
          this.connected = false
          this._stopHeartbeat()
          this.emit('disconnected')
          ok({ ok: false, error: '连接关闭' })
          this._tryReconnect()
        })

        this.ws.on('error', (err) => {
          this.emit('error', err.message)
          ok({ ok: false, error: err.message })
          // close 事件会随后触发并负责重连
        })
      } catch (e) {
        ok({ ok: false, error: e.message })
      }
    })
  }

  disconnect() {
    this._stopped = true
    this._stopHeartbeat()
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null }
    this._reconnectAttempts = 0
    if (this.ws) {
      try { this.ws.removeAllListeners() } catch {}
      try { this.ws.close() } catch {}
      this.ws = null
    }
    this.connected = false
    try { this.emit('disconnected') } catch {}
  }

  /** 更新本地授权名单（main.js 落盘后同步给客户端） */
  setAuthorizedMobiles(list) {
    this.authorizedMobiles = Array.isArray(list) ? list : []
  }

  refreshCode() { this._send({ type: 'refreshCode' }) }
  listPaired() { this._send({ type: 'listPaired' }) }
  grantMobile(mobile) { this._send({ type: 'grantMobile', ...mobile }) }
  revokeMobile(mobileId) { this._send({ type: 'revokeMobile', mobileId }) }

  /** 给已配对手机发消息/连接请求；结果通过 notifyResult 事件回来 */
  notifyMobile(mobileId, title, body) {
    this._send({ type: 'notifyMobile', mobileId, title, body })
  }

  /** 应答手机的数据请求 */
  callResult(payload) {
    this._send({ type: 'callResult', ...payload })
  }

  /** 向教室内所有手机广播（数据变更通知等） */
  dataBroadcast(msg) {
    this._send({ type: 'dataBroadcast', msg })
  }

  getStatus() {
    return {
      connected: this.connected,
      relayUrl: this.relayUrl,
      name: this.name,
      deviceId: this.deviceId,
      pairCode: this.pairCode
    }
  }

  // ==================== 内部 ====================

  _register() {
    this._send({
      type: 'register',
      name: this.name,
      deviceId: this.deviceId,
      authorizedMobiles: this.authorizedMobiles
    })
  }

  _startHeartbeat() {
    this._stopHeartbeat()
    this._heartbeatTimer = setInterval(() => this._send({ type: 'heartbeat' }), 20000)
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer)
    this._heartbeatTimer = null
  }

  _tryReconnect() {
    if (this._stopped) return
    this._reconnectAttempts++
    // 1s 起步，5s 封顶；无限重试，直到网络恢复 / Render 冷启动完成
    const delay = Math.min(5000, this._reconnectAttempts * 1000)
    this._reconnectTimer = setTimeout(() => {
      const base = this.relayUrl.replace(/\/relay$/, '').replace(/\/+$/, '')
      this.connect(base, this.name, this.authorizedMobiles)
    }, delay)
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  _onMessage(msg) {
    switch (msg.type) {
      case 'registered':
        this.pairCode = msg.pairCode
        this.emit('registered', msg)
        break
      case 'code':
        this.pairCode = msg.pairCode
        this.emit('pairCode', msg.pairCode)
        break
      case 'message':
        this.emit('message', {
          mobileId: msg.mobileId,
          sender: msg.sender,
          content: msg.content,
          time: new Date().toLocaleTimeString()
        })
        break
      case 'mobilePaired':
        this.emit('mobilePaired', msg.mobile)
        break
      case 'mobileUnpaired':
        this.emit('mobileUnpaired', msg.mobileId)
        break
      case 'pairedList':
        this.emit('pairedList', msg.mobiles)
        break
      case 'mobileOnline':
        this.emit('mobileOnline', {
          mobileId: msg.mobileId,
          sender: msg.sender,
          state: msg.state
        })
        break
      case 'mobileOffline':
        this.emit('mobileOffline', msg.mobileId)
        break
      case 'notifyResult':
        this.emit('notifyResult', {
          mobileId: msg.mobileId,
          delivered: msg.delivered,
          state: msg.state
        })
        break
      case 'revokeOk':
        this.emit('revokeOk', msg.mobileId)
        break
      case 'call':
        this.emit('call', msg)
        break
      case 'dataPush':
        this.emit('dataPush', msg)
        break
      case 'error':
        this.emit('serverError', msg.msg)
        break
    }
  }
}

module.exports = RelayClient
