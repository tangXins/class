<template>
  <div class="app" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <!-- 折叠/展开按钮（贴右边缘） -->
      <button
        class="sidebar-toggle"
        :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="toggleSidebar"
      >{{ sidebarCollapsed ? '»' : '«' }}</button>

      <!-- Logo -->
      <div class="logo">
        <div class="logo-icon-wrap">
          <div class="logo-icon-ring"></div>
          <div class="logo-icon">🎓</div>
        </div>
        <div class="logo-title">班级管理大师</div>
        <div class="logo-sub">
          <span class="sub-letter" v-for="(ch, i) in 'Class Manager'" :key="i" :style="{ animationDelay: (i * 80) + 'ms' }">{{ ch === ' ' ? '\u00A0' : ch }}</span>
        </div>
      </div>
      <div class="divider"></div>

      <!-- 导航 -->
      <nav class="nav">
        <div
          v-for="item in navItems"
          :key="item.index"
          class="nav-item"
          :class="{ active: currentTab === item.index }"
          :title="item.text"
          @click="switchTab(item.index)"
        >
          <!-- 左侧渐变指示条（active 时显示） -->
          <span class="nav-indicator"></span>
          <span class="nav-icon-wrap">
            <span class="nav-icon">{{ item.icon }}</span>
          </span>
          <span class="nav-text">{{ item.text }}</span>
          <span v-if="item.badge" class="nav-badge">{{ item.badge > 99 ? '99+' : item.badge }}</span>
        </div>
      </nav>

      <div class="nav-spacer"></div>

      <!-- 手机连接入口（点击开大模态框） -->
      <div class="side-entry card" @click="openPhoneModal" title="手机连接">
        <span class="se-icon">📡</span>
        <span class="se-label">手机连接</span>
        <span class="se-status" :class="relayConnected ? 'online' : 'offline'">
          <span class="se-dot"></span><span class="se-status-text">{{ relayConnected ? '在线' : '离线' }}</span>
        </span>
        <span class="se-arrow">›</span>
      </div>

      <!-- 设置按钮（点击开模态框） -->
      <div class="settings-wrap">
        <div class="settings-btn card" @click="openSettings" title="设置">
          <span class="st-icon">⚙️</span>
          <span class="st-label">设置</span>
          <span class="st-arrow">›</span>
        </div>
      </div>
    </aside>

    <!-- ============ 手机连接模态框 ============ -->
    <transition name="modal">
      <div v-if="phoneModalOpen" class="modal-overlay" @click.self="phoneModalOpen = false">
        <div class="modal-card phone-modal">
          <div class="modal-top-bar"></div>
          <div class="modal-header">
            <h2>
              📡 手机连接
              <span class="net-status-pill phone-status-pill" :class="relayConnected ? 'online' : 'offline'">
                <span class="pill-dot"></span>
                {{ relayConnected ? '在线' : '离线' }}
              </span>
            </h2>
            <button class="modal-close" @click="phoneModalOpen = false">✕</button>
          </div>
          <div class="modal-body phone-body">
            <!-- 左：二维码 + 配对码 -->
            <div class="phone-qr-col">
              <div class="net-qr-wrap phone-qr-wrap" @click="qrZoomed = true" title="点击放大查看配对码">
                <canvas ref="qrCanvas" class="net-qr phone-qr"></canvas>
                <div v-if="!relayConnected" class="net-qr-placeholder">🔌<br>未连接</div>
                <!-- 配对成功 overlay -->
                <transition name="pair-anim">
                  <div v-if="pairSuccess" class="pair-success-overlay" @click.stop>
                    <div class="pair-success-check">✅</div>
                    <div class="pair-success-text">📱 {{ pairSuccessName }}</div>
                    <div class="pair-success-sub">配对成功</div>
                  </div>
                </transition>
                <div class="net-qr-hint" v-if="relayConnected && !pairSuccess">🔍 点击放大 · 查看配对码</div>
              </div>
              <div class="phone-pair-code" :class="{ active: relayConnected }">{{ displayCode }}</div>
              <div class="phone-qr-tip">🏫 {{ className }}</div>
              <div v-if="pairedMobiles.length" class="phone-paired">✅ 已配对 {{ pairedMobiles.length }} 台手机 · 管理在「设置」中</div>
            </div>

            <!-- 右：设置 -->
            <div class="phone-form">
              <!-- 教室名字 -->
              <div class="net-class-row">
                <span class="net-label">🏫 教室名字</span>
                <input class="net-class-input" v-model="className" @change="saveClass" placeholder="如：高一3班" />
              </div>

              <!-- 网络模式：局域网（同 WiFi） / 公网（任意网络） -->
              <div class="net-mode">
                <div class="net-mode-seg">
                  <button
                    class="net-mode-btn"
                    :class="{ active: netMode === 'lan' }"
                    @click="switchNetMode('lan')"
                  >🏠 同 WiFi</button>
                  <button
                    class="net-mode-btn"
                    :class="{ active: netMode === 'public' }"
                    @click="switchNetMode('public')"
                  >🌍 任意网络</button>
                </div>
                <div class="net-mode-hint">
                  <template v-if="netMode === 'lan'">手机与电脑连同一个 WiFi 即可，无需任何配置</template>
                  <template v-else>手机用流量 / 任意 WiFi 都能连；电脑与手机均访问同一个公网服务</template>
                </div>
                <div v-if="netMode === 'public'" class="net-public-row">
                  <input
                    type="text"
                    class="net-public-input"
                    v-model="publicRelayUrl"
                    placeholder="wss://your-app.onrender.com"
                    @change="savePublicRelay"
                  />
                  <button class="btn-mini" @click="savePublicRelay">保存</button>
                </div>
              </div>

              <!-- 连接按钮 -->
              <div class="net-actions">
                <button
                  class="btn-server"
                  :class="relayConnected ? 'btn-stop' : 'btn-primary'"
                  :disabled="relayConnecting"
                  @click="toggleRelay"
                >
                  <span v-if="relayConnecting">⏳ 连接中…</span>
                  <span v-else-if="!relayConnected">{{ netMode === 'public' ? '🌐 开启公网连接' : '📶 开启手机连接' }}</span>
                  <span v-else>⏹ 断开连接</span>
                </button>
              </div>

              <div v-if="relayConnecting && netMode === 'public'" class="net-warn">
                ☁️ 免费公网服务休眠后首次唤醒最长约 1 分钟，请耐心等待
              </div>
              <div v-if="relayConnectError" class="net-error">⚠️ {{ relayConnectError }}</div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ============ 设置模态框 ============ -->
    <transition name="modal">
      <div v-if="settingsOpen" class="modal-overlay" @click.self="settingsOpen = false">
        <div class="modal-card settings-modal">
          <div class="modal-top-bar"></div>
          <div class="modal-header">
            <h2>⚙️ 设置</h2>
            <button class="modal-close" @click="settingsOpen = false">✕</button>
          </div>
          <div class="modal-body">
            <!-- 开机自启 -->
            <div class="set-row">
              <label class="switch-row">
                <input type="checkbox" :checked="autoLaunch" @change="setAutoLaunch" />
                <span>开机自启动</span>
              </label>
              <div class="set-hint">勾选后启动时自动最小化到系统托盘</div>
            </div>

            <!-- 关闭按钮行为 -->
            <div class="set-row">
              <label class="switch-row">
                <input type="checkbox" :checked="closeToTray" @change="setCloseToTray" />
                <span>关闭窗口最小化到系统托盘（推荐）</span>
              </label>
              <div class="set-hint">关闭后软件继续在托盘运行，在托盘右键可退出；关掉本选项则点 X 会完全退出</div>
            </div>

            <!-- 外观主题：深色 / 浅色 / 跟随系统 -->
            <div class="set-row">
              <div class="set-label">外观主题</div>
              <div class="theme-group">
                <button
                  v-for="t in appearanceThemes" :key="t.key"
                  class="theme-btn"
                  :class="{ active: currentAppearanceTheme === t.key }"
                  @click="setAppearanceTheme(t.key)"
                >{{ t.icon }} {{ t.name }}</button>
              </div>
            </div>

            <!-- 数据目录信息 -->
            <div class="set-row">
              <div class="set-label">数据源目录</div>
              <div class="set-path" :title="settingsInfo.userDataPath">{{ settingsInfo.userDataPath || '加载中...' }}</div>
              <div class="set-meta">
                <span v-if="settingsInfo.isPortable" class="tag portable">🖥️ 便携模式</span>
                <span class="tag">{{ settingsInfo.sizeMB }} MB</span>
              </div>
            </div>

            <!-- 已配对手机管理 -->
            <div class="set-row">
              <div class="set-label">已配对手机</div>
              <div class="paired-box">
                <div v-if="!pairedMobiles.length" class="paired-empty">
                  <span class="paired-empty-icon">📱</span>
                  <span>暂无已配对设备</span>
                </div>
                <div v-else class="paired-list">
                  <div v-for="m in pairedMobiles" :key="m.mobileId" class="paired-item">
                    <div class="paired-info">
                      <span class="paired-name">{{ m.sender || '未命名设备' }}</span>
                      <span class="paired-meta">
                        <span class="paired-dot" :class="m.state || 'offline'"></span>
                        {{ stateLabel(m.state) }}
                        <span class="paired-sep">·</span>
                        <code>{{ (m.mobileId || '').slice(0, 8) }}</code>
                        <span v-if="m.joinedAt" class="paired-sep">·</span>
                        <span v-if="m.joinedAt">{{ formatPairedTime(m.joinedAt) }}</span>
                      </span>
                    </div>
                    <div class="paired-actions">
                      <button class="btn-mini paired-msg" @click="openNotify(m)">💬 发消息</button>
                      <button class="btn-mini danger paired-remove" @click="removePaired(m)">✕ 移除</button>
                    </div>
                    <!-- 内联发消息条 -->
                    <div v-if="notifyTargetId === m.mobileId" class="paired-notify-box">
                      <input
                        class="paired-notify-input"
                        v-model="notifyText"
                        placeholder="手机通知栏会弹出；手机不在线则下次打开 App 自动收到"
                        @keyup.enter="sendNotify(m)"
                      />
                      <button class="btn-mini" @click="sendNotify(m)">📨 发送</button>
                    </div>
                  </div>
                </div>
                <button class="btn-mini paired-refresh" @click="refreshPaired">🔄 刷新列表</button>
              </div>
            </div>

            <!-- 软件更新 -->
            <div class="set-row">
              <div class="set-label">软件更新</div>
              <input
                class="paired-notify-input"
                v-model="updateRepo"
                placeholder="GitHub 仓库地址（owner/repo），如：your-name/class-manager"
                @change="saveUpdateRepo"
              />
              <div class="set-btn-row" style="margin-top:8px">
                <button class="btn-mini" @click="saveUpdateRepo">💾 保存</button>
                <button class="btn-mini" :disabled="updateChecking" @click="checkUpdate">
                  {{ updateChecking ? '检查中…' : '🔄 检查更新' }}
                </button>
              </div>
              <label class="switch-row" style="margin-top:8px">
                <input type="checkbox" :checked="checkUpdateOnStart" @change="toggleAutoUpdate" />
                <span>启动时自动检查更新</span>
              </label>
              <div v-if="updateInfo" class="update-info">
                <template v-if="updateInfo.ok === false">⚠️ {{ updateInfo.error }}</template>
                <template v-else-if="updateInfo.hasUpdate">
                  <div class="update-new">🎉 发现新版本 v{{ updateInfo.latest }}（当前 v{{ updateInfo.current }}）</div>
                  <pre v-if="updateInfo.notes" class="update-notes">{{ updateInfo.notes }}</pre>
                  <div class="set-btn-row">
                    <button
                      v-if="updateInfo.exeUrl"
                      class="btn-mini primary"
                      :disabled="updateDownloading"
                      @click="downloadUpdate"
                    >{{ updateDownloading ? `下载中 ${updateProgress}%` : '⬇️ 下载并安装（Windows）' }}</button>
                    <button class="btn-mini" @click="openReleasePage">🌐 下载页面</button>
                  </div>
                  <div v-if="updateDownloading" class="progress-line"><i :style="{ width: updateProgress + '%' }"></i></div>
                </template>
                <template v-else>✅ 已是最新版本 v{{ updateInfo.current }}</template>
              </div>
            </div>

            <!-- 操作按钮组 -->
            <div class="set-btn-row">
              <button class="btn-mini" @click="openDataDir">📂 打开文件夹</button>
              <button class="btn-mini" @click="backupData">📦 导出备份</button>
              <button class="btn-mini" @click="restoreData">📥 导入备份</button>
              <button class="btn-mini danger" @click="resetData">🔄 重置数据</button>
            </div>

            <!-- 版本信息 -->
            <div class="set-version">
              <span>班级管理大师 v{{ versionInfo.version || '1.0.0' }}</span>
              <span class="sep">·</span>
              <span>{{ versionInfo.platform === 'win32' ? 'Windows' : versionInfo.platform }}</span>
              <span class="sep">·</span>
              <span>{{ versionInfo.arch }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- QR 放大预览模态框（全屏居中） -->
    <transition name="modal">
      <div v-if="qrZoomed" class="modal-overlay qr-fullscreen" @click.self="qrZoomed = false">
        <div class="modal-card qr-modal">
          <div class="modal-top-bar"></div>
          <div class="modal-header">
            <h2>📱 扫码连接</h2>
            <button class="modal-close" @click="qrZoomed = false">✕</button>
          </div>
          <div class="modal-body qr-modal-body">
            <div class="qr-big-wrap">
              <canvas ref="qrBigCanvas" class="qr-big"></canvas>
            </div>
            <div class="qr-big-pair" :class="{ active: relayConnected }">
              <span v-for="(d, i) in displayCode" :key="i" class="qr-big-digit" :style="{ animationDelay: (i * 80) + 'ms' }">{{ d }}</span>
            </div>
            <div class="qr-big-name">🏫 {{ className }}</div>
            <div class="qr-big-actions">
              <button class="btn-mini" :disabled="!relayConnected" @click="refreshCode">🔄 刷新配对码</button>
              <button class="btn-mini" :disabled="!relayConnected" @click="copyPairCode">📋 复制配对码</button>
            </div>
            <div class="qr-big-hint">
              💡 微信扫一扫 → 扫描上方二维码<br>
              手机和电脑需在<b>同一局域网</b>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 主内容 -->
    <main class="main">
      <ClassManagement v-if="currentTab === 0" />
      <DrawQuestion v-else-if="currentTab === 1" />
      <MessageBoard v-else-if="currentTab === 2" />
      <TextbookCatalog v-else-if="currentTab === 3" />
    </main>

    <!-- 全屏大屏消息（手机发消息时不管在哪个页面都弹出来） -->
    <transition name="bigmsg">
      <div
        v-if="bigMsg.show"
        class="bigmsg-overlay"
        :style="{ '--msg-hue': bigMsg.hue, '--msg-hue2': (bigMsg.hue + 60) % 360 }"
        @click="bigMsg.show = false"
      >
        <div class="bigmsg-ambient"></div>
        <div class="bigmsg-inner">
          <div class="bigmsg-sender">📱 {{ bigMsg.sender }}</div>
          <div class="bigmsg-content" :class="{ long: bigMsg.content?.length > 28 }">
            {{ bigMsg.content }}
          </div>
          <div class="bigmsg-time">{{ bigMsg.time }}</div>
          <div class="bigmsg-hint">点击任意处关闭 · 6 秒后自动消失</div>
        </div>
      </div>
    </transition>

    <!-- 悬浮弹窗（持续显示直到关闭） -->
    <transition name="caption">
      <div v-if="caption.show" class="caption-overlay" @click.self="closeCaption">
        <div class="caption-card">
          <div class="caption-header">
            <span class="caption-sender">📱 来自：{{ caption.sender }}</span>
            <span class="caption-time">{{ caption.time }}</span>
          </div>
          <div class="caption-content">{{ caption.content }}</div>
          <div class="caption-actions">
            <button class="primary" @click="replayTts">🔊 再读一遍</button>
            <button @click="closeCaption">✕ 关闭</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast">
      <div v-if="toast.show" class="toast">{{ toast.msg }}</div>
    </transition>

    <!-- 全局自定义 Dialog（取代原生 alert/confirm） -->
    <GlobalDialog
      v-model:visible="dialog.show"
      :title="dialog.title"
      :message="dialog.message"
      :type="dialog.type"
      :show-cancel="dialog.showCancel"
      :confirm-text="dialog.confirmText"
      :cancel-text="dialog.cancelText"
      @confirm="dialog.onConfirm?.()"
    />
  </div>
</template>

<script setup>
import { ref, reactive, provide, onMounted, computed, nextTick, watch } from 'vue'
import QRCode from 'qrcode'
import ClassManagement from './views/ClassManagement.vue'
import DrawQuestion from './views/DrawQuestion.vue'
import MessageBoard from './views/MessageBoard.vue'
import TextbookCatalog from './views/TextbookCatalog.vue'
import GlobalDialog from './components/GlobalDialog.vue'

const currentTab = ref(0)
const autoLaunch = ref(false)
// 关闭按钮行为：true=隐藏到系统托盘；false=真关闭进程（需托盘退出菜单）
const closeToTray = ref(true)
const unreadCount = ref(0)

// ========== 设置 ==========
const settingsOpen = ref(false)
const settingsInfo = ref({ userDataPath: '', isPortable: false, sizeMB: '0' })
const versionInfo = ref({ version: '1.0.0', platform: '', arch: '' })

// ========== 软件更新（GitHub Releases） ==========
const updateRepo = ref('')
const checkUpdateOnStart = ref(true)
const updateChecking = ref(false)
const updateInfo = ref(null)
const updateDownloading = ref(false)
const updateProgress = ref(0)

// 外观主题（深浅色模式）
const appearanceThemes = [
  { key: 'system', name: '跟随系统', icon: '🖥️' },
  { key: 'dark', name: '深色', icon: '🌙' },
  { key: 'light', name: '浅色', icon: '☀️' },
]
const currentAppearanceTheme = ref('system')

// 已配对手机列表
const pairedMobiles = ref([])
async function refreshPaired() {
  try { await window.api.relay.listPaired() } catch {}
}
async function removePaired(mobile) {
  if (!mobile?.mobileId) return
  const ok = await showConfirm(`确定移除「${mobile.sender || '该手机'}」的配对吗？移除后该手机需重新扫码配对。`, {
    title: '移除配对手机',
    confirmText: '移除'
  })
  if (!ok) return
  try {
    await window.api.relay.removePaired(mobile.mobileId)
    showToast('✓ 已移除，该手机立即失去连接权限')
  } catch {}
}
function formatPairedTime(ts) {
  try {
    const d = new Date(ts)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}-${dd} ${hh}:${mi}`
  } catch { return '' }
}
function openSettings() {
  settingsOpen.value = true
  refreshPaired()
}



// 计算当前实际是否浅色模式（含跟随系统）
function isLightMode(key = currentAppearanceTheme.value) {
  if (key === 'light') return true
  if (key === 'dark') return false
  return window.matchMedia('(prefers-color-scheme: light)').matches
}
// 统一设置主题：data-theme 驱动 style.css 变量，data-theme-mode 驱动组件级覆盖
function applyThemeAttributes(key) {
  const root = document.documentElement
  root.setAttribute('data-theme', key)
  root.setAttribute('data-theme-mode', isLightMode(key) ? 'light' : 'dark')
}

function setAppearanceTheme(key) {
  currentAppearanceTheme.value = key
  applyThemeAttributes(key)
  window.api.config.set({ theme: key })
  genQR() // 主题切换时重画二维码
}

// 跟随系统监听：系统变深浅色时自动切换
const mqlLight = window.matchMedia('(prefers-color-scheme: light)')
mqlLight.addEventListener('change', () => {
  if (currentAppearanceTheme.value === 'system') {
    applyThemeAttributes('system')
    genQR()
  }
})

async function openDataDir() { await window.api.settings.openDir(); showToast('已打开数据文件夹') }
async function backupData() {
  const r = await window.api.settings.backup()
  if (r.ok) showToast('✓ 备份导出成功')
  else if (!r.canceled) showToast('导出失败：' + r.error)
}
async function restoreData() {
  const r = await window.api.settings.restore()
  if (r.ok) showToast('✓ 导入成功，请重启应用')
  else if (!r.canceled) showToast('导入失败：' + r.error)
}
async function resetData() {
  if (!(await showConfirm('确定要清空所有数据？此操作不可恢复！包括年级、班级、学生、学科、题目。', { type: 'danger', confirmText: '确认清空' }))) return
  const r = await window.api.settings.resetData()
  if (r.ok) showToast('✓ 数据已清空，请重启应用')
  else showToast('操作失败：' + r.error)
}

const navItems = reactive([
  { icon: '📚', text: '班级管理', index: 0, badge: 0 },
  { icon: '🎯', text: '抽背系统', index: 1, badge: 0 },
  { icon: '📺', text: '消息大屏', index: 2, badge: 0 },
  { icon: '📖', text: '教材目录', index: 3, badge: 0 }
])

// ========== Relay 状态 ==========
const relayConnected = ref(false)
const relayConnecting = ref(false)
const relayConnectError = ref('')
const className = ref('未命名教室')
// 连接模式：lan=本机内置 Relay（同 WiFi） | public=公网 Relay（任意网络）
const netMode = ref('lan')
const publicRelayUrl = ref('')
const relayUrl = ref('ws://localhost:9000')   // 当前生效地址（派生）
const deviceId = ref('')
const lanIp = ref('')
const pairCode = ref('')
const qrCanvas = ref(null)
const qrBigCanvas = ref(null)
const qrZoomed = ref(false)

// 配对成功动画状态
const pairSuccess = ref(false)
const pairSuccessName = ref('')
let pairSuccessTimer = null

// ========== 侧边栏折叠（localStorage 记忆） ==========
const sidebarCollapsed = ref(localStorage.getItem('cm-sidebar-collapsed') === '1')
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('cm-sidebar-collapsed', sidebarCollapsed.value ? '1' : '0')
}

// ========== 手机连接模态框 ==========
const phoneModalOpen = ref(false)
async function openPhoneModal() {
  phoneModalOpen.value = true
  await nextTick()
  genQR()
}

// 配对设备在线状态文案
const stateLabels = {
  active: '🟢 教室中',
  standby: '🔵 后台在线',
  offline: '⚪ 离线'
}
function stateLabel(s) { return stateLabels[s] || '⚪ 离线' }

// PC → 指定配对手机发消息
const notifyTargetId = ref('')
const notifyText = ref('')
function openNotify(m) {
  if (notifyTargetId.value === m.mobileId) { notifyTargetId.value = ''; return }
  notifyTargetId.value = m.mobileId
  notifyText.value = ''
  nextTick(() => document.querySelector('.paired-notify-input')?.focus())
}
async function sendNotify(m) {
  const body = notifyText.value.trim()
  if (!body) return
  try {
    const r = await window.api.notify.send(m.mobileId, `${className.value} 请求连接`, body)
    if (r.ok) {
      showToast(r.pending ? '⏳ 手机不在线，已保存，下次打开 App 自动收到' : '✓ 已送达，手机通知栏会弹出')
      notifyText.value = ''
      notifyTargetId.value = ''
    } else {
      showToast('发送失败：' + (r.error || '未知错误'), true)
    }
  } catch (e) {
    showToast('发送失败：' + e.message, true)
  }
}

function effectiveRelayUrl() {
  return netMode.value === 'public' && publicRelayUrl.value.trim()
    ? publicRelayUrl.value.trim().replace(/\/+$/, '').replace(/\/relay$/, '')
    : 'ws://localhost:9000'
}
function syncRelayUrl() { relayUrl.value = effectiveRelayUrl() }

const displayCode = computed(() => {
  if (!relayConnected.value || !pairCode.value) return '------'
  return pairCode.value
})

// ========== 全局 Dialog ==========
const dialog = reactive({
  show: false,
  title: '',
  message: '',
  type: 'info',
  showCancel: true,
  confirmText: '确定',
  cancelText: '取消',
  onConfirm: null
})

function showDialog(opts) {
  dialog.show = true
  dialog.title = opts.title || ''
  dialog.message = opts.message || ''
  dialog.type = opts.type || 'info'
  dialog.showCancel = opts.showCancel !== false
  dialog.confirmText = opts.confirmText || '确定'
  dialog.cancelText = opts.cancelText || '取消'
  dialog.onConfirm = opts.onConfirm || null
}

function showAlert(message, opts = {}) {
  showDialog({
    title: opts.title || '提示',
    message,
    type: opts.type || 'info',
    showCancel: false,
    confirmText: opts.confirmText || '知道了',
    ...opts
  })
}

function showConfirm(message, opts = {}) {
  return new Promise(resolve => {
    showDialog({
      title: opts.title || '确认操作',
      message,
      type: opts.type || 'warning',
      showCancel: true,
      confirmText: opts.confirmText || '确定删除',
      cancelText: opts.cancelText || '取消',
      ...opts,
      onConfirm: () => resolve(true)
    })
  })
}

provide('showAlert', showAlert)
provide('showConfirm', showConfirm)

const toast = ref({ show: false, msg: '' })
let toastTimer = null
function showToast(msg) {
  toast.value.msg = msg
  toast.value.show = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.value.show = false, 2000)
}

function switchTab(index) {
  currentTab.value = index
  if (index === 2) { unreadCount.value = 0; navItems[2].badge = 0 }
}

async function setAutoLaunch(e) {
  await window.api.autoLaunch.set(e.target.checked)
  showToast(e.target.checked ? '已开启开机自启' : '已关闭开机自启')
}

async function setCloseToTray(e) {
  closeToTray.value = e.target.checked
  await window.api.config.set({ closeToTray: e.target.checked })
  showToast(e.target.checked ? '关闭窗口将隐藏到系统托盘' : '关闭窗口将直接退出')
}

// ========== 软件更新 ==========
async function saveUpdateRepo() {
  await window.api.config.set({ updateRepo: updateRepo.value.trim() })
  showToast('更新仓库已保存')
}
async function toggleAutoUpdate(e) {
  checkUpdateOnStart.value = e.target.checked
  await window.api.config.set({ checkUpdateOnStart: e.target.checked })
}
async function checkUpdate() {
  updateChecking.value = true
  try {
    if (updateRepo.value.trim()) await saveUpdateRepo()
    updateInfo.value = await window.api.updater.check()
    if (updateInfo.value?.ok === false) showToast(updateInfo.value.error, true)
  } finally {
    updateChecking.value = false
  }
}
async function downloadUpdate() {
  if (!updateInfo.value?.exeUrl) return
  updateDownloading.value = true
  updateProgress.value = 0
  const r = await window.api.updater.download(updateInfo.value.exeUrl)
  updateDownloading.value = false
  if (!r.ok) { showToast('下载失败：' + r.error, true); return }
  if (confirm(`安装包已下载到：\n${r.path}\n\n点击确定立即运行安装（软件将关闭），点取消稍后手动安装。`)) {
    window.api.updater.install(r.path)
  }
}
function openReleasePage() {
  if (updateInfo.value?.releaseUrl) window.api.updater.openExternal(updateInfo.value.releaseUrl)
}

// ========== caption（手机消息弹窗） ==========
const caption = ref({ show: false, content: '', sender: '', time: '' })
function closeCaption() { caption.value.show = false }
function replayTts() { if (caption.value.content) window.api.tts.speak(caption.value.content) }

// ========== bigMsg（全屏大屏显示，不管在哪个 tab） ==========
const bigMsg = ref({ show: false, content: '', sender: '', time: '', hue: 200 })
let bigMsgTimer = null
function hueOf(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + (name || '').charCodeAt(i)) & 0xffffffff
  return Math.abs(h) % 360
}
function showBigMsg(data) {
  // 来消息时自动关闭所有遮挡弹窗（QR放大、设置/手机连接模态框、悬浮通知）
  qrZoomed.value = false
  settingsOpen.value = false
  phoneModalOpen.value = false
  caption.value.show = false

  bigMsg.value = {
    show: true,
    content: data.content || '',
    sender: data.sender || '手机',
    time: data.time || new Date().toLocaleTimeString(),
    hue: hueOf(data.sender)
  }
  // 6 秒后自动消失
  if (bigMsgTimer) clearTimeout(bigMsgTimer)
  bigMsgTimer = setTimeout(() => { bigMsg.value.show = false }, 6000)
}

// ========== Relay 操作 ==========
async function toggleRelay() {
  if (relayConnected.value) {
    await window.api.relay.stop()
    relayConnected.value = false
    pairCode.value = ''
    showToast('已断开连接')
    genQR()
  } else {
    if (netMode.value === 'public' && !publicRelayUrl.value.trim()) {
      showToast('请先填写公网服务地址', true)
      return
    }
    const url = effectiveRelayUrl()
    relayUrl.value = url
    relayConnectError.value = ''
    relayConnecting.value = true
    let r
    try {
      r = await window.api.relay.start(url, className.value)
    } finally {
      relayConnecting.value = false
    }
    if (r.ok) {
      showToast(netMode.value === 'public' ? '✓ 已连接公网服务' : '✓ 本机服务已开启')
      relayConnected.value = true
      if (r.pairCode) pairCode.value = r.pairCode
      if (r.deviceId) deviceId.value = r.deviceId
      genQR()
      await window.api.config.set({ className: className.value })
    } else {
      relayConnectError.value = r.error || '连接失败'
      if (netMode.value === 'public') {
        showToast('连接公网服务失败：免费服务休眠后首次唤醒最长约 1 分钟，请稍后重试', true)
      } else {
        showToast('连接失败：' + (r.error || '请检查本机服务'), true)
      }
    }
  }
}

/** 切换局域网/公网模式；若正在连接则自动断开并用新地址重连 */
async function switchNetMode(mode) {
  if (netMode.value === mode) return
  if (mode === 'public' && !publicRelayUrl.value.trim()) {
    // 允许先切过去填地址，但不持久化空地址
  }
  netMode.value = mode
  syncRelayUrl()
  await window.api.config.set({ relayMode: mode, publicRelayUrl: publicRelayUrl.value.trim() })
  if (relayConnected.value) {
    await window.api.relay.stop()
    relayConnected.value = false
    pairCode.value = ''
    await nextTick()
    toggleRelay()
  }
}

async function savePublicRelay() {
  const v = publicRelayUrl.value.trim().replace(/\/+$/, '').replace(/\/relay$/, '')
  publicRelayUrl.value = v
  syncRelayUrl()
  await window.api.config.set({ relayMode: netMode.value, publicRelayUrl: v })
  showToast('公网地址已保存')
  if (netMode.value === 'public' && relayConnected.value) {
    await window.api.relay.stop()
    relayConnected.value = false
    pairCode.value = ''
    await nextTick()
    toggleRelay()
  }
}

async function saveClass() {
  await window.api.config.set({ className: className.value })
  if (relayConnected.value) genQR()
  showToast('教室名字已保存')
}

async function refreshCode() {
  await window.api.relay.refreshCode()
  showToast('配对码已刷新')
}

async function copyPairCode() {
  if (!pairCode.value) return showToast('未连接', true)
  try { await navigator.clipboard.writeText(pairCode.value); showToast('✓ 配对码已复制') }
  catch { showToast('复制失败') }
}

// ========== 二维码 ==========
function isLightTheme() {
  return document.documentElement.getAttribute('data-theme-mode') === 'light'
}

async function genQR(targetCanvas = null) {
  await nextTick()
  const canvas = targetCanvas || qrCanvas.value
  if (!canvas) return
  const light = isLightTheme()
  const bg = light ? '#ffffff' : '#0d0d18'
  // 未连接时画纯背景
  if (!relayConnected.value || !pairCode.value) {
    const size = targetCanvas ? 320 : 180
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)
    return
  }
  // 从 relayUrl 提取 host，构造手机可访问的 /m 路径
  // ws://localhost:9000/relay → http://<本机局域网IP>:9000/m（手机扫码必须用局域网地址）
  // wss://xxx.onrender.com/relay → https://xxx.onrender.com/m
  let mobileBase = ''
  let qrRelayUrl = relayUrl.value
  try {
    const u = new URL(relayUrl.value)
    const proto = u.protocol === 'wss:' ? 'https:' : 'http:'
    let host = u.host
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && lanIp.value) {
      host = `${lanIp.value}:${u.port || '9000'}`
      qrRelayUrl = `${u.protocol}//${host}`
    }
    mobileBase = `${proto}//${host}/m`
  } catch {
    mobileBase = relayUrl.value.replace(/\/+$/, '').replace(/\/relay$/, '') + '/m'
  }
  const qrData = `${mobileBase}?r=${encodeURIComponent(qrRelayUrl)}&d=${encodeURIComponent(deviceId.value)}&n=${encodeURIComponent(className.value)}`
  try {
    await QRCode.toCanvas(canvas, qrData, {
      width: targetCanvas ? 320 : 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: light
        ? { dark: '#1a1a2e', light: '#ffffff' }
        : { dark: '#e8e8f0', light: '#0d0d18' }
    })
  } catch (e) { /* QR 生成失败时保持占位 */ }
}

