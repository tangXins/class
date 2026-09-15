const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// ========== 关键：单 exe 模式 → 把 userData 重定向到 exe 旁边 ==========
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR
if (isPortable) {
  const portableDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, '班级管理大师-数据')
  try {
    if (!fs.existsSync(portableDir)) fs.mkdirSync(portableDir, { recursive: true })
    app.setPath('userData', portableDir)
    app.setPath('appData', portableDir)
    console.log('[Portable] 数据目录:', portableDir)
  } catch (e) {
    console.warn('[Portable] 设置便携目录失败:', e.message)
  }
}

// ========== 路径 ==========
const userDataDir = app.getPath('userData')
const dbPath = path.join(userDataDir, 'classmanager.db')
const configPath = path.join(userDataDir, 'app-config.json')
const settingsPath = path.join(userDataDir, 'settings.json')
// 已配对手机授权名单（跨网络免码的数据源，服务器不持久化，全靠这个文件）
const pairedPath = path.join(userDataDir, 'paired-mobiles.json')

// ========== 全局单例 ==========
let mainWindow = null
let db = null
let tts = null
let relayClient = null

// ========== 本地 Relay（主进程内 HTTP + WebSocket 服务）==========
const localRelay = require('./server/local-relay')
function isLocalRelayUrl(url) {
  if (!url) return false
  try {
    const h = new URL(url).hostname.toLowerCase()
    return h === 'localhost' || h === '127.0.0.1'
  } catch { return false }
}
function ensureLocalRelayStarted(relayUrl) {
  if (!isLocalRelayUrl(relayUrl)) return Promise.resolve(true)
  // 端口固定 9000
  const portMatch = /:(\d+)/.exec(relayUrl)
  const port = portMatch ? Number(portMatch[1]) : 9000
  return localRelay.startRelay(port).then(r => r.ok)
}
function killRelayServer() { localRelay.stopRelay() }

// ========== 安全发送：防止 BrowserWindow 销毁后回调崩主进程 ==========
function safeSend(channel, data) {
  try {
    if (!mainWindow) return
    if (mainWindow.isDestroyed?.()) return
    if (!mainWindow.webContents || mainWindow.webContents.isDestroyed?.()) return
    mainWindow.webContents.send(channel, data)
  } catch { /* ignore */ }
}

// ========== 应用配置（持久化） ==========
let appConfig = {
  className: '未命名教室',
  relayUrl: 'ws://localhost:9000',
  relayMode: 'lan',        // 'lan' 局域网（同 WiFi） | 'public' 公网（任意网络）
  publicRelayUrl: '',      // 公网模式地址，如 wss://classmanager-relay.onrender.com
  autoStartRelay: true,
  theme: 'system'   // 'dark' | 'light' | 'system'
}

// ========== 已配对手机授权名单（本地持久化，register 时全量上报） ==========
let pairedMobiles = []   // [{mobileId, sender, joinedAt}]

function loadPaired() {
  try {
    if (fs.existsSync(pairedPath)) {
      const data = JSON.parse(fs.readFileSync(pairedPath, 'utf-8'))
      pairedMobiles = Array.isArray(data?.mobiles) ? data.mobiles : []
    }
  } catch { pairedMobiles = [] }
}
function savePaired() {
  try { fs.writeFileSync(pairedPath, JSON.stringify({ mobiles: pairedMobiles }, null, 2)) } catch {}
}
function pushPairedList() {
  safeSend('relay:pairedList', pairedMobiles)
}

/** 当前模式下实际使用的 Relay 地址 */
function effectiveRelayUrl() {
  if (appConfig.relayMode === 'public' && appConfig.publicRelayUrl) return appConfig.publicRelayUrl
  return 'ws://localhost:9000'
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      appConfig = { ...appConfig, ...saved }
      // 迁移：旧开发机局域网地址 → 本机 relay
      if (appConfig.relayUrl === 'ws://192.168.1.5:9000') {
        appConfig.relayUrl = 'ws://localhost:9000'
      }
      // 兼容旧版：把用户手动填的公网地址收进 publicRelayUrl
      if (!appConfig.publicRelayUrl && appConfig.relayUrl &&
          !/localhost|127\.0\.0\.1|192\.168\./.test(appConfig.relayUrl)) {
        appConfig.publicRelayUrl = appConfig.relayUrl
        appConfig.relayMode = 'public'
      }
      appConfig.relayUrl = effectiveRelayUrl()
      saveConfig()
    }
  } catch (e) { /* 使用默认 */ }
}
function saveConfig() {
  try { fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2)) } catch (e) {}
}

