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
 *                notifyMobile { mobileId, title, body }        给已配对手机发消息/连接请求
 *                callResult   { mobileId, reqId, ok, data, error }  应答手机数据请求
 *                dataBroadcast { ...msg }                      向教室内所有手机广播
 *   host   ← registered { deviceId, name, pairCode }
 *                code { pairCode }
 *                mobilePaired   { mobile:{mobileId,sender,joinedAt} }
 *                mobileUnpaired { mobileId }
 *                mobileOnline   { mobileId, sender, state:'active'|'standby' }
 *                mobileOffline  { mobileId }
 *                notifyResult   { mobileId, delivered, state }
 *                message { mobileId, sender, content }
 *
 *   手机    → list
 *                verify  { hostDeviceId, mobileId, pairCode? }
 *                join    { hostDeviceId, mobileId, sender, pairCode?, content?, persist? }
 *                standby { hostDeviceId, mobileId, sender }   App 后台待命（仅已授权）
 *                unpair  { hostDeviceId, mobileId }
 *                call    { reqId, method, params }           数据请求（班级管理 CRUD）
 *   手机    ← list { rooms:[{name,deviceId,online}] }
 *                verifyOk { room, paired }
 *                joinOk   { room, temporary? }
 *                standbyOk{ room }
 *                notify   { hostDeviceId, hostName, title, body }   待命时收到连接请求
 *                callResult { reqId, ok, data, error }
 *                dataPush { ...msg }                          主机向教室内手机广播
 *                revoked  { hostDeviceId }   被 PC 移除授权
 *                error    { msg, needPair? }
 *
 *   手机三种形态：
 *     active    —— 已进入教室（join 成功），可收发消息
 *     standby   —— App 后台待命（仅已授权手机），只收 notify 连接请求
 *     temporary —— 浏览器临时加入（persist=false），不写授权名单，关闭即失效
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

  /** 安全地向 host 推送事件 */
  function notifyHost(room, obj) {
    if (room && room.ws) { try { room.ws.send(json(obj)) } catch {} }
  }

  /** 查询某授权手机当前状态：active / standby / offline */
  function mobileState(room, mobileId) {
    if (room.active.has(mobileId)) return 'active'
    if (room.standby.has(mobileId)) return 'standby'
    return 'offline'
  }

  /** 按 mobileId 找到当前连接（active 的 ws / standby、temporary 的 entry.ws） */
  function findMobileWs(room, mobileId) {
    const active = room.active.get(mobileId)
    if (active) return active
    const standby = room.standby.get(mobileId)
    if (standby) return standby.ws
    const temp = room.temporary.get(mobileId)
    if (temp) return temp.ws
    return null
  }

  /**
   * PC 重连/重新 register 后，新 room 会替换旧 room。
   * 把仍然连着的手机连接重新挂到新 room（standby / active / temporary），
   * 并向 host 补发 mobileOnline。
   */
  function relinkMobiles(room) {
    if (!wss) return
    for (const client of wss.clients) {
      if (client.role !== 'mobile' || client.hostDeviceId !== room.deviceId) continue
      if (client.tempSession) {
        room.temporary.set(client.mobileId, { mobileId: client.mobileId, sender: client.mobileSender || '手机', ws: client })
        continue
      }
      if (!room.authorized.has(client.mobileId)) {
        // 授权名单已不含它 → 踢掉
        try { client.send(json({ type: 'revoked', hostDeviceId: room.deviceId })) } catch {}
        setTimeout(() => { try { client.close() } catch {} }, 200)
        continue
      }
      const sender = client.mobileSender || room.authorized.get(client.mobileId)?.sender || '手机'
      if (client.inActive) {
        room.active.set(client.mobileId, client)
        notifyHost(room, { type: 'mobileOnline', mobileId: client.mobileId, sender, state: 'active' })
      } else {
        room.standby.set(client.mobileId, { mobileId: client.mobileId, sender, ws: client })
        notifyHost(room, { type: 'mobileOnline', mobileId: client.mobileId, sender, state: 'standby' })
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
                authorized,
                active: new Map(),    // mobileId -> ws（已进教室）
                standby: new Map(),   // mobileId -> {mobileId,sender,ws}（App 后台待命）
                temporary: new Map()  // mobileId -> {mobileId,sender,ws}（浏览器临时）
              })
              ws.deviceId = deviceId
              ws.role = 'host'
              const room = rooms.get(deviceId)
              relinkMobiles(room)
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

            // PC 查询授权名单 + 在线状态（真实数据源在 PC 本地）
            case 'listPaired': {
              const room = rooms.get(ws.deviceId)
              if (!room) return
              ws.send(json({
                type: 'pairedList',
                mobiles: Array.from(room.authorized.values()).map(m => ({
                  ...m,
                  state: mobileState(room, m.mobileId)
                }))
              }))
              break
            }

            // PC 给已配对手机发消息/连接请求：在线就转发，不在线返回 offline
            case 'notifyMobile': {
              const room = rooms.get(ws.deviceId)
              if (!room) return
              const { mobileId, title, body } = msg
              if (!mobileId) return ws.send(json({ type: 'notifyResult', delivered: false, state: 'offline' }))

              const activeWs = room.active.get(mobileId)
              if (activeWs) {
                try {
                  activeWs.send(json({ type: 'message', mobileId, sender: room.name, title: title || '', content: body || '' }))
                } catch {}
                return ws.send(json({ type: 'notifyResult', mobileId, delivered: true, state: 'active' }))
              }

              const standbyEntry = room.standby.get(mobileId)
              if (standbyEntry) {
                try {
                  standbyEntry.ws.send(json({
                    type: 'notify',
                    hostDeviceId: room.deviceId,
                    hostName: room.name,
                    title: title || '连接请求',
                    body: body || ''
                  }))
                } catch {}
                log(`[relay-notify] ${room.name} → ${standbyEntry.sender} (${mobileId.slice(0, 8)})`)
                return ws.send(json({ type: 'notifyResult', mobileId, delivered: true, state: 'standby' }))
              }

              ws.send(json({ type: 'notifyResult', mobileId, delivered: false, state: 'offline' }))
              break
            }

            // 主机应答手机的数据请求：转发给指定手机
            case 'callResult': {
              const room = rooms.get(ws.deviceId)
              if (!room) return
              const target = findMobileWs(room, msg.mobileId)
              if (target) {
                try {
                  target.send(json({
                    type: 'callResult',
                    reqId: msg.reqId,
                    ok: !!msg.ok,
                    data: msg.data,
                    error: msg.error
                  }))
                } catch {}
              }
              break
            }

            // 主机向教室内所有手机广播（数据变更通知等）
            case 'dataBroadcast': {
              const room = rooms.get(ws.deviceId)
              if (!room) return
              const payload = json({ type: 'dataPush', ...(msg.msg || {}) })
              for (const client of wss.clients) {
                if (client.role === 'mobile' && client.hostDeviceId === room.deviceId) {
                  try { client.send(payload) } catch {}
                }
              }
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
              const { hostDeviceId, mobileId, sender, pairCode, content, persist } = msg
              const room = rooms.get(hostDeviceId)
              if (!room) return ws.send(json({ type: 'error', msg: '教室不在线' }))
              if (!mobileId) return ws.send(json({ type: 'error', msg: '缺少设备标识' }))

              ws.role = 'mobile'
              ws.mobileId = mobileId
              ws.hostDeviceId = hostDeviceId
              ws.mobileSender = sender || '手机'

              let record = room.authorized.get(mobileId)
              let isTemporary = false

              if (record) {
                // 已授权手机回归（App 点教室进入 / 接受连接请求）
                if (sender) record.sender = sender
              } else if (persist === false) {
                // 浏览器临时使用：配对码正确就放行，但不写授权名单
                if (!pairCode || room.pairCode !== pairCode) {
                  return ws.send(json({ type: 'error', msg: '需要配对码', needPair: true }))
                }
                isTemporary = true
                ws.tempSession = true
                room.temporary.set(mobileId, { mobileId, sender: sender || '手机', ws })
                log(`[relay-temp-join] ${room.name} ← ${sender || '手机'} (${mobileId.slice(0, 8)})`)
              } else {
                // App 首次配对：必须用当前配对码，成功后永久授权
                if (!pairCode || room.pairCode !== pairCode) {
                  return ws.send(json({ type: 'error', msg: '需要配对码', needPair: true }))
                }
                record = { mobileId, sender: sender || '手机', joinedAt: Date.now(), persist: true }
                room.authorized.set(mobileId, record)
                log(`[relay-paired] ${room.name} ← ${record.sender} (${mobileId.slice(0, 8)})`)
                notifyHost(room, { type: 'mobilePaired', mobile: record })
                broadcastList()
              }

              // 标记为 active（从 standby 进入教室）
              ws.inActive = true
              room.active.set(mobileId, ws)
              room.standby.delete(mobileId)
              room.ws && notifyHost(room, {
                type: 'mobileOnline',
                mobileId,
                sender: sender || record?.sender || '手机',
                state: 'active'
              })

              if (content) {
                notifyHost(room, {
                  type: 'message',
                  mobileId,
                  sender: sender || record?.sender || '手机',
                  content
                })
              }

              ws.send(json({
                type: 'joinOk',
                room: { name: room.name, hostDeviceId },
                temporary: isTemporary
              }))
              break
            }

            // App 后台待命：仅已授权手机可挂，只收 notify 连接请求
            case 'standby': {
              const { hostDeviceId, mobileId, sender } = msg
              const room = rooms.get(hostDeviceId)
              if (!room) return ws.send(json({ type: 'error', msg: '教室不在线' }))
              if (!mobileId) return ws.send(json({ type: 'error', msg: '缺少设备标识' }))
              if (!room.authorized.has(mobileId)) {
                return ws.send(json({ type: 'error', msg: '尚未配对，请扫码配对', needPair: true }))
              }

              ws.role = 'mobile'
              ws.mobileId = mobileId
              ws.hostDeviceId = hostDeviceId
              ws.mobileSender = sender || room.authorized.get(mobileId).sender || '手机'
              ws.inActive = false

              // 已在教室内（active）则保持 active，不降级
              if (room.active.has(mobileId)) {
                ws.inActive = true
                return ws.send(json({ type: 'standbyOk', room: { name: room.name, hostDeviceId } }))
              }

              room.standby.set(mobileId, {
                mobileId,
                sender: ws.mobileSender,
                ws
              })
              notifyHost(room, { type: 'mobileOnline', mobileId, sender: ws.mobileSender, state: 'standby' })
              log(`[relay-standby] ${room.name} ← ${ws.mobileSender} (${mobileId.slice(0, 8)})`)
              ws.send(json({ type: 'standbyOk', room: { name: room.name, hostDeviceId } }))
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

            // 手机在教室内发送聊天消息（区别于 join：join 一辈子一次，
            // chat 可随时发；临时浏览器无需再次提供配对码，连接已通过 join 校验）
            case 'chat': {
              const room = ws.hostDeviceId ? rooms.get(ws.hostDeviceId) : null
              if (!room) return ws.send(json({ type: 'error', msg: '教室不在线' }))
              const inRoom = room.active.has(ws.mobileId) || room.temporary.has(ws.mobileId)
              if (!inRoom) return ws.send(json({ type: 'error', msg: '请先进入教室', needPair: true }))
              const content = String(msg.content || '').slice(0, 5000)
              if (!content.trim()) return
              notifyHost(room, {
                type: 'message',
                mobileId: ws.mobileId,
                sender: ws.mobileSender || '手机',
                content
              })
              ws.send(json({ type: 'chatOk' }))
              break
            }

            // 手机发起数据请求（班级管理 CRUD / 教材目录等）→ 转发主机
            case 'call': {
              const room = ws.hostDeviceId ? rooms.get(ws.hostDeviceId) : null
              const fail = (err) => ws.send(json({ type: 'callResult', reqId: msg.reqId, ok: false, error: err }))
              if (!room) return fail('教室不在线')
              const linked = room.active.has(ws.mobileId)
                || room.temporary.has(ws.mobileId)
                || room.authorized.has(ws.mobileId)
              if (!linked) return fail('未连接教室')
              notifyHost(room, {
                type: 'call',
                reqId: msg.reqId,
                mobileId: ws.mobileId,
                sender: ws.mobileSender || '手机',
                method: String(msg.method || ''),
                params: Array.isArray(msg.params) ? msg.params : []
              })
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
          } else if (ws.role === 'mobile' && ws.hostDeviceId) {
            const room = rooms.get(ws.hostDeviceId)
            if (!room) return
            const wasLinked = room.active.has(ws.mobileId) || room.standby.has(ws.mobileId)
            room.active.delete(ws.mobileId)
            room.standby.delete(ws.mobileId)
            room.temporary.delete(ws.mobileId)
            if (wasLinked && room.authorized.has(ws.mobileId)) {
              notifyHost(room, { type: 'mobileOffline', mobileId: ws.mobileId })
            }
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