// ========== 监听配对码变化，更新二维码 ==========
watch(pairCode, () => { if (relayConnected.value) genQR() })

// ========== 点击放大时画大二维码（含未连接占位）==========
watch(qrZoomed, async (v) => {
  if (!v) return
  await nextTick()
  await genQR(qrBigCanvas.value)
})

// ========== 启动 ==========
onMounted(async () => {
  // 设置
  try {
    autoLaunch.value = await window.api.autoLaunch.get()
    settingsInfo.value = await window.api.settings.info()
    versionInfo.value = await window.api.settings.version()
  } catch {}

  // 应用配置
  try {
    const cfg = await window.api.config.get()
    className.value = cfg.className || '未命名教室'
    netMode.value = cfg.relayMode === 'public' ? 'public' : 'lan'
    publicRelayUrl.value = cfg.publicRelayUrl || ''
    syncRelayUrl()
    deviceId.value = cfg.deviceId || ''
    // 应用外观主题
    currentAppearanceTheme.value = cfg.theme || 'system'
    applyThemeAttributes(currentAppearanceTheme.value)
    // 关闭按钮行为
    closeToTray.value = cfg.closeToTray !== false
    // 更新设置
    updateRepo.value = cfg.updateRepo || ''
    checkUpdateOnStart.value = cfg.checkUpdateOnStart !== false
  } catch {}

  // 本机局域网 IP（localhost relay 时二维码用它编码手机可访问地址）
  try { lanIp.value = await window.api.net.lanIp() || '' } catch {}

  // Relay 事件
  window.api.relay.onMessage((data) => {
    showBigMsg(data)  // 全屏大屏（不管在哪个 tab）
    caption.value = { show: true, content: data.content, sender: data.sender, time: data.time || new Date().toLocaleTimeString() }
    if (data.content) window.api.tts.speak(data.content)
    if (currentTab.value !== 2) { unreadCount.value++; navItems[2].badge = unreadCount.value }
    window.dispatchEvent(new CustomEvent('relay:new-message', { detail: data }))
  })
  window.api.relay.onConnected(() => {
    relayConnected.value = true
    relayConnectError.value = ''
    showToast('✓ Relay 已连接')
    refreshPaired()
  })
  window.api.relay.onDisconnected(() => {
    relayConnected.value = false
    showToast('中继已断开（自动重连中）')
  })
  window.api.relay.onRegistered((info) => {
    pairCode.value = info.pairCode
    deviceId.value = info.deviceId
    genQR()
    showToast('✓ 已注册到云端')
    refreshPaired()
  })
  window.api.relay.onPairCode((code) => {
    pairCode.value = code
  })
  window.api.relay.onError((msg) => {
    relayConnectError.value = msg
    showToast('连接错误：' + msg, true)
  })
  window.api.relay.onServerError((msg) => showToast('服务器：' + msg, true))

  // 更新下载进度 / 启动静默检查发现新版本
  window.api.updater.onProgress(({ percent }) => { updateProgress.value = percent })
  window.api.updater.onAvailable((info) => {
    updateInfo.value = info
    showToast(`🎉 发现新版本 v${info.latest}，可在「设置 → 软件更新」中下载`)
  })
  // 手机上线（进教室 / App 后台待命）
  window.api.relay.onMobileOnline(({ mobileId, state }) => {
    const item = pairedMobiles.value.find(m => m.mobileId === mobileId)
    if (item) item.state = state
  })
  window.api.relay.onMobileOffline((mobileId) => {
    const item = pairedMobiles.value.find(m => m.mobileId === mobileId)
    if (item) item.state = 'offline'
  })
  // 已配对手机列表（授权名单由主进程持久化，增删后主进程会全量推送）
  window.api.relay.onPairedList((mobiles) => {
    pairedMobiles.value = Array.isArray(mobiles) ? mobiles : []
  })
  window.api.relay.onPairedMobile((mobile) => {
    refreshPaired()
    // 配对成功：显示 overlay 动画
    pairSuccessName.value = mobile?.sender || '新手机'
    pairSuccess.value = true
    // 6 秒内再次配对则重置
    clearTimeout(pairSuccessTimer)
    pairSuccessTimer = setTimeout(() => { pairSuccess.value = false }, 6000)
  })
  window.api.relay.onUnpairedMobile((mobileId) => {
    pairedMobiles.value = pairedMobiles.value.filter(m => m.mobileId !== mobileId)
  })

  // 初始生成空白 QR
  genQR()
})
</script>