// ========== 模块加载 ==========
async function loadModules() {
  loadConfig()
  loadPaired()

  // 数据库
  const Database = require('./db/database')
  db = new Database(dbPath)
  await db.init()

  // TTS
  try {
    const TtsManager = require('./server/tts')
    tts = new TtsManager()
  } catch (e) {
    console.warn('TTS 加载失败:', e.message)
  }

  // Relay Client（云端连接）
  const RelayClient = require('./server/relay-client')
  relayClient = new RelayClient()

  relayClient.on('message', (data) => {
    // 手机发来的消息 → 广播给渲染进程
    safeSend('relay:message', data)
    tts?.speak(data.content || '')

    // 强制把窗口拉到前台 + 临时置顶（不管最小化/在后台/被遮挡）
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.setAlwaysOnTop(true, 'screen-saver')  // 临时置顶（'screen-saver' = 最顶级）
        mainWindow.show()
        mainWindow.focus()
        mainWindow.flashFrame(true)
        // 3.5 秒后取消临时置顶（大字弹窗显示期间保持置顶）
        setTimeout(() => {
          try {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setAlwaysOnTop(false)
              mainWindow.flashFrame(false)
            }
          } catch {}
        }, 3500)
      }
    } catch {}

    // 系统气泡通知（应用外也能看到）
    try {
      if (Notification.isSupported() && mainWindow && !mainWindow.isDestroyed()) {
        const notif = new Notification({
          title: '📱 来自 ' + (data.sender || '手机') + ' 的消息',
          body: (data.content || '').substring(0, 120),
          silent: false
        })
        notif.on('click', () => {
          try {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore()
              mainWindow.show(); mainWindow.focus()
            }
          } catch {}
        })
      }
    } catch (e) { console.warn('通知失败:', e.message) }
  })
  relayClient.on('connected', () => safeSend('relay:connected'))
  relayClient.on('disconnected', () => safeSend('relay:disconnected'))
  relayClient.on('registered', (info) => safeSend('relay:registered', info))
  relayClient.on('pairCode', (code) => safeSend('relay:pairCode', code))
  relayClient.on('error', (msg) => safeSend('relay:error', msg))
  relayClient.on('serverError', (msg) => safeSend('relay:serverError', msg))
  relayClient.on('reconnectFailed', () => safeSend('relay:reconnectFailed'))
  // 新手机用配对码完成首次配对 → 落盘授权名单（跨服务器重启/跨网络免码的关键）
  relayClient.on('mobilePaired', (mobile) => {
    if (!mobile || !mobile.mobileId) return
    if (!pairedMobiles.find(m => m.mobileId === mobile.mobileId)) {
      pairedMobiles.push({
        mobileId: mobile.mobileId,
        sender: mobile.sender || '手机',
        joinedAt: mobile.joinedAt || Date.now()
      })
      savePaired()
    }
    safeSend('relay:pairedMobile', mobile)
    pushPairedList()
  })
  // 手机端主动取消配对
  relayClient.on('mobileUnpaired', (mobileId) => {
    pairedMobiles = pairedMobiles.filter(m => m.mobileId !== mobileId)
    savePaired()
    safeSend('relay:unpairedMobile', mobileId)
    pushPairedList()
  })
  relayClient.on('pairedList', () => pushPairedList())
  relayClient.on('revokeOk', () => pushPairedList())

  // 自动连接 Relay
  if (appConfig.autoStartRelay) {
    const url = effectiveRelayUrl()
    if (url) {
      setTimeout(async () => {
        await ensureLocalRelayStarted(url)
        relayClient.connect(url, appConfig.className, pairedMobiles)
          .then(r => console.log(r.ok ? '[Relay] 已连接' : '[Relay] 连接中（自动重试）:', r.error || ''))
      }, 500)
    }
  }
}

// ========== 窗口 ==========
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 640,
    title: '班级管理大师',
    backgroundColor: '#0d0d18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })

  Menu.setApplicationMenu(null)

  const devUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : path.join(__dirname, '..', 'dist', 'index.html')

  mainWindow.loadURL(devUrl.startsWith('http') ? devUrl : `file://${devUrl}`)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }
}

