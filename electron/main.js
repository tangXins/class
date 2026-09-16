const { app, BrowserWindow, ipcMain, Menu, shell, dialog, Tray, nativeImage, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')

// ========== 单实例锁：第二次双击直接聚焦现有窗口，不再开新窗口 ==========
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  console.log('[SingleInstance] 已在运行，退出本次启动')
  app.quit()
  return
}
// 收到第二次启动请求 → 从托盘拉回主窗口
app.on('second-instance', () => {
  showMainWindow()
})

// ========== 便携模式 → 把 userData 重定向到 exe 旁边 ==========
// 两种形态都算便携：
//  1) electron-builder 单文件便携版：自带 PORTABLE_EXECUTABLE_DIR 环境变量
//  2) 绿色解压版：exe 同目录放一个 .portable 标记文件
let portableDataDir = null
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  portableDataDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, '班级管理大师-数据')
} else {
  try {
    const marker = path.join(path.dirname(app.getPath('exe')), '.portable')
    if (fs.existsSync(marker)) {
      portableDataDir = path.join(path.dirname(app.getPath('exe')), '班级管理大师-数据')
    }
  } catch { /* app.getPath('exe') 异常时按普通安装处理 */ }
}
const isPortable = !!portableDataDir
if (isPortable) {
  try {
    if (!fs.existsSync(portableDataDir)) fs.mkdirSync(portableDataDir, { recursive: true })
    app.setPath('userData', portableDataDir)
    app.setPath('appData', portableDataDir)
    console.log('[Portable] 数据目录:', portableDataDir)
  } catch (e) {
    console.warn('[Portable] 设置便携目录失败:', e.message)
  }
}

// ========== 应用图标（256×256 蓝青色渐变 + 白色符号）============
// base64 内嵌，避免 Electron asar 打包后路径混乱
const ICON_DATA_URL = "data:image/png;base64,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"
const startMinimized = process.argv.includes('--minimized')
const userDataDir = app.getPath('userData')
const dbPath = path.join(userDataDir, 'classmanager.db')
const configPath = path.join(userDataDir, 'app-config.json')
const settingsPath = path.join(userDataDir, 'settings.json')
// 已配对手机授权名单（跨网络免码的数据源，服务器不持久化，全靠这个文件）
const pairedPath = path.join(userDataDir, 'paired-mobiles.json')
// PC 发给离线手机的待送达通知（手机下次上线自动补收）
const pendingPath = path.join(userDataDir, 'pending-notifications.json')

// ========== 全局单例 ==========
let mainWindow = null
let db = null
let tts = null
let relayClient = null
let tray = null
// 标记"显式退出"：只有托盘点「退出软件」或 before-quit 时才置 true，
// 用来区分"用户点 X 关闭窗口"（hide）和"真的要退出进程"（quit）
app.isQuiting = false

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
  relayUrl: 'wss://classmanager-relay.onrender.com',
  relayMode: 'public',
  publicRelayUrl: 'wss://classmanager-relay.onrender.com',
  autoStartRelay: true,
  theme: 'system',
  // 更新检查：GitHub 仓库（owner/repo）与启动时自动检查
  updateRepo: '',
  checkUpdateOnStart: true,
  // 点击关闭按钮（X）的行为：true=最小化到系统托盘（默认，像微信/QQ）；false=真正退出
  closeToTray: true
}

// ========== 已配对手机授权名单（本地持久化，register 时全量上报） ==========
let pairedMobiles = []   // [{mobileId, sender, joinedAt}]
// 手机实时在线状态：mobileId -> 'active' | 'standby' | 'offline'
const mobileStates = new Map()
// 待送达通知：[{mobileId, title, body, at}]
let pendingNotifications = []

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