<style scoped>
/* ==============================================
   整体布局
============================================== */
.app {
  display: flex;
  width: 100%;
  height: 100%;
  color: var(--text-main);
  min-height: 0;
}

.main {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

/* ==============================================
   侧边栏
============================================== */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  min-height: 0;              /* ← 关键：允许 flex 收缩，让 overflow-y 生效 */
  display: flex;
  flex-direction: column;
  padding: 18px 14px;
  padding-bottom: 24px;
  gap: 10px;
  position: relative;
  overflow-y: auto;           /* ← 窗口缩小时自己滚 */
  overflow-x: hidden;
  background:
    repeating-linear-gradient(135deg, rgba(0,212,255,0.02) 0px, rgba(0,212,255,0.02) 1px, transparent 1px, transparent 14px),
    radial-gradient(ellipse at 20% 90%, rgba(124,58,237,0.12) 0%, transparent 60%),
    linear-gradient(180deg, #0a0a1a 0%, #0d0d1e 100%);
  border-right: var(--border-soft);
  box-shadow: 2px 0 24px rgba(0,0,0,0.3);
  transition: width 0.3s var(--ease-out), padding 0.3s var(--ease-out);
}

/* ==============================================
   侧边栏折叠态（68px 图标栏）
============================================== */
.app.sidebar-collapsed .sidebar {
  width: 68px;
  padding: 18px 8px;
  padding-bottom: 18px;
  gap: 8px;
}
.app.sidebar-collapsed .logo { padding: 44px 0 6px; }
.app.sidebar-collapsed .logo-title,
.app.sidebar-collapsed .logo-sub,
.app.sidebar-collapsed .divider { display: none; }
.app.sidebar-collapsed .nav { gap: 6px; }
.app.sidebar-collapsed .nav-item {
  padding: 0;
  height: 46px;
  justify-content: center;
}
.app.sidebar-collapsed .nav-text { display: none; }
.app.sidebar-collapsed .nav-badge {
  position: absolute;
  top: 5px; right: 8px;
  min-width: 8px; height: 8px;
  padding: 0;
  font-size: 0;
  border-radius: 50%;
  border: 2px solid #0d0d1e;
  box-shadow: 0 0 6px rgba(255,102,102,0.6);
}
.app.sidebar-collapsed .settings-wrap { padding-top: 0; }
.app.sidebar-collapsed .settings-btn {
  padding: 0;
  height: 46px;
  justify-content: center;
}
.app.sidebar-collapsed .st-label,
.app.sidebar-collapsed .st-arrow { display: none; }

/* 折叠/展开按钮（侧边栏右上角，常驻可见） */
.sidebar-toggle {
  position: absolute;
  top: 12px; right: 12px;
  width: 32px; height: 32px;
  border-radius: 9px;
  border: var(--border-strong);
  background: var(--surface-2);
  color: var(--text-sub);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  z-index: 8;
  opacity: 0.6;
  transition: all 0.2s;
  padding: 0;
}
.app.sidebar-collapsed .sidebar-toggle {
  top: 10px;
  right: 8px;
}
.sidebar-toggle:hover {
  opacity: 1;
  color: #fff;
  background: var(--accent-gradient);
  border-color: transparent;
  transform: scale(1.08);
}

/* ==============================================
   手机连接入口（侧栏紧凑横条）
============================================== */
.side-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  cursor: pointer;
  transition: all 0.25s;
}
.side-entry:hover {
  background: rgba(0,212,255,0.08);
  border-color: rgba(0,212,255,0.3);
  transform: translateX(2px);
}
.se-icon { font-size: 15px; filter: drop-shadow(0 0 4px rgba(0,212,255,0.3)); }
.se-label {
  flex: 1;
  font-size: 12px; font-weight: 500;
  color: var(--text-sub);
  letter-spacing: 0.3px;
}
.side-entry:hover .se-label { color: var(--text-main); }
.se-status {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,102,102,0.25);
  background: rgba(255,102,102,0.1);
  color: var(--danger);
}
.se-status.online {
  border-color: rgba(0,255,136,0.3);
  background: rgba(0,255,136,0.12);
  color: var(--success, #00ff88);
}
.se-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 6px rgba(255,102,102,0.5);
}
.se-status.online .se-dot {
  background: #00ff88;
  box-shadow: 0 0 8px #00ff88;
  animation: pillBlink 1.6s ease-in-out infinite;
}
.se-arrow { font-size: 16px; color: var(--text-dim); transition: transform 0.2s; }
.side-entry:hover .se-arrow { color: var(--accent); transform: translateX(3px); }

