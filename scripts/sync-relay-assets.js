/**
 * 把 Electron 侧的共享资产同步到 relay/ 公网部署目录：
 *   electron/server/relay-core.js → relay/relay-core.js
 *   mobile/index.html             → relay/mobile.html
 *
 * Render 部署 Root Directory = relay/ 时，目录内必须自包含。
 * 打包前自动执行（build:win / build），也可手动：node scripts/sync-relay-assets.js
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const copies = [
  ['electron/server/relay-core.js', 'relay/relay-core.js'],
  ['mobile/index.html', 'relay/mobile.html']
]

for (const [from, to] of copies) {
  const src = path.join(root, from)
  const dst = path.join(root, to)
  if (!fs.existsSync(src)) {
    console.error(`[sync-relay] 源文件不存在: ${from}`)
    process.exit(1)
  }
  const content = fs.readFileSync(src)
  const old = fs.existsSync(dst) ? fs.readFileSync(dst) : null
  if (!old || !old.equals(content)) {
    fs.writeFileSync(dst, content)
    console.log(`[sync-relay] ${from} → ${to}`)
  } else {
    console.log(`[sync-relay] ${to} 已是最新`)
  }
}
