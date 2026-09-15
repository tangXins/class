/**
 * 班级管理大师 - 公网 Relay 服务器入口（Render / 任意 Node 主机）
 *
 * 协议逻辑：./relay-core.js（由 scripts/sync-relay-assets.js 从
 * electron/server/relay-core.js 同步，勿手改）
 *
 * 手机页面：./mobile.html（同一同步脚本从 mobile/index.html 复制）
 *
 * 本地运行：npm install && npm start
 */

const path = require('path')
const fs = require('fs')
const { createRelayServer } = require('./relay-core')

const PORT = process.env.PORT || 9000

// 部署目录自带 mobile.html；开发态兼容从项目根 relay/ 启动时读取 ../mobile
function resolveMobileHtml() {
  const candidates = [
    path.join(__dirname, 'mobile.html'),
    path.join(__dirname, '..', 'mobile', 'index.html')
  ]
  for (const c of candidates) if (fs.existsSync(c)) return c
  return null
}

createRelayServer({ resolveMobileHtml }).start(PORT)