/* 折叠态：手机连接入口变 46px 图标按钮，状态收成小圆点 */
.app.sidebar-collapsed .side-entry {
  padding: 0;
  height: 46px;
  justify-content: center;
}
.app.sidebar-collapsed .se-label,
.app.sidebar-collapsed .se-status-text,
.app.sidebar-collapsed .se-arrow { display: none; }
.app.sidebar-collapsed .se-status {
  position: absolute;
  top: 5px; right: 8px;
  width: 10px; height: 10px;
  padding: 0;
  background: transparent;
  border: 0;
}
.app.sidebar-collapsed .se-dot { width: 8px; height: 8px; border: 2px solid #0d0d1e; }
.app.sidebar-collapsed .side-entry { position: relative; }
/* 侧边栏滚动条 */
.sidebar::-webkit-scrollbar { width: 5px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb {
  background: rgba(0,212,255,0.2); border-radius: 3px;
}
.sidebar::-webkit-scrollbar-thumb:hover { background: rgba(0,212,255,0.4); }

.sidebar::before {
  content: '';
  position: absolute; top: 0; right: 0; bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent 0%, rgba(0,212,255,0.25) 50%, transparent 100%);
  pointer-events: none;
}

/* ==============================================
   Logo
============================================== */
.logo {
  text-align: center;
  padding: 8px 0 10px;
  position: relative;
}
.logo-icon-wrap {
  position: relative;
  width: 52px; height: 52px;
  margin: 0 auto 10px;
  display: flex; align-items: center; justify-content: center;
}
.logo-icon-ring {
  position: absolute; inset: -4px;
  border-radius: 16px;
  background: conic-gradient(
    from 0deg,
    rgba(0,212,255,0.6), rgba(124,58,237,0.6), rgba(0,212,255,0.6)
  );
  animation: logoSpin 6s linear infinite;
  filter: blur(0.5px);
}
@keyframes logoSpin { to { transform: rotate(360deg); } }
.logo-icon {
  position: relative; z-index: 2;
  width: 44px; height: 44px;
  border-radius: 14px;
  background: linear-gradient(145deg, #1e1e36, #0f0f20);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 16px rgba(0,212,255,0.25), inset 0 1px 0 var(--outline-soft);
}
.logo-title {
  font-size: 15px; font-weight: bold; color: #fff;
  letter-spacing: 1px; margin-bottom: 4px;
  background: linear-gradient(135deg, #fff, #c4c4ff);
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
}
.logo-sub {
  font-size: 9px; color: var(--text-dim);
  letter-spacing: 2px; display: inline-block;
}
.logo-sub .sub-letter {
  display: inline-block;
  animation: subLetter 3s ease-in-out infinite;
  opacity: 0.5;
}
@keyframes subLetter {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-1px); }
}

/* ==============================================
   分隔线
============================================== */
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--highlight-strong), transparent);
  margin: 4px 8px;
}

/* ==============================================
   导航项
============================================== */
.nav { display: flex; flex-direction: column; gap: 4px; }

.nav-item {
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 12px;
  cursor: pointer;
  color: var(--text-sub);
  transition: all 0.25s var(--ease-out);
  font-size: 13px;
  position: relative;
  overflow: hidden;
}
.nav-item:hover {
  color: var(--text-main);
  background: var(--surface-2);
}

