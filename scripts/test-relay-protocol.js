/**
 * Relay 无状态配对协议端到端测试（一次性脚本，不引入新依赖，使用项目已有的 ws）
 *
 * 覆盖：
 *  1. host register 全量上报授权名单
 *  2. 已授权手机无码 join 直接放行
 *  3. 未授权手机无码 join 被拒（needPair）
 *  4. verify 错码/对码
 *  5. 首次带码 join → 授权 + host 收到 mobilePaired
 *  6. revokeMobile → 手机收到 revoked 并被踢，之后无码 join 再次被拒
 *  7. 服务器"重启"（stop→start，模拟 Render 休眠后内存清空）：
 *     host 重新 register 上报本地名单，已授权手机依旧无码直连
 *  8. HTTP /health 与 /m
 *  9. relay-client 冷启动：先连不上，服务起来后自动重连并 registered
 */

const http = require('http')
const path = require('path')
const WebSocket = require('ws')
const { createRelayServer } = require('../electron/server/relay-core')
const RelayClient = require('../electron/server/relay-client')

const PORT = 9123
const URL = `ws://127.0.0.1:${PORT}/relay`
const HOST = 'host-device-001'
const M1 = 'mobile-aaaa-1111'
const M2 = 'mobile-bbbb-2222'

let passed = 0
let failed = 0
function ok(cond, name) {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.error(`  ❌ ${name}`) }
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function wsConnect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}
function nextMsg(ws, filter = () => true, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { ws.off('message', onMsg); reject(new Error('等待消息超时')) }, timeoutMs)
    const onMsg = (raw) => {
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (filter(msg)) { clearTimeout(t); ws.off('message', onMsg); resolve(msg) }
    }
    ws.on('message', onMsg)
  })
}
function httpGet(p) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${p}`, (res) => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => resolve({ status: res.statusCode, body }))
    }).on('error', reject)
  })
}

async function main() {
  const mobileHtmlPath = path.join(__dirname, '..', 'mobile', 'index.html')
  const server = createRelayServer({
    resolveMobileHtml: () => mobileHtmlPath,
    log: () => {}
  })

  console.log('\n[1] 启动服务 + host 注册（授权名单含 M1）')
  let r = await server.start(PORT)
  ok(r.ok, 'relay start')

  const host = await wsConnect()
  const regP = nextMsg(host, m => m.type === 'registered')
  host.send(JSON.stringify({ type: 'register', deviceId: HOST, name: '测试教室', authorizedMobiles: [{ mobileId: M1, sender: '小明', joinedAt: Date.now() }] }))
  const reg = await regP
  ok(!!reg.pairCode && reg.pairCode.length === 6, `registered 返回 6 位配对码 (${reg.pairCode})`)
  const code = reg.pairCode

  console.log('\n[2] M1（已授权）无码 join')
  const m1 = await wsConnect()
  m1.send(JSON.stringify({ type: 'join', hostDeviceId: HOST, mobileId: M1, sender: '小明', pairCode: '', content: '' }))
  const join1 = await nextMsg(m1, m => m.type === 'joinOk' || (m.type === 'error'))
  ok(join1.type === 'joinOk', 'M1 无码直接 joinOk')

  console.log('\n[3] M2（未授权）无码 join 被拒')
  const m2 = await wsConnect()
  m2.send(JSON.stringify({ type: 'join', hostDeviceId: HOST, mobileId: M2, sender: '小红', pairCode: '', content: '' }))
  const join2 = await nextMsg(m2, m => m.type === 'error')
  ok(join2.needPair === true, 'M2 收到 error{needPair:true}')

  console.log('\n[4] verify：错码拒绝 / 对码通过')
  m2.send(JSON.stringify({ type: 'verify', hostDeviceId: HOST, mobileId: M2, pairCode: 'ZZZZZZ' }))
  const vBad = await nextMsg(m2, m => m.type === 'error')
  ok(/配对码/.test(vBad.msg), '错码 verify 被拒')
  m2.send(JSON.stringify({ type: 'verify', hostDeviceId: HOST, mobileId: M2, pairCode: code }))
  const vOk = await nextMsg(m2, m => m.type === 'verifyOk')
  ok(vOk.paired === false, '对码 verifyOk{paired:false}')

  console.log('\n[5] M2 带码首次 join → 授权，host 收到 mobilePaired')
  m2.send(JSON.stringify({ type: 'join', hostDeviceId: HOST, mobileId: M2, sender: '小红', pairCode: code, content: '' }))
  const [pairedEvt, join3] = await Promise.all([
    nextMsg(host, m => m.type === 'mobilePaired'),
    nextMsg(m2, m => m.type === 'joinOk')
  ])
  ok(pairedEvt.mobile?.mobileId === M2, 'host 收到 mobilePaired{M2}')
  ok(join3.type === 'joinOk', 'M2 带码 joinOk')

  console.log('\n[6] 消息转发：M2 join 带 content → host 收到 message')
  m2.send(JSON.stringify({ type: 'join', hostDeviceId: HOST, mobileId: M2, sender: '小红', pairCode: '', content: '老师好' }))
  const msgEvt = await nextMsg(host, m => m.type === 'message')
  ok(msgEvt.content === '老师好' && msgEvt.mobileId === M2, 'host 收到 M2 的消息')

  console.log('\n[7] host 吊销 M2 → M2 收到 revoked 并被踢')
  let revoked = null
  m2.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.type === 'revoked') revoked = m })
  const closed = new Promise(res => m2.on('close', res))
  host.send(JSON.stringify({ type: 'revokeMobile', mobileId: M2 }))
  const revokeOk = await nextMsg(host, m => m.type === 'revokeOk')
  ok(revokeOk.mobileId === M2, 'host 收到 revokeOk')
  await sleep(400)
  ok(revoked?.hostDeviceId === HOST, 'M2 收到 revoked{hostDeviceId}')
  await closed
  ok(true, 'M2 连接被服务器关闭')

  console.log('\n[8] M2 重连后无码 join 再次被拒（授权确已吊销）')
  const m2b = await wsConnect()
  m2b.send(JSON.stringify({ type: 'join', hostDeviceId: HOST, mobileId: M2, pairCode: '', content: '' }))
  const join4 = await nextMsg(m2b, m => m.type === 'error')
  ok(join4.needPair === true, '吊销后 M2 无码被拒')
  m2b.close()

  console.log('\n[9] 模拟服务器重启（Render 休眠清空内存）')
  host.close(); m1.close()
  await sleep(300)
  server.stop()
  await sleep(300)
  r = await server.start(PORT)
  ok(r.ok, 'relay 重新 start')

  const host2 = await wsConnect()
  host2.send(JSON.stringify({
    type: 'register', deviceId: HOST, name: '测试教室',
    // PC 本地文件里仍有 M1（M2 已被移除）
    authorizedMobiles: [{ mobileId: M1, sender: '小明', joinedAt: Date.now() }]
  }))
  await nextMsg(host2, m => m.type === 'registered')
  const m1b = await wsConnect()
  m1b.send(JSON.stringify({ type: 'join', hostDeviceId: HOST, mobileId: M1, sender: '小明', pairCode: '', content: '' }))
  const join5 = await nextMsg(m1b, m => m.type === 'joinOk' || m.type === 'error')
  ok(join5.type === 'joinOk', '重启后 M1 仍然无码直连（核心诉求）')

  const m2c = await wsConnect()
  m2c.send(JSON.stringify({ type: 'join', hostDeviceId: HOST, mobileId: M2, pairCode: '', content: '' }))
  const join6 = await nextMsg(m2c, m => m.type === 'error')
  ok(join6.needPair === true, '重启后 M2 依旧需要重新配对')
  m2c.close(); m1b.close(); host2.close()

  console.log('\n[10] HTTP 接口')
  const health = await httpGet('/health')
  ok(health.status === 200 && /"ok":true/.test(health.body), 'GET /health 200')
  const page = await httpGet('/m')
  ok(page.status === 200 && /<!DOCTYPE/i.test(page.body), 'GET /m 返回手机页 HTML')

  server.stop()

  console.log('\n[11] relay-client 冷启动自动重连（先关服连接，再开服）')
  const client = new RelayClient()
  let registeredEvt = null
  client.on('registered', (info) => { registeredEvt = info })
  const cold = await client.connect(URL, '冷启动教室', [{ mobileId: M1 }])
  ok(cold.ok === false, '服务不可用时 connect 返回失败但不放弃')
  const server2 = createRelayServer({ resolveMobileHtml: () => mobileHtmlPath, log: () => {} })
  await server2.start(PORT)
  // 退避 1s 起步；等待自动重连注册
  await sleep(3500)
  ok(registeredEvt?.deviceId && registeredEvt.pairCode, '服务恢复后自动重连并 registered')
  ok(client.getStatus().connected === true, 'client.getStatus().connected=true')
  // 上报的授权名单生效验证：M1 无码
  const m1c = await wsConnect()
  m1c.send(JSON.stringify({ type: 'join', hostDeviceId: client.deviceId, mobileId: M1, pairCode: '', content: '' }))
  const join7 = await nextMsg(m1c, m => m.type === 'joinOk' || m.type === 'error')
  ok(join7.type === 'joinOk', '重连后 register 上报的名单生效，M1 无码通过')
  m1c.close()
  client.disconnect()
  await sleep(200)
  server2.stop()

  console.log(`\n========================================`)
  console.log(`通过 ${passed} / 失败 ${failed}`)
  process.exit(failed ? 1 : 0)
}

main().catch(e => { console.error('\n💥 测试异常:', e); process.exit(1) })