function loadPending() {
  try {
    if (fs.existsSync(pendingPath)) {
      const data = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'))
      pendingNotifications = Array.isArray(data?.items) ? data.items : []
    }
  } catch { pendingNotifications = [] }
}
function savePending() {
  try { fs.writeFileSync(pendingPath, JSON.stringify({ items: pendingNotifications }, null, 2)) } catch {}
}
/** 给离线手机存一条待送达：每台最多 20 条，只保留 7 天 */
function queuePending(mobileId, title, body) {
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000
  pendingNotifications = pendingNotifications.filter(n => n.at > cutoff)
  pendingNotifications.push({ mobileId, title, body, at: Date.now() })
  const mine = pendingNotifications.filter(n => n.mobileId === mobileId)
  if (mine.length > 20) {
    const keepIds = new Set(mine.slice(-20).map(n => n.at))
    pendingNotifications = pendingNotifications.filter(n => n.mobileId !== mobileId || keepIds.has(n.at))
  }
  savePending()
}
/** 手机上线 → 自动补收待送达通知 */
function flushPending(mobileId) {
  const items = pendingNotifications.filter(n => n.mobileId === mobileId)
  if (!items.length) return
  for (const n of items) relayClient?.notifyMobile(n.mobileId, n.title, n.body)
  pendingNotifications = pendingNotifications.filter(n => n.mobileId !== mobileId)
  savePending()
}

function pushPairedList() {
  safeSend('relay:pairedList', pairedMobiles.map(m => ({
    ...m,
    state: mobileStates.get(m.mobileId) || 'offline'
  })))
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
// 轻量同步加载：窗口创建前必须完成（毫秒级）
function loadQuick() {
  loadConfig()
  loadPaired()
  loadPending()
}

// 重型异步加载：窗口已显示后在后台执行（sql.js / db.init / TTS / RelayClient）
async function loadHeavy() {
  try {
    // 数据库（最慢，放最前尽快完成）
    const Database = require('./db/database')
    db = new Database(dbPath)
    await db.init()
    // db 就绪后注册 db-handlers IPC
    const dbHandlers = require('./ipc/db-handlers')
    dbHandlers.register(ipcMain, db)

    // TTS
    try {
      const TtsManager = require('./server/tts')
      tts = new TtsManager()
    } catch (e) {
      console.warn('TTS 加载失败:', e.message)
    }

    // Relay Client（云端连接）+ 所有事件监听
    const RelayClient = require('./server/relay-client')
    relayClient = new RelayClient()
    registerRelayIpc()

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
  // 手机上线（进入教室 active / App 后台待命 standby）
  relayClient.on('mobileOnline', ({ mobileId, sender, state }) => {
    mobileStates.set(mobileId, state)
    safeSend('relay:mobileOnline', { mobileId, sender, state })
    pushPairedList()
    flushPending(mobileId)   // 自动补收待送达通知
  })
  // 手机下线
  relayClient.on('mobileOffline', (mobileId) => {
    mobileStates.set(mobileId, 'offline')
    safeSend('relay:mobileOffline', mobileId)
    pushPairedList()
  })
  // 通知送达结果（服务器权威回执）
  relayClient.on('notifyResult', (r) => {
    if (r.mobileId && r.state) mobileStates.set(r.mobileId, r.state)
    safeSend('relay:notifyResult', r)
  })
  // 新手机用配对码完成首次配对 → 落盘授权名单（跨服务器重启/跨网络免码的关键）
  relayClient.on('mobilePaired', (mobile) => {
    if (!mobile || !mobile.mobileId) return
    // persist===false 表示浏览器临时进入，绝不落盘（旧中继无此字段时按已授权处理）
    if (mobile.persist === false) {
      safeSend('relay:pairedMobile', mobile)
      pushPairedList()
      return
    }
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
  relayClient.on('pairedList', (mobiles) => {
    if (Array.isArray(mobiles)) {
      for (const m of mobiles) if (m.state) mobileStates.set(m.mobileId, m.state)
    }
    pushPairedList()
  })
  relayClient.on('revokeOk', () => pushPairedList())

  // ========== 手机端数据请求（班级管理 CRUD / 教材目录 / 应用信息）==========
  // 白名单映射：method -> 对应 db 实例方法名（值为空则同名）
  const MOBILE_DB_METHODS = {
    getGrades: 'getGrades', addGrade: 'addGrade', updateGrade: 'updateGrade', deleteGrade: 'deleteGrade',
    getClasses: 'getClasses', getAllClasses: 'getClasses', addClass: 'addClass', updateClass: 'updateClass', deleteClass: 'deleteClass',
    getStudents: 'getStudents', addStudent: 'addStudent', updateStudent: 'updateStudent',
    updateStudentWeight: 'updateStudentWeight', deleteStudent: 'deleteStudent',
    getSubjects: 'getSubjects', addSubject: 'addSubject', updateSubject: 'updateSubject', deleteSubject: 'deleteSubject',
    getQuestions: 'getQuestions', getUnits: 'getUnits',
    addQuestion: 'addQuestion', updateQuestion: 'updateQuestion', deleteQuestion: 'deleteQuestion',
    tickCooldowns: 'tickCooldowns'
  }

  function readCatalogJson() {
    try {
      const p = path.join(__dirname, 'templates', 'catalog.json')
      if (!fs.existsSync(p)) return null
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch { return null }
  }

  relayClient.on('call', async ({ reqId, mobileId, method, params }) => {
    const reply = (ok, data, error) => relayClient.callResult({ mobileId, reqId, ok, data, error })
    try {
      if (method === 'catalog') {
        return reply(true, readCatalogJson())
      }
      if (method === 'appInfo') {
        return reply(true, {
          version: app.getVersion(),
          className: appConfig.className,
          updateRepo: appConfig.updateRepo || '',
          deviceId: relayClient.deviceId
        })
      }
      const dbMethod = MOBILE_DB_METHODS[method]
      if (!dbMethod || typeof db?.[dbMethod] !== 'function') {
        return reply(false, null, '不支持的操作: ' + method)
      }
      const args = Array.isArray(params) ? params : []
      const data = await db[dbMethod](...args)
      // 写操作：广播给教室内手机 + 通知渲染进程刷新
      if (!/^get|^tick/.test(method)) {
        try { relayClient.dataBroadcast({ kind: 'dataChanged', method, ts: Date.now() }) } catch {}
        safeSend('relay:dataChanged', { method })
      }
      reply(true, data)
    } catch (e) {
      reply(false, null, e?.message || '操作失败')
    }
  })

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

    // 全部重型模块就绪 → 通知渲染进程刷新数据
    safeSend('app:ready')
    console.log('[Boot] 重型模块全部就绪')
  } catch (e) {
    console.error('[Boot] 重型模块加载失败:', e)
    safeSend('app:error', { message: e.message })
  }
}

// ========== 系统托盘（右下角，微信/QQ 那个区域） ==========
function createTray() {
  if (tray) return tray

  // 用内嵌 base64 图标（最稳，避开 asar 路径问题）
  const trayIcon = nativeImage.createFromDataURL(ICON_DATA_URL)

  tray = new Tray(trayIcon)
  tray.setToolTip('班级管理大师')

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '退出软件', role: 'quit' }
  ])
  tray.setContextMenu(contextMenu)

  // 左键单击 → 显示/隐藏窗口
  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      showMainWindow()
    }
  })

  return tray
}