/* 左侧渐变指示条 */
.nav-indicator {
  position: absolute;
  left: 0; top: 8px; bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent-gradient);
  box-shadow: 0 0 12px rgba(0,212,255,0.5);
  transform: scaleY(0);
  transition: transform 0.3s var(--ease-out);
}
.nav-item.active .nav-indicator {
  transform: scaleY(1);
  animation: indicatorGlow 2.5s ease-in-out infinite;
}
@keyframes indicatorGlow {
  0%, 100% { box-shadow: 0 0 8px rgba(0,212,255,0.4); }
  50% { box-shadow: 0 0 16px rgba(124,58,237,0.6); }
}

/* icon 容器 */
.nav-icon-wrap {
  width: 30px; height: 30px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface-1);
  transition: all 0.3s var(--ease-out);
  flex-shrink: 0;
}
.nav-item.active .nav-icon-wrap {
  background: var(--accent-gradient);
  box-shadow: 0 4px 14px rgba(0,212,255,0.35);
}
.nav-icon { font-size: 15px; }
.nav-item.active .nav-icon { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }

.nav-text { flex: 1; font-weight: 500; letter-spacing: 0.3px; }
.nav-item.active .nav-text {
  color: #fff;
  text-shadow: 0 0 8px rgba(0,212,255,0.3);
}

/* badge */
.nav-badge {
  min-width: 20px; height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--danger);
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 0 8px rgba(255,102,102,0.5);
  animation: badgePulse 1.5s ease-in-out infinite;
}
@keyframes badgePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}

.nav-spacer { flex: 1; }

/* ==============================================
   连接面板（云端 Relay + 二维码，手机连接模态内复用）
============================================== */
.net-status-pill {
  margin-left: auto;
  font-size: 10px; font-weight: normal;
  padding: 3px 10px; border-radius: 10px;
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(255,102,102,0.1);
  color: var(--danger); border: 1px solid rgba(255,102,102,0.25);
  transition: all 0.3s;
}
.net-status-pill.online {
  background: rgba(0,255,136,0.12);
  color: var(--success, #00ff88);
  border-color: rgba(0,255,136,0.3);
}
.pill-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--danger);
  box-shadow: 0 0 6px rgba(255,102,102,0.5);
}
.net-status-pill.online .pill-dot {
  background: #00ff88; box-shadow: 0 0 8px #00ff88;
  animation: pillBlink 1.6s ease-in-out infinite;
}
@keyframes pillBlink {
  0%,100% { opacity: 1; } 50% { opacity: 0.5; }
}

.net-class-row { margin-bottom: 10px; }
.net-label { font-size: 10px; color: var(--text-dim); letter-spacing: 0.3px; display: block; margin-bottom: 4px; }
.net-class-input {
  width: 100%;
  font-size: 13px; padding: 9px 12px;
  background: rgba(0,0,0,0.3);
  border: var(--border-strong);
  border-radius: 8px; color: var(--text-main); outline: none;
  transition: all 0.25s; font-weight: 500;
}
.net-class-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0,212,255,0.1); }
.net-class-input:disabled { opacity: 0.6; cursor: not-allowed; }

