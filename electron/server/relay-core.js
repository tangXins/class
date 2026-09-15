/**
 * 班级管理大师 - Relay 协议核心（无状态配对版）
 *
 * 被两处复用，逻辑必须完全一致：
 *   1. electron/server/local-relay.js —— PC 主进程内置（局域网模式）
 *   2. relay/relay-server.js          —— Render 公网部署（跨网络模式）
 *
 * 核心设计：配对关系不在服务器持久化
 *   - 每台手机有永久 mobileId（UUID，存手机 localStorage）
 *   - PC 永久保存授权过的 mobileId 名单（userData/paired-mobiles.json）
 *   - PC 每次 register 时把授权名单上报给服务器
 *   - 服务器只做"令牌核对 + 消息转发"，重启/休眠不影响配对关系
 *
 * 协议：
 *   PC(host) → register   { deviceId, name, authorizedMobiles:[{mobileId,sender,joinedAt}] }
 *                heartbeat / refreshCode
 *                grantMobile  { mobileId, sender, joinedAt }   增量授权（兜底）
 *                revokeMobile { mobileId }                     吊销
 *   host   ← registered { deviceId, name, pairCode }
 *                code { pairCode }
 *                mobilePaired   { mobile:{mobileId,sender,joinedAt} }
 *                mobileUnpaired { mobileId }
 *                message { mobileId, sender, content }
 *
 *   手机    → list
 *                verify { hostDeviceId, mobileId, pairCode? }
 *                join   { hostDeviceId, mobileId, sender, pairCode?, content? }
 *                unpair { hostDeviceId, mobileId }
 *   手机    ← list { rooms:[{name,deviceId,online}] }
 *                verifyOk { room, paired }
 *                joinOk   { room }
 *                revoked  { hostDeviceId }   被 PC 移除授权
 *                error    { msg, needPair? }
 */

const WebSocket = require('ws')
const http = require('http')
const fs = require('fs')

const HEARTBEAT_TIMEOUT = 45000

function genPairCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/**
 * 创建一个 Relay 服务实例
 * @param {object} opts
 * @param {() => string|null} opts.resolveMobileHtml  返回手机页 HTML 文件绝对路径
 * @param {(...args:any[])=>void} [opts.log]
 */