/** 把隐藏/最小化的主窗口恢复到前台 */
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// ========== 窗口 ==========
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 640,
    title: '班级管理大师',
    backgroundColor: '#0d0d18',
    show: !startMinimized,
    icon: nativeImage.createFromDataURL(ICON_DATA_URL),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })

  Menu.setApplicationMenu(null)

  // 自启场景：窗口就绪后直接隐藏到**系统托盘**（不是任务栏按钮）
  if (startMinimized) {
    mainWindow.once('ready-to-show', () => {
      try { mainWindow.hide() } catch {}
    })
  }

  const devUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : path.join(__dirname, '..', 'dist', 'index.html')

  mainWindow.loadURL(devUrl.startsWith('http') ? devUrl : `file://${devUrl}`)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  // ====== 关闭事件：默认 hide 到托盘，只有用户显式退出才真 quit ======
  mainWindow.on('close', (e) => {
    // isQuiting=true 表示是退出流程（托盘退出菜单 / 任务栏关 / app.quit()），
    // 跳过 hide，让它真关掉。
    if (app.isQuiting) return
    // 用户设置了"关闭按钮最小化到托盘"
    if (appConfig.closeToTray) {
      e.preventDefault()
      mainWindow.hide()
    }
    // 否则什么也不做，让 Electron 正常关闭（窗口消失 → 后面 window-all-closed 也不会 quit，因为托盘还活着）
  })

  // ====== 全局快捷键：Ctrl/Cmd + Shift + I → 打开/关闭 DevTools ======
  // （用户要方便调试，不只是 dev 模式下可用）
  try {
    const ok = globalShortcut.register('CommandOrControl+Shift+I', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
      }
    })
    if (!ok) console.warn('[shortcut] Ctrl+Shift+I 快捷键注册失败（可能被其他软件占用）')
  } catch (e) {
    console.warn('[shortcut] 快捷键注册失败:', e.message)
  }

  // ====== 首次窗口创建时创建托盘 ======
  createTray()
}