/* 配对成功 overlay（覆盖 QR canvas） */
.pair-success-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(0,200,120,0.92), rgba(0,150,100,0.92));
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; z-index: 5;
}
.pair-success-check {
  width: 42px; height: 42px; border-radius: 50%;
  background: #fff; color: #00c878;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: bold;
  animation: checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes checkPop {
  0% { transform: scale(0); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.pair-success-text { font-size: 11px; color: #fff; font-weight: bold; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pair-success-sub { font-size: 10px; color: rgba(255,255,255,0.8); }

.pair-anim-enter-active { animation: pairOverlayIn 0.3s var(--ease-bounce); }
.pair-anim-leave-active { animation: pairOverlayOut 0.25s ease-in; }
@keyframes pairOverlayIn {
  0% { opacity: 0; transform: scale(0.7); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes pairOverlayOut {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.85); }
}
.net-qr-wrap {
  width: 120px; height: 120px; flex-shrink: 0;
  border-radius: 12px; overflow: hidden; position: relative;
  background: #0d0d18;
  border: 2px solid rgba(0,212,255,0.3);
  cursor: zoom-in; transition: all 0.25s;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 16px rgba(0,212,255,0.15);
}
.net-qr-wrap:hover { border-color: var(--accent); box-shadow: 0 0 24px rgba(0,212,255,0.4); transform: scale(1.04); }
.net-qr { display: block; width: 120px; height: 120px; }
.net-qr-placeholder {
  position: absolute; inset: 0;
  background: rgba(13,13,24,0.9);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 20px; color: var(--text-dim); text-align: center;
  line-height: 1.6;
}
.net-qr-hint {
  position: absolute; bottom: 0; left: 0; right: 0;
  font-size: 9px; color: rgba(0,212,255,0.9);
  background: linear-gradient(0deg, rgba(0,0,0,0.75), transparent);
  padding: 8px 0 4px; text-align: center;
  pointer-events: none;
}

/* 高级设置（Relay 地址） */
.net-mode { margin-bottom: 8px; }
.net-mode-seg {
  display: flex; gap: 4px;
  padding: 3px;
  background: rgba(0,0,0,0.25);
  border: var(--border-medium);
  border-radius: 10px;
}
.net-mode-btn {
  flex: 1;
  padding: 7px 4px;
  border: none; border-radius: 8px;
  background: transparent;
  color: var(--text-dim);
  font-size: 11px; font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.net-mode-btn:hover { color: var(--text-main); }
.net-mode-btn.active {
  background: var(--accent-gradient);
  color: #fff;
  box-shadow: 0 2px 10px rgba(0,212,255,0.35);
}
.net-mode-hint {
  margin-top: 7px;
  font-size: 10px; line-height: 1.5;
  color: var(--text-dim);
}
.net-public-row { display: flex; gap: 6px; margin-top: 8px; }
.net-public-input {
  flex: 1; min-width: 0;
  padding: 7px 10px;
  background: rgba(0,0,0,0.3);
  border: var(--border-medium); border-radius: 8px;
  color: var(--text-main); font-size: 11px;
  outline: none; font-family: Consolas, monospace;
}
.net-public-input:focus { border-color: var(--accent); }
.net-public-row .btn-mini { flex-shrink: 0; }

.net-warn {
  margin-top: 8px; padding: 8px 12px;
  background: rgba(255,184,0,0.08);
  border: 1px solid rgba(255,184,0,0.25);
  border-radius: 8px; font-size: 11px; color: #ffb800;
  line-height: 1.5;
}

.net-actions { display: flex; gap: 8px; margin-top: 10px; }
.btn-server {
  flex: 1;
  font-size: 12px; padding: 9px 12px;
  border-radius: 10px;
}
.btn-server.btn-primary {
  background: var(--accent-gradient);
  color: white;
  border: none;
  box-shadow: 0 4px 16px rgba(0,212,255,0.35);
}
.btn-server.btn-stop {
  background: rgba(255,71,87,0.08);
  border: 1px solid rgba(255,71,87,0.3);
  color: var(--danger);
}
.btn-server.btn-stop:hover {
  background: var(--danger); color: #fff; box-shadow: 0 4px 16px rgba(255,71,87,0.4);
}

.net-error {
  margin-top: 8px; padding: 8px 12px;
  background: rgba(255,71,87,0.08);
  border: 1px solid rgba(255,71,87,0.2);
  border-radius: 8px; font-size: 11px; color: var(--danger);
}

/* 旧的已移除样式占位保留最小兼容 */
.net-relay-input { display: none; }

/* ==============================================
   设置按钮（侧边栏底部）
============================================== */
.settings-wrap { margin-top: auto; padding-top: 4px; }
.settings-btn {
  padding: 12px 14px; cursor: pointer;
  display: flex; align-items: center; gap: 10px;
  transition: all 0.25s;
}
.settings-btn:hover {
  background: rgba(124,58,237,0.1);
  border-color: rgba(124,58,237,0.25);
  transform: translateX(2px);
}
.settings-btn:hover .st-icon { filter: drop-shadow(0 0 6px rgba(124,58,237,0.6)); }
.st-icon { font-size: 15px; filter: drop-shadow(0 0 4px rgba(124,58,237,0.4)); transition: all 0.25s; }
.st-label { flex: 1; font-size: 12px; color: var(--text-sub); font-weight: 500; letter-spacing: 0.3px; }
.st-arrow { font-size: 16px; color: var(--text-dim); transition: transform 0.25s; }
.settings-btn:hover .st-arrow { color: var(--accent); transform: translateX(3px); }

/* ==============================================
   设置模态框
============================================== */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1500;
}
.modal-card {
  background: linear-gradient(180deg, #1a1a34 0%, #13132a 100%);
  border: var(--border-strong);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.08);
  position: relative;
}
.modal-top-bar {
  height: 3px;
  background: var(--accent-gradient);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 28px 4px;
}
.modal-header h2 {
  font-size: 17px; font-weight: bold;
  background: linear-gradient(135deg, #fff, #c4c4ff);
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
  margin: 0;
}
.modal-close {
  width: 32px; height: 32px; border-radius: 10px;
  background: var(--surface-2);
  border: var(--border-strong);
  color: var(--text-dim);
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.modal-close:hover {
  background: var(--danger); color: #fff;
  border-color: var(--danger);
  transform: rotate(90deg);
}
.modal-body {
  padding: 18px 28px 28px;
  display: flex; flex-direction: column; gap: 14px;
}

/* ============ 手机连接模态框 ============ */
.phone-modal {
  width: 720px;
  max-width: 92vw;
}
.phone-status-pill {
  margin-left: 10px;
  vertical-align: middle;
  font-weight: bold;
}
.phone-body {
  flex-direction: row;
  align-items: stretch;
  gap: 26px;
  padding: 18px 26px 26px;
}
.phone-qr-col {
  width: 190px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
}
.phone-qr-wrap {
  width: 168px; height: 168px;
  border-radius: 14px;
}
.phone-qr {
  width: 168px; height: 168px;
}
.phone-pair-code {
  font-size: 22px; font-weight: bold;
  font-family: "SF Mono", Consolas, monospace;
  letter-spacing: 8px;
  padding: 4px 10px 4px 18px;
  border-radius: 10px;
  color: var(--text-dim);
  background: rgba(0,212,255,0.06);
  border: 1px solid rgba(0,212,255,0.2);
}
.phone-pair-code.active { color: var(--accent); }
.phone-qr-tip {
  font-size: 12px; color: var(--text-sub);
  max-width: 190px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.phone-paired {
  font-size: 10.5px; color: var(--success, #00c878);
  text-align: center; line-height: 1.5;
}
.phone-form {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.phone-form .net-class-row { margin-bottom: 0; }
.phone-form .net-mode { margin-bottom: 0; }
.phone-form .net-actions { margin-top: auto; }

/* ============ QR 放大模态框 ============ */
.qr-fullscreen {
  position: fixed !important;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100vw; height: 100vh;
  z-index: 9999;
  overflow: hidden;
}
.qr-modal { width: 440px; max-width: 92vw; max-height: 92vh; }
.qr-modal-body {
  padding: 20px 32px 32px;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
}
.qr-big-wrap {
  width: 320px; height: 320px;
  border-radius: 14px; overflow: hidden;
  background: #0d0d18;
  border: 2px solid var(--accent);
  box-shadow: 0 0 32px rgba(0,212,255,0.4), 0 0 80px rgba(124,58,237,0.15);
  display: flex; align-items: center; justify-content: center;
  animation: qrGlow 3s ease-in-out infinite;
}
@keyframes qrGlow {
  0%, 100% { box-shadow: 0 0 28px rgba(0,212,255,0.35), 0 0 80px rgba(124,58,237,0.12); }
  50% { box-shadow: 0 0 40px rgba(0,212,255,0.5), 0 0 100px rgba(124,58,237,0.2); }
}
.qr-big { display: block; width: 320px; height: 320px; }

.qr-big-pair {
  display: flex; gap: 6px; padding: 8px 16px;
  background: rgba(0,212,255,0.08);
  border: 1px solid rgba(0,212,255,0.25);
  border-radius: 12px;
  margin-top: 4px;
}
.qr-big-pair:not(.active) { opacity: 0.4; }
.qr-big-digit {
  font-size: 26px; font-weight: bold;
  font-family: "SF Mono", Consolas, monospace;
  color: var(--text-dim);
  letter-spacing: 2px;
}
.qr-big-pair.active .qr-big-digit {
  color: var(--accent);
  text-shadow: 0 0 12px rgba(0,212,255,0.6);
  animation: digitBreathe 3s ease-in-out infinite;
}
.qr-big-name {
  font-size: 12px; color: var(--text-sub);
  background: var(--surface-2);
  padding: 4px 14px; border-radius: 14px;
}
.qr-big-actions {
  display: flex; gap: 8px; margin-top: 2px;
}
.qr-big-actions .btn-mini { flex: 1; min-width: 110px; font-size: 12px; padding: 8px 14px; }
.qr-big-hint {
  font-size: 11px; color: var(--text-dim); text-align: center;
  line-height: 1.7; margin-top: 4px;
}
.qr-big-hint b { color: var(--accent); }
.set-row { display: flex; flex-direction: column; gap: 6px; }
.set-label { font-size: 10px; color: var(--text-dim); letter-spacing: 0.5px; text-transform: uppercase; }
.set-path {
  font-size: 11px; color: var(--text-sub);
  font-family: Consolas, monospace;
  padding: 8px 10px;
  background: rgba(0,0,0,0.3);
  border-radius: 7px;
  word-break: break-all;
  border: var(--border-soft);
  line-height: 1.4;
}
.set-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.tag {
  font-size: 9px; padding: 2px 7px; border-radius: 8px;
  background: var(--surface-3); color: var(--text-dim);
  border: var(--border-medium);
  font-weight: bold;
}
.tag.portable { background: rgba(0,212,255,0.1); color: var(--accent); border-color: rgba(0,212,255,0.2); }

/* 外观主题按钮组 */
.theme-group { display: flex; gap: 8px; flex-wrap: wrap; }
.theme-btn {
  padding: 8px 14px; border-radius: 10px;
  background: var(--surface-2);
  border: var(--border-strong);
  color: var(--text-sub); font-size: 13px; cursor: pointer;
  transition: all 0.2s;
}
.theme-btn:hover { background: var(--surface-3); color: var(--text-main); border-color: rgba(0,212,255,0.3); }
.theme-btn.active {
  background: rgba(0,212,255,0.15);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 12px rgba(0,212,255,0.2);
}
html[data-theme='light'] .theme-btn { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.1); }
html[data-theme='light'] .theme-btn.active { background: rgba(0,184,212,0.1); border-color: #00b8d4; color: #00b8d4; }

.theme-dots { display: flex; gap: 10px; }
.theme-dot {
  width: 22px; height: 22px; border-radius: 50%;
  cursor: pointer; position: relative;
  transition: all 0.2s;
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.theme-dot:hover { transform: scale(1.12); }
.theme-dot.active { border-color: #fff; transform: scale(1.15); box-shadow: 0 2px 12px rgba(0,0,0,0.4), 0 0 0 2px rgba(0,212,255,0.3); }

.set-btn-row { display: flex; gap: 6px; flex-wrap: wrap; }
.btn-mini {
  flex: 1; min-width: 80px;
  font-size: 11px; padding: 7px 10px;
  background: var(--surface-2);
  border: var(--border-strong);
  border-radius: 7px;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-mini:hover {
  background: rgba(0,212,255,0.1);
  color: var(--accent);
  border-color: rgba(0,212,255,0.25);
}
.btn-mini.danger:hover {
  background: rgba(255,102,102,0.12);
  color: var(--danger);
  border-color: rgba(255,102,102,0.3);
}

/* 已配对手机列表 */
.paired-box {
  border: var(--border-medium);
  background: rgba(0,0,0,0.18);
  border-radius: 10px;
  padding: 8px;
  display: flex; flex-direction: column; gap: 6px;
}
.paired-empty {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 14px 8px;
  color: var(--text-dim);
  font-size: 12px;
  background: var(--surface-1);
  border: var(--border-soft-dashed);
  border-radius: 8px;
}
.paired-empty-icon { font-size: 18px; opacity: 0.6; }
.paired-list { display: flex; flex-direction: column; gap: 6px; }
.paired-item {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 10px;
  background: var(--surface-2);
  border: var(--border-medium);
  border-radius: 8px;
}
.paired-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.paired-name {
  font-size: 13px; color: var(--text-main); font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.paired-meta {
  font-size: 10px; color: var(--text-dim);
  display: flex; align-items: center; gap: 4px;
}
.paired-meta code {
  font-family: Consolas, monospace;
  background: var(--surface-2);
  padding: 0 5px; border-radius: 4px;
  color: var(--text-sub);
}
.paired-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--text-dim);
  display: inline-block;
}
.paired-dot.active {
  background: var(--success);
  box-shadow: 0 0 6px rgba(0,255,136,0.6);
}
.paired-dot.standby {
  background: var(--accent);
  box-shadow: 0 0 6px rgba(0,212,255,0.6);
}
/* 兼容旧类名 */
.paired-dot.online {
  background: var(--success);
  box-shadow: 0 0 6px rgba(0,255,136,0.6);
}
.paired-sep { margin: 0 2px; opacity: 0.5; }
.paired-actions { display: flex; gap: 6px; flex: 0 0 auto; }
.paired-msg { min-width: 64px; }
.paired-remove { flex: 0 0 auto; min-width: 60px; }
.paired-notify-box {
  flex: 1 1 100%;
  display: flex; gap: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-soft);
}
.paired-notify-input {
  flex: 1; min-width: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-main);
  background: var(--surface-1);
  border: var(--border-medium);
  border-radius: 8px;
}
.paired-notify-input:focus {
  border-color: var(--accent);
  outline: none;
}
.paired-refresh {
  margin-top: 2px;
  background: rgba(0,212,255,0.06) !important;
  border-color: rgba(0,212,255,0.15) !important;
}
.paired-refresh:hover:not(:disabled) {
  background: rgba(0,212,255,0.12) !important;
}
.paired-refresh:disabled { opacity: 0.4; cursor: not-allowed; }

/* 软件更新区 */
.set-label + .paired-notify-input { display: block; width: 100%; padding: 9px 12px; }
.update-info { margin-top: 10px; font-size: 12px; color: var(--text-sub); line-height: 1.7; }
.update-new { color: var(--accent); font-weight: 600; margin-bottom: 6px; }
.update-notes {
  margin: 6px 0; padding: 10px 12px; max-height: 160px; overflow-y: auto;
  background: var(--surface-1); border: var(--border-medium); border-radius: 10px;
  font-family: inherit; font-size: 12px; line-height: 1.7; white-space: pre-wrap;
  color: var(--text-sub);
}
.progress-line { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; margin-top: 8px; }
.progress-line > i { display: block; height: 100%; background: var(--accent-gradient); transition: width .25s; }
.btn-mini.primary { background: var(--accent-gradient); color: #fff; border: none; }
.btn-mini.primary:disabled { opacity: .6; cursor: not-allowed; }

/* 浅色模式适配：已配对列表 */
html[data-theme='light'] .btn-mini {
  background: rgba(0,0,0,0.03);
  border-color: rgba(0,0,0,0.08);
  color: var(--text-sub);
}
html[data-theme='light'] .btn-mini:hover {
  background: rgba(0,184,212,0.08);
  color: var(--accent);
  border-color: rgba(0,184,212,0.25);
}
html[data-theme='light'] .btn-mini.danger:hover {
  background: rgba(255,102,102,0.1);
  color: var(--danger);
  border-color: rgba(255,102,102,0.3);
}
html[data-theme='light'] .paired-box {
  background: rgba(0,0,0,0.02);
  border-color: rgba(0,0,0,0.08);
}
html[data-theme='light'] .paired-empty {
  color: var(--text-dim);
  background: rgba(0,0,0,0.02);
  border-color: rgba(0,0,0,0.1);
}
html[data-theme='light'] .paired-item {
  background: var(--surface-1);
  border-color: var(--border-medium);
}
html[data-theme='light'] .paired-name { color: var(--text-main); }
html[data-theme='light'] .paired-meta { color: var(--text-dim); }
html[data-theme='light'] .paired-meta code {
  background: rgba(0,0,0,0.04);
  color: var(--text-sub);
}
html[data-theme='light'] .paired-refresh {
  background: rgba(0,184,212,0.06) !important;
  border-color: rgba(0,184,212,0.2) !important;
  color: var(--accent) !important;
}

/* 浅色模式：设置模态框整体适配（修复字体看不清） */
html[data-theme='light'] .modal-card {
  background: var(--bg-1);
  border-color: rgba(0,0,0,0.08);
  color: var(--text-main);
  box-shadow: var(--shadow-lg);
}
html[data-theme='light'] .modal-header h2 { color: var(--text-main); }
html[data-theme='light'] .modal-close { color: var(--text-sub); }
html[data-theme='light'] .modal-close:hover { color: var(--danger); }
html[data-theme='light'] .modal-body { color: var(--text-main); }
html[data-theme='light'] .set-label { color: var(--text-dim); }
html[data-theme='light'] .set-path {
  background: rgba(0,0,0,0.04);
  color: var(--text-sub);
  border-color: rgba(0,0,0,0.08);
}
html[data-theme='light'] .tag {
  background: rgba(0,0,0,0.04);
  color: var(--text-sub);
  border-color: rgba(0,0,0,0.06);
}
html[data-theme='light'] .tag.portable {
  background: rgba(0,184,212,0.1);
  color: var(--accent);
  border-color: rgba(0,184,212,0.2);
}
html[data-theme='light'] .theme-dot {
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
html[data-theme='light'] .theme-dot.active {
  box-shadow: 0 2px 12px rgba(0,0,0,0.2), 0 0 0 2px rgba(0,184,212,0.3);
}
html[data-theme='light'] .switch-row { color: var(--text-sub); }
html[data-theme='light'] .switch-row span { color: var(--text-main); }
html[data-theme='light'] .set-version {
  color: var(--text-dim);
  border-top-color: rgba(0,0,0,0.06);
}
html[data-theme='light'] .settings-btn { color: var(--text-main); }
html[data-theme='light'] .settings-btn .st-label { color: var(--text-main); }
html[data-theme='light'] .settings-btn .st-icon { color: var(--accent); }

/* 跟随系统浅色模式下：同样应用上述规则 */
@media (prefers-color-scheme: light) {
  html[data-theme='system'] .btn-mini {
    background: rgba(0,0,0,0.03);
    border-color: rgba(0,0,0,0.08);
    color: var(--text-sub);
  }
  html[data-theme='system'] .btn-mini:hover {
    background: rgba(0,184,212,0.08);
    color: var(--accent);
    border-color: rgba(0,184,212,0.25);
  }
  html[data-theme='system'] .btn-mini.danger:hover {
    background: rgba(255,102,102,0.1);
    color: var(--danger);
    border-color: rgba(255,102,102,0.3);
  }
  html[data-theme='system'] .paired-box {
    background: rgba(0,0,0,0.02);
    border-color: rgba(0,0,0,0.08);
  }
  html[data-theme='system'] .paired-empty {
    color: var(--text-dim);
    background: rgba(0,0,0,0.02);
    border-color: rgba(0,0,0,0.1);
  }
  html[data-theme='system'] .paired-item {
    background: var(--surface-1);
    border-color: var(--border-medium);
  }
  html[data-theme='system'] .paired-name { color: var(--text-main); }
  html[data-theme='system'] .paired-meta { color: var(--text-dim); }
  html[data-theme='system'] .paired-meta code {
    background: rgba(0,0,0,0.04);
    color: var(--text-sub);
  }
  html[data-theme='system'] .paired-refresh {
    background: rgba(0,184,212,0.06) !important;
    border-color: rgba(0,184,212,0.2) !important;
    color: var(--accent) !important;
  }
  html[data-theme='system'] .modal-card {
    background: var(--bg-1);
    border-color: rgba(0,0,0,0.08);
    color: var(--text-main);
    box-shadow: var(--shadow-lg);
  }
  html[data-theme='system'] .modal-header h2 { color: var(--text-main); }
  html[data-theme='system'] .modal-close { color: var(--text-sub); }
  html[data-theme='system'] .modal-body { color: var(--text-main); }
  html[data-theme='system'] .set-label { color: var(--text-dim); }
  html[data-theme='system'] .set-path {
    background: rgba(0,0,0,0.04);
    color: var(--text-sub);
    border-color: rgba(0,0,0,0.08);
  }
  html[data-theme='system'] .tag {
    background: rgba(0,0,0,0.04);
    color: var(--text-sub);
    border-color: rgba(0,0,0,0.06);
  }
  html[data-theme='system'] .tag.portable {
    background: rgba(0,184,212,0.1);
    color: var(--accent);
    border-color: rgba(0,184,212,0.2);
  }
  html[data-theme='system'] .theme-dot {
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  html[data-theme='system'] .switch-row { color: var(--text-sub); }
  html[data-theme='system'] .switch-row span { color: var(--text-main); }
  html[data-theme='system'] .set-version {
    color: var(--text-dim);
    border-top-color: rgba(0,0,0,0.06);
  }
  html[data-theme='system'] .settings-btn { color: var(--text-main); }
  html[data-theme='system'] .settings-btn .st-label { color: var(--text-main); }
}

.set-version {
  font-size: 10px; color: var(--text-dim);
  text-align: center; margin-top: 8px;
  padding-top: 12px;
  border-top: var(--border-soft);
  letter-spacing: 0.5px;
}
.set-version .sep { margin: 0 4px; opacity: 0.4; }

.switch-row {
  display: flex; align-items: center; gap: 10px;
  font-size: 12px; color: var(--text-sub);
  cursor: pointer;
}
.switch-row input[type="checkbox"] {
  accent-color: var(--accent);
  width: 14px; height: 14px;
}
.set-hint {
  font-size: 11px; color: var(--text-dim);
  line-height: 1.5; padding-left: 2px;
}

/* modal 过渡 */
.modal-enter-active { animation: modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-leave-active { animation: modalOut 0.22s ease-in forwards; }
@keyframes modalIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
.modal-enter-active .modal-card { animation: modalCardIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes modalCardIn {
  0% { opacity: 0; transform: scale(0.85) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.modal-leave-active .modal-card { animation: modalCardOut 0.22s ease-in forwards; }
@keyframes modalCardOut {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.92) translateY(10px); }
}

/* ==============================================
   全屏大屏消息（手机发来的消息）
============================================== */
.bigmsg-overlay {
  position: fixed; inset: 0;
  z-index: 10000;
  background: rgba(5, 5, 15, 0.85);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  cursor: pointer;
}
.bigmsg-ambient {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 50% 40%, hsla(var(--msg-hue), 80%, 50%, 0.22), transparent 70%),
    radial-gradient(ellipse 50% 40% at 60% 65%, hsla(var(--msg-hue2), 80%, 50%, 0.18), transparent 60%);
  animation: bigmsgAmbient 4s ease-in-out infinite;
  pointer-events: none;
}
@keyframes bigmsgAmbient {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.04); }
}
.bigmsg-inner {
  position: relative; z-index: 1;
  text-align: center;
  padding: 40px 60px;
  max-width: 80vw;
}
.bigmsg-sender {
  font-size: 20px; font-weight: bold;
  color: hsl(var(--msg-hue), 75%, 65%);
  margin-bottom: 20px;
  letter-spacing: 2px;
}
.bigmsg-content {
  font-size: 82px; font-weight: 900; line-height: 1.2;
  letter-spacing: 4px;
  background: linear-gradient(135deg,
    hsl(var(--msg-hue), 85%, 70%),
    hsl(calc(var(--msg-hue) + 30), 85%, 60%),
    hsl(var(--msg-hue2), 85%, 55%));
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 30px hsla(var(--msg-hue), 85%, 60%, 0.5));
  word-break: break-all;
}
.bigmsg-content.long { font-size: 48px; letter-spacing: 2px; }
.bigmsg-time {
  font-size: 14px; color: var(--text-dim);
  margin-top: 26px;
  display: inline-block;
  padding: 4px 16px;
  border-radius: 12px;
  background: var(--surface-3);
  border: var(--border-strong);
}
.bigmsg-hint {
  font-size: 11px; color: var(--text-dim);
  margin-top: 30px; letter-spacing: 1px;
}
/* bigmsg 过渡 */
.bigmsg-enter-active { animation: bigmsgIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.bigmsg-leave-active { animation: bigmsgOut 0.3s ease-in forwards; }
@keyframes bigmsgIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
.bigmsg-enter-active .bigmsg-inner { animation: bigmsgInnerIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes bigmsgInnerIn {
  0% { opacity: 0; transform: scale(0.6) translateY(40px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.bigmsg-leave-active .bigmsg-inner { animation: bigmsgInnerOut 0.25s ease-in forwards; }
@keyframes bigmsgInnerOut {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.1) translateY(-20px); }
}

/* ==============================================
   悬浮消息弹窗（手机来消息）
============================================== */
.caption-overlay {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
}
.caption-card {
  width: min(820px, calc(100vw - 120px));
  min-height: 160px;
  padding: 36px 40px 28px;
  border-radius: 22px;
  background: linear-gradient(135deg, #1a1a2e, #2d1b4e);
  border: 2px solid var(--accent);
  box-shadow: 0 20px 60px rgba(0,212,255,0.35), inset 0 1px 0 var(--outline-soft);
  position: relative;
}
.caption-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--accent-gradient);
  border-radius: 20px 20px 0 0;
}
.caption-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.caption-sender {
  color: var(--accent); font-size: 13px; font-weight: bold;
  padding: 4px 12px; border-radius: 12px;
  background: rgba(0,212,255,0.12);
  border: 1px solid rgba(0,212,255,0.2);
}
.caption-time { color: var(--text-sub); font-size: 11px; font-family: Consolas; }
.caption-content {
  font-size: 36px; font-weight: bold;
  background: linear-gradient(135deg, #fff, #c4c4ff);
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
  line-height: 1.4; margin-bottom: 22px;
  word-break: break-word;
}
.caption-actions { display: flex; justify-content: flex-end; gap: 12px; }

.caption-enter-active { animation: captionIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.caption-leave-active { transition: all 0.25s ease-in; }
.caption-enter-from { opacity: 0; transform: scale(0.6) translateY(20px); }
.caption-leave-to { opacity: 0; transform: scale(0.8); }
@keyframes captionIn {
  0% { opacity: 0; transform: scale(0.6) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* ==============================================
   Toast
============================================== */
.toast {
  position: fixed;
  top: 32px; left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(20,20,40,0.95), rgba(30,20,50,0.95));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  color: #fff;
  padding: 11px 26px;
  border-radius: 22px;
  font-size: 13px; font-weight: 500;
  z-index: 2000;
  border: 1px solid rgba(0,212,255,0.2);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(0,212,255,0.1);
  letter-spacing: 0.3px;
}
.toast-enter-active { animation: toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-leave-active { animation: toastOut 0.25s ease-in forwards; }
@keyframes toastIn {
  0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
@keyframes toastOut {
  0% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}

/* ============ 浅色模式覆盖统一下沉到下方非 scoped 全局块（可穿透子组件） ============ */
</style>

<!-- ==============================================================
     浅色模式全局覆盖（非 scoped：选择器需穿透到各子组件内部元素）
     统一由 html[data-theme-mode='light'] 驱动（显式浅色 + 跟随系统浅色）
================================================================ -->
<style>
html[data-theme-mode='light'] .sidebar {
  background: linear-gradient(180deg, #f6f8fb 0%, #eceff4 100%) !important;
  border-right: 1px solid rgba(0,0,0,0.08) !important;
  box-shadow: 2px 0 12px rgba(0,0,0,0.05) !important;
}
html[data-theme-mode='light'] .logo-area { border-bottom-color: rgba(0,0,0,0.06) !important; }
html[data-theme-mode='light'] .logo-title { color: #1a1a2e !important; }
html[data-theme-mode='light'] .logo-sub .sub-letter {
  color: #82889a !important; opacity: 0.85 !important; animation: none !important;
}
html[data-theme-mode='light'] .logo-icon-wrap {
  background: linear-gradient(145deg, #e4e8ef, #d3d9e4) !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8) !important;
}
html[data-theme-mode='light'] .divider {
  background: linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent) !important;
}
html[data-theme-mode='light'] .nav-item { color: #4a4a5e !important; }
html[data-theme-mode='light'] .nav-item:hover {
  background: rgba(0,0,0,0.04) !important; color: #1a1a2e !important;
}
html[data-theme-mode='light'] .nav-item.active {
  background: rgba(0,184,212,0.12) !important; color: #0097b8 !important;
}
html[data-theme-mode='light'] .nav-item.active .nav-text {
  color: #0097b8 !important; text-shadow: none !important;
}
html[data-theme-mode='light'] .nav-item.active .nav-icon { filter: none !important; }
html[data-theme-mode='light'] .settings-btn {
  background: linear-gradient(145deg, #f0f2f7, #e2e6ed) !important;
  border: 1px solid rgba(0,0,0,0.08) !important; color: #1a1a2e !important;
}
html[data-theme-mode='light'] .settings-btn:hover {
  background: linear-gradient(145deg, #e4e8ef, #d8dde6) !important;
  border-color: var(--accent) !important;
  box-shadow: 0 4px 12px rgba(0,184,212,0.18) !important;
}
html[data-theme-mode='light'] .settings-btn .st-label { color: #1a1a2e !important; }
html[data-theme-mode='light'] .settings-btn .st-arrow { color: #8a8a9e !important; }

/* ---- 手机连接侧栏入口 ---- */
html[data-theme-mode='light'] .side-entry {
  background: linear-gradient(145deg, #f0f2f7, #e2e6ed) !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  color: #1a1a2e !important;
}
html[data-theme-mode='light'] .side-entry:hover {
  border-color: var(--accent) !important;
  box-shadow: 0 4px 12px rgba(0,184,212,0.18) !important;
  background: rgba(0,184,212,0.08) !important;
}
html[data-theme-mode='light'] .side-entry .se-label { color: #1a1a2e !important; }
html[data-theme-mode='light'] .se-icon { filter: none !important; }
html[data-theme-mode='light'] .se-status {
  background: rgba(255,71,87,0.08) !important;
  border-color: rgba(255,71,87,0.3) !important;
  color: #e5484d !important;
}
html[data-theme-mode='light'] .se-status.online {
  background: rgba(0,196,120,0.1) !important;
  border-color: rgba(0,196,120,0.32) !important;
  color: #00a862 !important;
}
html[data-theme-mode='light'] .se-dot { background: #e5484d !important; box-shadow: none !important; }
html[data-theme-mode='light'] .se-status.online .se-dot { background: #00c878 !important; box-shadow: 0 0 6px rgba(0,200,120,0.5) !important; }
html[data-theme-mode='light'] .se-arrow { color: #8a8a9e !important; }
html[data-theme-mode='light'] .sidebar-toggle {
  background: #fff !important;
  border-color: rgba(0,0,0,0.12) !important;
  color: #6a6a7e !important;
}
/* 折叠态 badge/状态点的描边跟随浅色侧栏底色 */
html[data-theme-mode='light'] .app.sidebar-collapsed .nav-badge,
html[data-theme-mode='light'] .app.sidebar-collapsed .se-dot { border-color: #f0f2f6 !important; }

/* ---- 手机连接模态框（浅色强制白底高对比） ---- */
html[data-theme-mode='light'] .phone-modal {
  background: #fff !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  box-shadow: 0 24px 70px rgba(20,30,60,0.22) !important;
}
html[data-theme-mode='light'] .phone-modal .modal-header h2 {
  color: #1a1a2e !important;
  background: none !important;
  -webkit-background-clip: initial !important;
  background-clip: initial !important;
}
html[data-theme-mode='light'] .phone-pair-code {
  background: rgba(0,184,212,0.06) !important;
  border-color: rgba(0,184,212,0.25) !important;
  color: #8a8a9e !important;
}
html[data-theme-mode='light'] .phone-pair-code.active { color: #0097b8 !important; }
html[data-theme-mode='light'] .phone-qr-tip { color: #6a6a7e !important; }
html[data-theme-mode='light'] .phone-paired { color: #00a862 !important; }

/* ---- 手机连接模态内表单 ---- */
html[data-theme-mode='light'] .net-label,
html[data-theme-mode='light'] .net-class-row { color: #4a4a5e !important; }
html[data-theme-mode='light'] .net-class-input {
  background: #fff !important; border-color: rgba(0,0,0,0.12) !important; color: #1a1a2e !important;
}
html[data-theme-mode='light'] .net-qr-wrap {
  background: #ffffff !important;
  border: 2px solid rgba(0,0,0,0.1) !important;
  box-shadow: 0 4px 14px rgba(0,0,0,0.08) !important;
}
html[data-theme-mode='light'] .net-qr-wrap:hover {
  border-color: var(--accent) !important;
  box-shadow: 0 6px 20px rgba(0,184,212,0.2) !important;
}
html[data-theme-mode='light'] .net-qr-placeholder {
  background: rgba(255,255,255,0.96) !important; color: #8a8a9e !important;
}
html[data-theme-mode='light'] .net-qr-hint {
  color: #0097b8 !important;
  background: linear-gradient(0deg, rgba(255,255,255,0.95), transparent) !important;
}
html[data-theme-mode='light'] .net-mode-seg {
  background: rgba(0,0,0,0.04) !important; border-color: rgba(0,0,0,0.08) !important;
}
html[data-theme-mode='light'] .net-mode-btn { color: #6a6a7e !important; }
html[data-theme-mode='light'] .net-mode-hint { color: #8a8a9e !important; }
html[data-theme-mode='light'] .net-public-input {
  background: rgba(0,0,0,0.04) !important; color: #1a1a2e !important;
  border-color: rgba(0,0,0,0.1) !important;
}

/* ---- QR 放大弹窗 ---- */
html[data-theme-mode='light'] .qr-modal {
  background: #fff !important; border: 1px solid rgba(0,0,0,0.08) !important;
}
html[data-theme-mode='light'] .qr-modal-body {
  background: linear-gradient(180deg, #f7f9fc 0%, #eceff4 100%) !important;
}
html[data-theme-mode='light'] .qr-big-wrap {
  background: #fff !important; border-color: rgba(0,0,0,0.12) !important;
  box-shadow: 0 8px 28px rgba(0,0,0,0.12) !important; animation: none !important;
}
html[data-theme-mode='light'] .qr-big-pair {
  background: rgba(0,184,212,0.06) !important; border-color: rgba(0,184,212,0.2) !important;
}
html[data-theme-mode='light'] .qr-big-digit { color: #4a4a5e !important; }
html[data-theme-mode='light'] .qr-big-pair.active .qr-big-digit { color: var(--accent) !important; }
html[data-theme-mode='light'] .qr-big-name {
  color: #4a4a5e !important; background: rgba(0,0,0,0.04) !important;
  border: 1px solid rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .qr-big-hint { color: #8a8a9e !important; }

/* ---- 主区域 + 通用卡片 ---- */
html[data-theme-mode='light'] .main { background: var(--bg-1) !important; }
html[data-theme-mode='light'] .card {
  background: #f7f8fa !important;
  border: 1px solid rgba(0,0,0,0.06) !important;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06) !important;
  backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
}
html[data-theme-mode='light'] .card:hover {
  border-color: rgba(0,184,212,0.35) !important;
  box-shadow: 0 6px 20px rgba(0,0,0,0.1) !important;
}
html[data-theme-mode='light'] .card::before {
  background: linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent) !important;
}
/* 注意：button.primary / .btn-server.btn-primary 等渐变主按钮保持深色渐变 + 白字，不做通用覆盖 */

/* ---- 班级管理页 ---- */
html[data-theme-mode='light'] .page-header h1 {
  background: linear-gradient(135deg, #1a1a2e 30%, #7c3aed) !important;
  -webkit-background-clip: text !important; background-clip: text !important;
  color: transparent !important;
}
html[data-theme-mode='light'] .template-banner {
  background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(0,184,212,0.07)) !important;
  border: 1px dashed rgba(124,58,237,0.45) !important;
}
html[data-theme-mode='light'] .tpl-label { color: #5b3fa8 !important; }
html[data-theme-mode='light'] .tpl-emoji { filter: none !important; }
html[data-theme-mode='light'] .tpl-check { color: #4a4a5e !important; }
html[data-theme-mode='light'] .col-header {
  background: linear-gradient(180deg, rgba(0,0,0,0.035), rgba(0,0,0,0.01)) !important;
  border-bottom: 1px solid rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .col-title { color: #1a1a2e !important; }
html[data-theme-mode='light'] .col-icon { background: rgba(0,184,212,0.12) !important; }
html[data-theme-mode='light'] .list-item.active {
  background: linear-gradient(135deg, rgba(0,184,212,0.12), rgba(124,58,237,0.08)) !important;
  border-color: rgba(0,184,212,0.35) !important;
}
html[data-theme-mode='light'] .list-item.active .item-name {
  color: #0097b8 !important; text-shadow: none !important;
}
html[data-theme-mode='light'] .weight-control {
  background: rgba(0,0,0,0.05) !important; border: 1px solid rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .seg-track {
  background: rgba(0,0,0,0.05) !important; border-color: rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .table-wrap {
  background: #fff !important; border-color: rgba(0,0,0,0.08) !important;
}
html[data-theme-mode='light'] .question-table th {
  background: linear-gradient(180deg, rgba(0,184,212,0.08), rgba(124,58,237,0.05)) !important;
  color: #0097b8 !important; border-bottom-color: rgba(0,0,0,0.08) !important;
}
html[data-theme-mode='light'] .question-table tbody tr:hover td {
  background: rgba(0,184,212,0.05) !important;
}
html[data-theme-mode='light'] .dialog h3 { color: #1a1a2e !important; }
html[data-theme-mode='light'] .dialog-overlay { background: rgba(20,20,40,0.35) !important; }

/* ---- 抽背系统页 ---- */
html[data-theme-mode='light'] .panel-title { color: #1a1a2e !important; }
html[data-theme-mode='light'] .ctrl-tile {
  background: linear-gradient(145deg, #ffffff, #f2f4f8) !important;
  border: 1px solid rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .ctrl-tile:hover {
  border-color: rgba(0,184,212,0.3) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important;
}
html[data-theme-mode='light'] .result-area {
  background: radial-gradient(ellipse at center, rgba(124,58,237,0.06) 0%, transparent 60%),
              linear-gradient(135deg, #fafbfd, #f2f4f8) !important;
  border: 1px solid rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .empty-title { color: #1a1a2e !important; }
html[data-theme-mode='light'] .student-card,
html[data-theme-mode='light'] .student-card.shuffling {
  background: linear-gradient(145deg, #ffffff, #eef1f6) !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  box-shadow: 0 10px 32px rgba(0,0,0,0.1) !important;
}
html[data-theme-mode='light'] .student-name {
  color: #1a1a2e !important; text-shadow: none !important;
}
html[data-theme-mode='light'] .question-card {
  background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(0,184,212,0.06)) !important;
  border-color: rgba(124,58,237,0.35) !important;
  box-shadow: 0 8px 28px rgba(124,58,237,0.12) !important;
}
html[data-theme-mode='light'] .question-title { color: #1a1a2e !important; }
html[data-theme-mode='light'] .tl-name { color: #1a1a2e !important; }
html[data-theme-mode='light'] .tl-item.latest .tl-body { background: rgba(0,184,212,0.06) !important; }

/* ---- 消息大屏页 ---- */
html[data-theme-mode='light'] .conn-pill.online { color: #00a862 !important; }
html[data-theme-mode='light'] .qr-frame-lg {
  background: #fff !important; border-color: rgba(0,184,212,0.3) !important;
  box-shadow: 0 4px 18px rgba(0,0,0,0.08) !important;
}
html[data-theme-mode='light'] .qr-placeholder-lg {
  background: rgba(0,0,0,0.04) !important; color: #8a8a9e !important;
}
html[data-theme-mode='light'] .conn-server {
  background: rgba(0,0,0,0.04) !important; border-color: rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .display-header {
  background: linear-gradient(180deg, rgba(0,0,0,0.03), transparent) !important;
  border-bottom-color: rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .display-footer {
  background: linear-gradient(0deg, rgba(0,0,0,0.03), transparent) !important;
  border-top-color: rgba(0,0,0,0.06) !important;
}
html[data-theme-mode='light'] .msg-time { background: rgba(0,0,0,0.06) !important; }
html[data-theme-mode='light'] .test-area h3 { color: #1a1a2e !important; }

/* ---- 全局弹窗组件 ---- */
html[data-theme-mode='light'] .dialog-card {
  background: linear-gradient(160deg, #ffffff 0%, #eef0f4 100%) !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  box-shadow: 0 24px 64px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.9) !important;
}
html[data-theme-mode='light'] .dialog-title { color: #1a1a2e !important; }
html[data-theme-mode='light'] .dialog-message { color: #4a4a5e !important; }
html[data-theme-mode='light'] .dialog-close { color: #4a4a5e !important; }
html[data-theme-mode='light'] .dialog-btn.primary {
  background: linear-gradient(135deg, #00b8d4, #0091b3) !important;
  color: #fff !important; border: none !important;
}
</style>