// ========== IPC 路由 ==========
function setupIpc() {
  // 数据库
  const dbHandlers = require('./ipc/db-handlers')
  dbHandlers.register(ipcMain, db)

  // TTS
  ipcMain.handle('tts:speak', (_e, text) => tts?.speak(text))
  ipcMain.handle('tts:listVoices', () => tts?.listVoices() || [])

  // 开机自启
  ipcMain.handle('autoLaunch:set', (_e, enable) => {
    app.setLoginItemSettings({ openAtLogin: enable })
    return true
  })
  ipcMain.handle('autoLaunch:get', () => app.getLoginItemSettings().openAtLogin)

  // ============ 应用配置 ============
  ipcMain.handle('config:get', () => ({
    ...appConfig,
    deviceId: relayClient?.deviceId || ''
  }))
  ipcMain.handle('config:set', (_e, newCfg) => {
    Object.assign(appConfig, newCfg || {})
    appConfig.relayUrl = effectiveRelayUrl()
    saveConfig()
    return { ok: true }
  })

  // ============ Relay ============
  ipcMain.handle('relay:start', async (_e, relayUrl, name) => {
    if (name) appConfig.className = name
    const url = relayUrl || effectiveRelayUrl()
    appConfig.relayUrl = url
    saveConfig()
    // 局域网地址 → 先确保内置 Relay 已启动；公网地址不需要
    await ensureLocalRelayStarted(url)
    return await relayClient.connect(url, appConfig.className, pairedMobiles)
  })
  ipcMain.handle('relay:stop', () => { relayClient.disconnect(); return { ok: true } })
  ipcMain.handle('relay:status', () => relayClient.getStatus())
  ipcMain.handle('relay:refreshCode', () => { relayClient.refreshCode(); return { ok: true } })
  // 授权名单以 PC 本地文件为准
  ipcMain.handle('relay:listPaired', () => { pushPairedList(); return { ok: true } })
  ipcMain.handle('relay:removePaired', (_e, mobileId) => {
    if (!mobileId) return { ok: false }
    pairedMobiles = pairedMobiles.filter(m => m.mobileId !== mobileId)
    savePaired()
    relayClient.setAuthorizedMobiles(pairedMobiles)
    relayClient.revokeMobile(mobileId)   // 通知服务器立即踢人
    pushPairedList()
    return { ok: true }
  })

  // ============ 本机局域网 IP（供手机扫码二维码使用） ============
  ipcMain.handle('net:lan-ip', () => {
    try {
      const nets = require('os').networkInterfaces()
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) return net.address
        }
      }
    } catch (e) { /* ignore */ }
    return ''
  })

  // ============ 设置面板 ============
  ipcMain.handle('settings:info', () => {
    const stat = fs.statSync(userDataDir)
    const size = fs.readdirSync(userDataDir).reduce((total, f) => {
      try { return total + fs.statSync(path.join(userDataDir, f)).size } catch { return total }
    }, 0)
    return {
      userDataPath: userDataDir,
      isPortable,
      dbExists: fs.existsSync(dbPath),
      createdAt: stat.birthtime?.toLocaleDateString() || '',
      sizeMB: (size / 1024 / 1024).toFixed(2)
    }
  })
  ipcMain.handle('settings:openDir', () => { shell.openPath(userDataDir); return { ok: true } })

  ipcMain.handle('settings:backup', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出备份',
      defaultPath: `班级管理大师-备份-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    try {
      const AdmZip = require('adm-zip')
      const zip = new AdmZip()
      zip.addLocalFolder(userDataDir, '班级管理大师-数据')
      zip.writeZip(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('settings:restore', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '选择备份 ZIP',
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths.length) return { ok: false, canceled: true }
    try {
      const AdmZip = require('adm-zip')
      new AdmZip(filePaths[0]).extractAllTo(userDataDir, true)
      return { ok: true, msg: '已导入，建议重启' }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('settings:resetData', async () => {
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath)
        ['-wal', '-shm', '-journal'].forEach(suf => {
          const f = dbPath + suf
          if (fs.existsSync(f)) fs.unlinkSync(f)
        })
      }
      return { ok: true }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('settings:version', () => ({
    version: app.getVersion(),
    name: app.getName(),
    isPortable,
    platform: process.platform,
    arch: process.arch
  }))
}

app.whenReady().then(async () => {
  await loadModules()
  setupIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  relayClient?.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { killRelayServer(); db?.close() })
