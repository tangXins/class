/**
 * 班级管理大师 - 本地 Relay（PC 主进程内置，局域网模式）
 *
 * 协议逻辑全部在 ./relay-core.js，与公网部署版 relay/relay-server.js 共用。
 * 本文件只负责：定位 mobile/index.html + 启停单例。
 */

const path = require('path')
const fs = require('fs')
const { createRelayServer } = require('./relay-core')

// 定位 mobile/index.html（开发态 + 打包后 asar 内均可）
function resolveMobileHtml() {
  const candidates = [
    path.join(__dirname, '..', '..', 'mobile', 'index.html'),          // electron/server → 项目根 mobile
    path.join(process.resourcesPath || '', 'mobile', 'index.html'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'mobile', 'index.html'),
  ]
  for (const c of candidates) if (c && fs.existsSync(c)) return c
  return null
}

let instance = null

function startRelay(port = 9000) {
  if (!instance) {
    instance = createRelayServer({
      resolveMobileHtml,
      log: (...a) => console.log(...a)
    })
  }
  return instance.start(port)
}

function stopRelay() {
  if (!instance) return
  instance.stop()
  instance = null
}

module.exports = { startRelay, stopRelay }