// ========== IPC 路由 ==========
function setupIpc() {
  // TTS（tts 可能还没 init，用可选链兜底）
  ipcMain.handle('tts:speak', (_e, text) => tts?.speak(text))
  ipcMain.handle('tts:listVoices', () => tts?.listVoices() || [])

  // 开机自启
  ipcMain.handle('autoLaunch:set', (_e, enable) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      args: enable ? ['--minimized'] : []
    })
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

  // ============ 本机局域网 IP ============
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

  // ============ 检查更新（GitHub Releases，无第三方依赖） ============
  const versionParts = v => String(v || '').replace(/^[vV]/, '').split('.').map(n => parseInt(n, 10) || 0)
  function isNewerVersion(latest, current) {
    const a = versionParts(latest), b = versionParts(current)
    for (let i = 0; i < 3; i++) {
      if ((a[i] || 0) > (b[i] || 0)) return true
      if ((a[i] || 0) < (b[i] || 0)) return false
    }
    return false
  }
  async function fetchLatestRelease(repo) {
    const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'class-manager-app' }
    })
    if (!r.ok) throw new Error(`GitHub 返回 ${r.status}`)
    return r.json()
  }
  function pickReleaseAssets(rel) {
    let exeUrl = '', apkUrl = ''
    for (const a of rel.assets || []) {
      const n = String(a.name || '').toLowerCase()
      if (n.endsWith('.apk')) apkUrl = a.browser_download_url
      if (n.endsWith('.exe') && (!exeUrl || n.includes('setup') || n.includes('安装'))) exeUrl = a.browser_download_url
    }
    return { exeUrl, apkUrl }
  }
  async function checkAppUpdate() {
    const repo = String(appConfig.updateRepo || '').trim()
    if (!repo) return { ok: false, error: '未配置更新仓库（owner/repo）' }
    const rel = await fetchLatestRelease(repo)
    const assets = pickReleaseAssets(rel)
    return {
      ok: true,
      hasUpdate: isNewerVersion(rel.tag_name || rel.name || '', app.getVersion()),
      current: app.getVersion(),
      latest: String(rel.tag_name || '').replace(/^v/, ''),
      notes: rel.body || '',
      releaseUrl: rel.html_url || '',
      ...assets
    }
  }
  ipcMain.handle('updater:check', async () => {
    try { return await checkAppUpdate() } catch (e) { return { ok: false, error: e.message } }
  })
  ipcMain.handle('updater:download', async (_e, url) => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('下载失败 HTTP ' + res.status)
      const total = Number(res.headers.get('content-length') || 0)
      const rawName = decodeURIComponent(String(url).split('?')[0].split('/').pop())
      const dest = path.join(app.getPath('downloads'), rawName || '班级管理大师-更新.exe')
      const ws = fs.createWriteStream(dest)
      const reader = res.body.getReader()
      let received = 0, lastEmit = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        ws.write(Buffer.from(value))
        received += value.length
        const now = Date.now()
        if (total && now - lastEmit > 250) {
          lastEmit = now
          safeSend('updater:progress', { percent: Math.round(received / total * 100), received, total })
        }
      }
      await new Promise((res2, rej) => ws.end(err => err ? rej(err) : res2()))
      safeSend('updater:progress', { percent: 100, received, total })
      return { ok: true, path: dest }
    } catch (e) { return { ok: false, error: e.message } }
  })
  ipcMain.handle('updater:install', (_e, filePath) => {
    shell.openPath(filePath)
    setTimeout(() => app.quit(), 600)
    return { ok: true }
  })
  ipcMain.handle('updater:openExternal', (_e, url) => { shell.openExternal(url); return { ok: true } })

  // 启动 15 秒后静默检查一次
  if (appConfig.checkUpdateOnStart !== false && appConfig.updateRepo) {
    setTimeout(async () => {
      try {
        const info = await checkAppUpdate()
        if (info.ok && info.hasUpdate) safeSend('updater:available', info)
      } catch { /* 静默失败 */ }
    }, 15000)
  }
}