function createRelayServer(opts = {}) {
  const resolveMobileHtml = opts.resolveMobileHtml || (() => null)
  const log = opts.log || console.log.bind(console)

  // rooms: deviceId -> { name, deviceId, pairCode, ws, lastHeartbeat,
  //                      authorized: Map<mobileId, {mobileId,sender,joinedAt}> }
  let rooms = new Map()
  let wss = null
  let server = null
  let cleanupTimer = null

  function getMobileHtml() {
    const p = resolveMobileHtml()
    if (!p) return null
    try { return fs.readFileSync(p, 'utf-8') } catch { return null }
  }

  function pruneDeadRooms() {
    const now = Date.now()
    for (const [id, room] of rooms) {
      if (now - room.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        try { room.ws.close() } catch {}
        rooms.delete(id)
        log(`  [relay-offline] ${room.name} (${id})`)
      }
    }
  }

  function broadcastList() {
    if (!wss) return
    const list = []
    for (const room of rooms.values()) {
      list.push({ name: room.name, deviceId: room.deviceId, online: true })
    }
    const payload = JSON.stringify({ type: 'list', rooms: list })
    for (const client of wss.clients) {
      if (client.role === 'mobile') {
        try { client.send(payload) } catch {}
      }
    }
  }

  const json = (obj) => JSON.stringify(obj)

  /** 吊销后踢掉该手机当前的所有连接 */
  function kickMobile(mobileId, hostDeviceId) {
    if (!wss) return
    for (const client of wss.clients) {
      if (client.role === 'mobile' && client.mobileId === mobileId) {
        try { client.send(json({ type: 'revoked', hostDeviceId })) } catch {}
        setTimeout(() => { try { client.close() } catch {} }, 200)
      }
    }
  }

  function start(port = 9000) {
    return new Promise((resolve) => {
      if (server) { resolve({ ok: true, port }); return }

      const mobilePath = resolveMobileHtml()
      if (mobilePath) log(`   📱 手机端页面: ${mobilePath}`)

      server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Headers', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

        const url = new URL(req.url, `http://${req.headers.host}`)

        if (url.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: true, rooms: rooms.size, uptime: process.uptime() }))
          return
        }

        if (url.pathname === '/m' || url.pathname === '/mobile' || url.pathname === '/mobile/') {
          const html = getMobileHtml()
          if (html) {
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            })
            res.end(html)
          } else {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('mobile page not found on server')
          }
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end(`班级管理大师 Relay Server
端口: ${port}
WebSocket: ws://${req.headers.host}/relay
手机端: http://${req.headers.host}/m`)
      })

      wss = new WebSocket.Server({ server, path: '/relay' })

      log('\n🚀 班级管理大师 Relay Server 启动')
      log(`   监听端口: ${port}`)
      log(`   WebSocket: ws://localhost:${port}/relay\n`)

      wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress
        log(`[relay-connect] ${ip}`)

        ws.on('message', (raw) => {
          let msg
          try { msg = JSON.parse(raw.toString()) } catch {
            ws.send(json({ type: 'error', msg: 'Invalid JSON' })); return
          }

          switch (msg.type) {
            // ======================================================
            //  PC（教室主机）
            // ======================================================
            case 'register': {
              const { deviceId, name, authorizedMobiles } = msg
              if (!deviceId) return ws.send(json({ type: 'error', msg: '缺少 deviceId' }))

              const authorized = new Map()
              if (Array.isArray(authorizedMobiles)) {
                for (const m of authorizedMobiles) {
                  if (m && m.mobileId) {
                    authorized.set(m.mobileId, {
                      mobileId: m.mobileId,
                      sender: m.sender || '手机',
                      joinedAt: m.joinedAt || Date.now()
                    })
                  }
                }
              }

              rooms.set(deviceId, {
                name: name || '未命名教室',
                deviceId,
                pairCode: genPairCode(),
                ws,
                lastHeartbeat: Date.now(),
                authorized
              })
              ws.deviceId = deviceId
              ws.role = 'host'
              const room = rooms.get(deviceId)
              log(`[relay-register] ${room.name} (${deviceId}) 授权手机=${authorized.size} code=${room.pairCode}`)
              ws.send(json({ type: 'registered', deviceId, name: room.name, pairCode: room.pairCode }))
              broadcastList()
              break
            }

            case 'grantMobile': {
              const room = rooms.get(ws.deviceId)
              if (!room || !msg.mobileId) return
              room.authorized.set(msg.mobileId, {
                mobileId: msg.mobileId,
                sender: msg.sender || '手机',
                joinedAt: msg.joinedAt || Date.now()
              })
              log(`[relay-grant] ${room.name} += ${msg.sender} (${msg.mobileId.slice(0, 8)})`)
              break
            }

            case 'revokeMobile': {
              const room = rooms.get(ws.deviceId)
              if (!room) return
              room.authorized.delete(msg.mobileId)
              kickMobile(msg.mobileId, room.deviceId)
              log(`[relay-revoke] ${room.name} -= ${String(msg.mobileId || '').slice(0, 8)}`)
              ws.send(json({ type: 'revokeOk', mobileId: msg.mobileId }))
              break
            }

            case 'refreshCode': {
              const room = rooms.get(ws.deviceId)
              if (!room) return
              room.pairCode = genPairCode()
              ws.send(json({ type: 'code', pairCode: room.pairCode }))
              break
            }

            case 'heartbeat': {
              const room = rooms.get(ws.deviceId)
              if (room) room.lastHeartbeat = Date.now()
              break
            }

            // 兼容：PC 查询当前服务器内授权名单（真实数据源在 PC 本地）
            case 'listPaired': {
              const room = rooms.get(ws.deviceId)
              if (!room) return
              ws.send(json({
                type: 'pairedList',
                mobiles: Array.from(room.authorized.values())
              }))
              break
            }

            // ======================================================
            //  手机
            // ======================================================
            case 'list': {
              const list = []
              for (const room of rooms.values()) {
                list.push({ name: room.name, deviceId: room.deviceId, online: true })
              }
              ws.send(json({ type: 'list', rooms: list }))
              break
            }

            case 'verify': {
              const { hostDeviceId, mobileId, pairCode } = msg
              const room = rooms.get(hostDeviceId)
              if (!room) return ws.send(json({ type: 'error', msg: '教室不在线' }))
              if (!mobileId) return ws.send(json({ type: 'error', msg: '缺少设备标识' }))

              ws.role = 'mobile'
              ws.mobileId = mobileId

              if (room.authorized.has(mobileId)) {
                ws.send(json({ type: 'verifyOk', room: { name: room.name, hostDeviceId }, paired: true }))
                break
              }
              if (pairCode && room.pairCode === pairCode) {
                ws.send(json({ type: 'verifyOk', room: { name: room.name, hostDeviceId }, paired: false }))
              } else {
                ws.send(json({ type: 'error', msg: pairCode ? '配对码错误' : '需要配对码', needPair: !pairCode }))
              }
              break
            }

            case 'join': {
              const { hostDeviceId, mobileId, sender, pairCode, content } = msg
              const room = rooms.get(hostDeviceId)
              if (!room) return ws.send(json({ type: 'error', msg: '教室不在线' }))
              if (!mobileId) return ws.send(json({ type: 'error', msg: '缺少设备标识' }))

              ws.role = 'mobile'
              ws.mobileId = mobileId

              let record = room.authorized.get(mobileId)

              // 未授权 → 必须用当前配对码完成首次配对
              if (!record) {
                if (!pairCode || room.pairCode !== pairCode) {
                  return ws.send(json({ type: 'error', msg: '需要配对码', needPair: true }))
                }
                record = { mobileId, sender: sender || '手机', joinedAt: Date.now() }
                room.authorized.set(mobileId, record)
                log(`[relay-paired] ${room.name} ← ${record.sender} (${mobileId.slice(0, 8)})`)
                try {
                  room.ws.send(json({ type: 'mobilePaired', mobile: record }))
                } catch {}
                broadcastList()
              } else if (sender && !record.sender) {
                record.sender = sender
              }

              if (content) {
                try {
                  room.ws.send(json({
                    type: 'message',
                    mobileId,
                    sender: sender || record.sender || '手机',
                    content
                  }))
                } catch {}
              }

              ws.send(json({ type: 'joinOk', room: { name: room.name, hostDeviceId } }))
              break
            }

            case 'unpair': {
              const { hostDeviceId, mobileId } = msg
              const room = rooms.get(hostDeviceId)
              if (room) {
                room.authorized.delete(mobileId)
                try { room.ws.send(json({ type: 'mobileUnpaired', mobileId })) } catch {}
                log(`[relay-unpaired] ${room.name} ✕ ${String(mobileId || '').slice(0, 8)}`)
              }
              ws.send(json({ type: 'unpairOk' }))
              break
            }

            default:
              ws.send(json({ type: 'error', msg: `未知消息类型: ${msg.type}` }))
          }
        })

        ws.on('close', () => {
          if (ws.role === 'host') {
            const room = rooms.get(ws.deviceId)
            if (room) log(`[relay-host-close] ${room.name} (${ws.deviceId})`)
            rooms.delete(ws.deviceId)
            broadcastList()
          }
        })

        ws.on('error', (err) => console.error(`[relay-error] ${ip}:`, err.message))
      })

      server.on('error', (err) => {
        console.error('[relay] HTTP server 错误:', err.message)
        server = null
        wss = null
        resolve({ ok: false, error: err.message })
      })

      server.listen(port, () => {
        cleanupTimer = setInterval(pruneDeadRooms, 15000)
        resolve({ ok: true, port })
      })
    })
  }

  function stop() {
    if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null }
    if (wss) {
      try { wss.clients.forEach(ws => { try { ws.close() } catch {} }) } catch {}
      try { wss.close() } catch {}
    }
    if (server) {
      try { server.close() } catch {}
    }
    const oldRooms = rooms
    server = null
    wss = null
    rooms = new Map()
    log('[relay] 已停止，在线房间=' + oldRooms.size + '（授权名单由 PC 本地保存，重启不丢失）')
  }

  return { start, stop }
}

module.exports = { createRelayServer, genPairCode }