// ========== 数据库 IPC（db init 完成后注册） ==========
function registerDbIpc() {
  const dbHandlers = require('./ipc/db-handlers')
  dbHandlers.register(ipcMain, db)
}

// ========== Relay IPC（relayClient new 完后注册） ==========
function registerRelayIpc() {
  ipcMain.handle('relay:start', async (_e, relayUrl, name) => {
    try {
      if (name) appConfig.className = name
      const url = relayUrl || effectiveRelayUrl()
      appConfig.relayUrl = url
      saveConfig()
      const ok = await ensureLocalRelayStarted(url)
      if (!ok) return { ok: false, error: '本地局域网 Relay 启动失败（端口 9000 被占用？）' }
      return await relayClient.connect(url, appConfig.className, pairedMobiles)
    } catch (e) {
      console.error('[relay:start] error:', e.message)
      return { ok: false, error: e.message || '启动失败' }
    }
  })
  ipcMain.handle('relay:stop', () => { relayClient.disconnect(); return { ok: true } })
  ipcMain.handle('relay:status', () => relayClient.getStatus())
  ipcMain.handle('relay:refreshCode', () => { relayClient.refreshCode(); return { ok: true } })
  ipcMain.handle('relay:listPaired', () => { pushPairedList(); return { ok: true } })
  ipcMain.handle('relay:removePaired', (_e, mobileId) => {
    if (!mobileId) return { ok: false }
    pairedMobiles = pairedMobiles.filter(m => m.mobileId !== mobileId)
    savePaired()
    mobileStates.delete(mobileId)
    relayClient.setAuthorizedMobiles(pairedMobiles)
    relayClient.revokeMobile(mobileId)
    pushPairedList()
    return { ok: true }
  })

  // ============ PC → 已配对手机发消息/连接请求 ============
  ipcMain.handle('notify:send', (_e, { mobileId, title, body }) => {
    if (!mobileId || !pairedMobiles.find(m => m.mobileId === mobileId)) {
      return { ok: false, error: '未找到该配对设备' }
    }
    const state = mobileStates.get(mobileId) || 'offline'
    if (state === 'offline' || !relayClient?.connected) {
      queuePending(mobileId, title || '连接请求', body || '')
      return { ok: true, delivered: false, pending: true }
    }
    relayClient.notifyMobile(mobileId, title || '连接请求', body || '')
    return { ok: true, delivered: true, state }
  })
}

app.whenReady().then(() => {
  // 1. 轻量同步加载配置（毫秒级，窗口前必须）
  loadQuick()

  // 2. 立刻创建窗口 + 托盘 + 轻量 IPC —— 用户先看到东西！
  createWindow()
  createTray()
  setupIpc()

  // 3. 重型模块放后台异步跑（sql.js/db.init/TTS/RelayClient）
  //    完成后 safeSend('app:ready') 通知渲染进程刷新数据
  loadHeavy()

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      showMainWindow()
    } else {
      createWindow()
    }
  })
})

// 所有窗口关闭后，**不自动退出**——托盘还活着。
// 只有显式退出（托盘点「退出软件」/app.quit()）时才真 quit。
app.on('window-all-closed', () => {
  // 兜底：如果没有托盘（极少数平台），还是退出
  if (!tray && process.platform !== 'darwin') {
    relayClient?.disconnect()
    app.quit()
  }
})

// 显式退出流程：先标记 isQuiting，让后续 close 事件不再拦截
app.on('before-quit', () => {
  app.isQuiting = true
  try { globalShortcut.unregisterAll() } catch {}
  killRelayServer()
  db?.close()
})
