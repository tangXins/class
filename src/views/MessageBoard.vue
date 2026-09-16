<template>
  <div class="page">
    <!-- ========== 页面头部 ========== -->
    <header class="page-header">
      <h1>📺 消息大屏</h1>
      <p class="sub">{{ relayConnected ? '手机扫码/配对后直接发消息，全球任意网络都能用' : '未连接 — 请在侧边栏配置 Relay 服务器' }}</p>
    </header>

    <div class="top-row">
      <!-- ========== 左：连接状态卡 ========== -->
      <div class="conn-panel card">
        <div class="conn-header">
          <div class="conn-title">
            <span class="conn-emoji">🌐</span>
            <span>云端 Relay</span>
          </div>
          <div class="conn-pill" :class="{ online: relayConnected }">
            <span class="pill-dot"></span>
            {{ relayConnected ? '在线' : '离线' }}
          </div>
        </div>

        <!-- 教室信息 -->
        <div class="conn-class" v-if="relayConnected">
          <div class="cc-label">🏫 教室</div>
          <div class="cc-name">{{ className }}</div>
          <div class="cc-id" :title="deviceId">ID: {{ deviceId.slice(0, 8) }}...</div>
        </div>

        <!-- 二维码 + 配对码 -->
        <div class="conn-pair" v-if="relayConnected">
          <div class="qr-frame-lg">
            <img v-if="qrImg" :src="qrImg" alt="手机扫码" class="qr-img-lg" />
            <div v-else class="qr-placeholder-lg">⏳</div>
            <span class="qr-scan-line-lg"></span>
            <span class="qr-corner qc-tl"></span>
            <span class="qr-corner qc-tr"></span>
            <span class="qr-corner qc-bl"></span>
            <span class="qr-corner qc-br"></span>
          </div>
          <div class="pair-block">
            <div class="pb-label">🔐 6 位配对码</div>
            <div class="pb-code">
              <span v-for="(d, i) in displayCode" :key="i" class="pb-digit" :style="{ animationDelay: (i * 80) + 'ms' }">{{ d }}</span>
              <span class="pb-scan"></span>
            </div>
            <div class="pb-actions">
              <button class="btn-mini" @click="refreshCode">🔄 换码</button>
              <button class="btn-mini" @click="copyCode">📋 复制</button>
            </div>
          </div>
        </div>

        <!-- 未连接引导 -->
        <div v-if="!relayConnected" class="conn-guide">
          <div class="guide-icon">📡</div>
          <div class="guide-text">请在左侧边栏点击「🌐 连接云端」</div>
          <div class="guide-hint">Relay 服务器地址可在 ⚙️ 设置里修改</div>
        </div>

        <!-- Relay 地址（只读显示） -->
        <div class="conn-server">
          <div class="cs-label">Relay 服务器</div>
          <div class="cs-url" :title="relayUrl">{{ relayUrl || '未配置' }}</div>
        </div>
      </div>

      <!-- ========== 右：消息大屏 ========== -->
      <div class="big-display card">
        <div class="display-header">
          <div class="connection-status">
            <span class="status-dot" :class="{ online: relayConnected }"></span>
            <span class="status-text">{{ relayConnected ? '等待消息中' : '等待连接' }}</span>
          </div>
          <div class="conn-mode tag-global">
            🌐 云端模式
          </div>
        </div>

        <!-- 随机背景光晕 -->
        <div
          v-if="lastMsg"
          class="ambient-glow"
          :style="{
            '--glow-hue': messageHue(lastMsg.sender),
            '--glow-hue2': (messageHue(lastMsg.sender) + 60) % 360
          }"
        ></div>

        <div class="display-body">
          <!-- 等待态 -->
          <div v-if="!lastMsg" class="waiting">
            <div class="waiting-orbit">
              <span class="orbit-ring"></span>
              <span class="orbit-ring delay"></span>
              <span class="orbit-core">📱</span>
            </div>
            <div class="waiting-text">{{ relayConnected ? '等待手机发送消息...' : '等待手机连接...' }}</div>
            <div class="hint-text" v-if="relayConnected">手机扫码或输入配对码后发消息，大屏自动显示</div>
            <div class="hint-text" v-else>Relay 服务器连接后手机就能连上</div>
          </div>

          <!-- 消息显示 -->
          <transition name="msg" mode="out-in">
            <div
              v-if="lastMsg"
              :key="lastMsg.time + lastMsg.content"
              class="msg-block"
              :style="{
                '--msg-hue': messageHue(lastMsg.sender),
                '--msg-hue2': (messageHue(lastMsg.sender) + 60) % 360
              }"
            >
              <div class="msg-sender">📱 {{ lastMsg.sender }}</div>
              <div class="msg-content" :class="{ long: lastMsg.content?.length > 30 }">
                {{ lastMsg.content }}
              </div>
              <div class="msg-time">{{ lastMsg.time }}</div>
            </div>
          </transition>
        </div>

        <div class="display-footer" v-if="lastMsg">
          <button class="btn-danger" @click="clearMsg">清空</button>
        </div>
      </div>
    </div>

    <!-- ========== 给手机发消息 ========== -->
    <div class="notify-area card">
      <div class="col-header">
        <h3>📨 给手机发消息</h3>
        <button class="btn-mini" @click="refreshPaired">🔄 刷新</button>
      </div>
      <div v-if="!relayConnected" class="notify-empty">
        <span class="ne-icon">📡</span>
        <span>未连接云端 — 手机配对后才能发送</span>
      </div>
      <div v-else-if="!pairedMobiles.length" class="notify-empty">
        <span class="ne-icon">📱</span>
        <span>暂无已配对手机 — 学生扫码或输入配对码连接后会出现在这里</span>
      </div>
      <template v-else>
        <div class="notify-targets">
          <button
            v-for="m in pairedMobiles" :key="m.mobileId"
            class="target-chip"
            :class="{ active: notifyTargetId === m.mobileId }"
            @click="selectTarget(m.mobileId)"
          >
            <span class="chip-dot" :class="m.state || 'offline'"></span>
            <span class="chip-name">{{ m.sender || '未命名设备' }}</span>
            <span class="chip-state">{{ stateLabel(m.state) }}</span>
          </button>
        </div>
        <div class="notify-row">
          <input
            ref="notifyInput"
            v-model="notifyText"
            placeholder="输入要发到手机的消息，手机通知栏会弹出；手机不在线则下次打开 App 自动收到"
            @keyup.enter="sendNotify"
          />
          <button class="primary" :disabled="!notifyTargetId || !notifyText.trim() || notifySending" @click="sendNotify">
            {{ notifySending ? '发送中…' : '📨 发送' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject, computed, nextTick, watch } from 'vue'
import QRCode from 'qrcode'

const showAlert = inject('showAlert')

const relayConnected = ref(false)
const className = ref('未命名教室')
const deviceId = ref('')
const pairCode = ref('')
const relayUrl = ref('ws://localhost:9000')
const lanIp = ref('')
const qrImg = ref('')

const lastMsg = ref(null)

// 已配对手机 & 给手机发消息
const pairedMobiles = ref([])
const notifyTargetId = ref('')
const notifyText = ref('')
const notifySending = ref(false)
const notifyInput = ref(null)

const stateLabels = { active: '在教室', standby: '在线', offline: '离线' }
function stateLabel(s) { return stateLabels[s] || '离线' }

const displayCode = computed(() => {
  if (!relayConnected.value || !pairCode.value) return '------'
  return pairCode.value
})

function messageHue(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + (name || '').charCodeAt(i)) & 0xffffffff
  return Math.abs(h) % 360
}

async function refreshCode() {
  await window.api.relay.refreshCode()
  showAlert('配对码已刷新', { title: '✓ 已更新', showCancel: false, type: 'success' })
}

async function copyCode() {
  if (!pairCode.value) return
  try { await navigator.clipboard.writeText(pairCode.value); showAlert('配对码已复制', { title: '✓ 复制成功', showCancel: false, type: 'success' }) }
  catch { showAlert('复制失败', { showCancel: false, type: 'warning' }) }
}

async function genQR() {
  await nextTick()
  if (!relayConnected.value || !pairCode.value || !deviceId.value) { qrImg.value = ''; return }
  // ws://host:port/relay → http://host:port/m（localhost 替换为局域网 IP，手机才能扫通）
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
  const qrData = `${mobileBase}?r=${encodeURIComponent(qrRelayUrl)}&d=${encodeURIComponent(deviceId.value)}&c=${encodeURIComponent(pairCode.value)}&n=${encodeURIComponent(className.value)}`
  try {
    qrImg.value = await QRCode.toDataURL(qrData, {
      width: 180, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#1a1a2e', light: '#ffffff' }
    })
  } catch (e) { console.error('QR gen failed', e) }
}

function addMessage(data) {
  lastMsg.value = {
    content: data.content || '',
    sender: data.sender || '手机',
    time: data.time || new Date().toLocaleTimeString()
  }
}

function selectTarget(id) {
  notifyTargetId.value = notifyTargetId.value === id ? '' : id
  if (notifyTargetId.value) nextTick(() => notifyInput.value?.focus())
}
async function refreshPaired() {
  try { await window.api.relay.listPaired() } catch {}
}
async function sendNotify() {
  const body = notifyText.value.trim()
  if (!notifyTargetId.value || !body || notifySending.value) return
  notifySending.value = true
  try {
    const r = await window.api.notify.send(notifyTargetId.value, `${className.value} 请求连接`, body)
    if (r.ok) {
      showAlert(r.pending ? '⏳ 手机不在线，已保存，下次打开 App 自动收到' : '✓ 已送达，手机通知栏会弹出',
        { title: '发送成功', showCancel: false, type: 'success' })
      notifyText.value = ''
    } else {
      showAlert('发送失败：' + (r.error || '未知错误'), { title: '发送失败', showCancel: false, type: 'warning' })
    }
  } catch (e) {
    showAlert('发送失败：' + e.message, { title: '发送失败', showCancel: false, type: 'warning' })
  } finally {
    notifySending.value = false
  }
}
function clearMsg() { lastMsg.value = null }

watch(pairCode, () => { if (relayConnected.value) genQR() })
watch(relayConnected, (v) => { genQR(); if (v) refreshPaired() })

onMounted(async () => {
  // 读取应用配置
  try {
    const cfg = await window.api.config.get()
    className.value = cfg.className || '未命名教室'
    relayUrl.value = (!cfg.relayUrl || cfg.relayUrl === 'ws://192.168.1.5:9000')
      ? 'ws://localhost:9000' : cfg.relayUrl
    deviceId.value = cfg.deviceId || ''
  } catch {}

  // 本机局域网 IP（localhost relay 时供二维码编码）
  try { lanIp.value = await window.api.net.lanIp() || '' } catch {}

  // 监听 Relay 事件
  window.api.relay.onConnected(() => {
    relayConnected.value = true
  })
  window.api.relay.onDisconnected(() => {
    relayConnected.value = false
  })
  window.api.relay.onRegistered((info) => {
    pairCode.value = info.pairCode
    deviceId.value = info.deviceId
    genQR()
  })
  window.api.relay.onPairCode((code) => {
    pairCode.value = code
  })

  // 监听消息（两个通道：Relay 直接事件 + App.vue 转发的 CustomEvent）
  window.api.relay.onMessage((data) => addMessage(data))
  window.addEventListener('relay:new-message', (e) => addMessage(e.detail))

  // 已配对手机列表（listPaired 仅触发推送，实际数据走 pairedList 事件）
  window.api.relay.onPairedList((mobiles) => {
    pairedMobiles.value = Array.isArray(mobiles) ? mobiles : []
    if (notifyTargetId.value && !pairedMobiles.value.some(m => m.mobileId === notifyTargetId.value)) {
      notifyTargetId.value = ''
    }
  })
  try { await window.api.relay.listPaired() } catch {}

  // 立即检查一下状态
  try {
    const status = await window.api.relay.status()
    relayConnected.value = status.connected
    if (status.pairCode) pairCode.value = status.pairCode
    if (status.deviceId) deviceId.value = status.deviceId
  } catch {}

  genQR()
})
</script>

<style scoped>
.page { padding: 24px; height: 100%; overflow-y: auto; }
.page-header h1 {
  font-size: 22px; font-weight: bold;
  background: linear-gradient(135deg, #fff, #c4c4ff);
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
  margin-bottom: 4px;
}
.page-header .sub { font-size: 12px; color: var(--text-sub); }

.top-row { display: grid; grid-template-columns: 320px 1fr; gap: 16px; margin-bottom: 16px; }

/* ============ 左侧连接卡 ============ */
.conn-panel { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.conn-header { display: flex; justify-content: space-between; align-items: center; }
.conn-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: bold; color: var(--text-main); }
.conn-emoji { font-size: 18px; }

.conn-pill {
  font-size: 11px; padding: 3px 10px; border-radius: 10px;
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(255,102,102,0.1); color: var(--danger);
  border: 1px solid rgba(255,102,102,0.25);
  transition: all 0.3s;
}
.conn-pill.online {
  background: rgba(0,255,136,0.12); color: #00ff88;
  border-color: rgba(0,255,136,0.3);
}
.conn-pill .pill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 6px rgba(255,102,102,0.5); }
.conn-pill.online .pill-dot { background: #00ff88; box-shadow: 0 0 8px #00ff88; animation: pillBlink 1.6s ease-in-out infinite; }
@keyframes pillBlink { 0%,100%{opacity:1} 50%{opacity:0.5} }

.conn-class {
  padding: 12px; border-radius: 12px;
  background: linear-gradient(135deg, rgba(0,212,255,0.08), rgba(124,58,237,0.06));
  border: 1px solid rgba(0,212,255,0.15);
}
.cc-label { font-size: 10px; color: var(--text-dim); letter-spacing: 0.5px; margin-bottom: 4px; }
.cc-name { font-size: 16px; font-weight: bold; color: var(--text-main); }
.cc-id { font-size: 10px; font-family: Consolas; color: var(--text-dim); margin-top: 4px; }

.conn-pair { display: flex; gap: 14px; align-items: stretch; }

.qr-frame-lg {
  position: relative;
  width: 140px; height: 140px; flex-shrink: 0;
  border-radius: 14px; padding: 8px;
  background: linear-gradient(135deg, rgba(20,20,40,0.9), rgba(15,15,32,0.95));
  border: 2px solid rgba(0,212,255,0.25);
  box-shadow: 0 0 24px rgba(0,212,255,0.12), inset 0 0 16px rgba(0,0,0,0.4);
  overflow: hidden;
}
.qr-img-lg { width: 100%; height: 100%; border-radius: 6px; display: block; }
.qr-placeholder-lg { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-sub); font-size: 14px; border-radius: 6px; background: rgba(0,0,0,0.3); }
.qr-scan-line-lg {
  position: absolute; left: 8px; right: 8px; height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  box-shadow: 0 0 10px var(--accent); top: 8px;
  animation: qrScan 2.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes qrScan { 0%{top:8px;opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{top:calc(100% - 10px);opacity:0} }
.qr-corner { position: absolute; width: 14px; height: 14px; border-color: var(--accent); border-style: solid; pointer-events: none; }
.qc-tl { top: 4px; left: 4px; border-width: 2px 0 0 2px; border-radius: 4px 0 0 0; }
.qc-tr { top: 4px; right: 4px; border-width: 2px 2px 0 0; border-radius: 0 4px 0 0; }
.qc-bl { bottom: 4px; left: 4px; border-width: 0 0 2px 2px; border-radius: 0 0 0 4px; }
.qc-br { bottom: 4px; right: 4px; border-width: 0 2px 2px 0; border-radius: 0 0 4px 0; }

.pair-block { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.pb-label { font-size: 10px; color: var(--text-dim); margin-bottom: 6px; }
.pb-code { position: relative; display: inline-flex; gap: 4px; padding: 4px 0; }
.pb-digit {
  font-size: 20px; font-weight: bold;
  color: var(--accent);
  font-family: "SF Mono", Consolas, monospace;
  text-shadow: 0 0 12px rgba(0,212,255,0.5);
  animation: digitBreathe 3s ease-in-out infinite;
  display: inline-block;
}
@keyframes digitBreathe { 0%,100%{text-shadow:0 0 6px rgba(0,212,255,0.3);transform:translateY(0)} 50%{text-shadow:0 0 16px rgba(0,212,255,0.6);transform:translateY(-1px)} }
.pb-scan {
  position: absolute; top: 0; bottom: 0; width: 20px;
  background: linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent);
  animation: pbScan 2.5s ease-in-out infinite; pointer-events: none; border-radius: 4px; filter: blur(1px);
}
@keyframes pbScan { 0%{left:-18px;opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{left:100%;opacity:0} }
.pb-actions { display: flex; gap: 6px; margin-top: 10px; }
.pb-actions .btn-mini { padding: 5px 10px; font-size: 11px; }

.conn-guide { text-align: center; padding: 30px 0; }
.guide-icon { font-size: 42px; margin-bottom: 10px; opacity: 0.6; }
.guide-text { font-size: 13px; color: var(--text-sub); }
.guide-hint { font-size: 11px; color: var(--text-dim); margin-top: 6px; }

.conn-server {
  padding: 10px 12px; border-radius: 10px;
  background: rgba(0,0,0,0.25); border: var(--border-medium);
}
.cs-label { font-size: 10px; color: var(--text-dim); margin-bottom: 4px; }
.cs-url { font-size: 11px; color: var(--accent); font-family: Consolas; word-break: break-all; }

/* ============ 消息大屏 ============ */
.big-display { padding: 0; overflow: hidden; position: relative; }
.big-display::before {
  content: ''; position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 30% 30%, rgba(0,212,255,0.05), transparent 60%),
    radial-gradient(ellipse at 70% 70%, rgba(124,58,237,0.06), transparent 60%);
  pointer-events: none;
}
.ambient-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 50% 40%, hsla(var(--glow-hue), 70%, 50%, 0.15), transparent 70%),
    radial-gradient(ellipse 50% 40% at 60% 65%, hsla(var(--glow-hue2), 70%, 50%, 0.12), transparent 60%);
  animation: ambientShift 6s ease-in-out infinite;
  pointer-events: none;
}
@keyframes ambientShift { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.02)} }

.display-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px; border-bottom: var(--border-soft);
  font-size: 12px; position: relative; z-index: 1;
  background: linear-gradient(180deg, rgba(0,0,0,0.2), transparent);
}
.connection-status { display: flex; align-items: center; gap: 8px; color: var(--text-sub); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--danger); transition: all 0.3s; }
.status-dot.online { background: #00ff88; box-shadow: 0 0 8px #00ff88; animation: dotPulse 1.5s infinite; }
@keyframes dotPulse { 0%,100%{box-shadow:0 0 8px #00ff88} 50%{box-shadow:0 0 16px #00ff88} }
.conn-mode.tag-global {
  padding: 3px 12px; border-radius: 12px;
  background: rgba(124,58,237,0.12); color: var(--accent2);
  border: 1px solid rgba(124,58,237,0.25);
  font-size: 11px; font-weight: bold;
}

.display-body { padding: 40px 40px; min-height: 300px; display: flex; flex-direction: column; justify-content: center; position: relative; z-index: 1; }

.waiting { text-align: center; color: var(--text-sub); }
.waiting-orbit { position: relative; width: 100px; height: 100px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; }
.orbit-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px dashed rgba(0,212,255,0.25); animation: orbitSpin 6s linear infinite; }
.orbit-ring.delay { border-color: rgba(124,58,237,0.2); animation-duration: 8s; animation-direction: reverse; }
@keyframes orbitSpin { to { transform: rotate(360deg); } }
.orbit-core { font-size: 36px; animation: coreBreathe 3s ease-in-out infinite; }
@keyframes coreBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
.waiting-text { font-size: 14px; color: var(--text-sub); }
.hint-text { font-size: 12px; margin-top: 8px; }

.msg-block { text-align: center; animation: msgPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes msgPop { 0%{opacity:0;transform:scale(0.7) translateY(20px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
.msg-sender { font-size: 16px; color: hsl(var(--msg-hue), 70%, 60%); margin-bottom: 14px; font-weight: bold; letter-spacing: 1px; }
.msg-content {
  font-size: 54px; font-weight: bold; line-height: 1.3; letter-spacing: 2px;
  background: linear-gradient(135deg, hsl(var(--msg-hue), 80%, 65%), hsl(calc(var(--msg-hue) + 30), 80%, 60%), hsl(var(--msg-hue2), 80%, 55%));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 20px hsla(var(--msg-hue), 80%, 60%, 0.4));
}
.msg-content.long { font-size: 34px; }
.msg-time { font-size: 11px; color: var(--text-dim); margin-top: 18px; padding: 3px 12px; border-radius: 10px; background: rgba(0,0,0,0.25); display: inline-block; }

.msg-enter-active, .msg-leave-active { transition: all 0.35s; }
.msg-enter-from { opacity: 0; transform: scale(0.8) translateY(10px); }
.msg-leave-to { opacity: 0; transform: scale(0.9); }

.display-footer { display: flex; justify-content: center; gap: 12px; padding: 14px 24px; border-top: var(--border-soft); position: relative; z-index: 1; background: linear-gradient(0deg, rgba(0,0,0,0.15), transparent); }

/* ============ 给手机发消息 ============ */
.notify-area { padding: 16px; }
.notify-area .col-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.notify-area h3 { font-size: 13px; color: #fff; font-weight: bold; }
.notify-empty {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 22px 0; font-size: 12px; color: var(--text-sub);
}
.notify-empty .ne-icon { font-size: 22px; opacity: 0.6; }
.notify-targets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.target-chip {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 13px; border-radius: var(--radius-pill);
  background: var(--surface-2, rgba(255,255,255,0.04));
  border: 1px solid var(--border-strong);
  color: var(--text-sub); font-size: 12px; cursor: pointer;
  transition: all 0.2s var(--ease-out);
}
.target-chip:hover { border-color: rgba(0,212,255,0.4); color: var(--text-main); }
.target-chip.active {
  background: linear-gradient(135deg, rgba(0,212,255,0.18), rgba(124,58,237,0.18));
  border-color: var(--accent); color: #fff;
  box-shadow: 0 0 14px rgba(0,212,255,0.25);
}
.chip-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-dim); flex-shrink: 0; }
.chip-dot.active { background: #00ff88; box-shadow: 0 0 6px #00ff88; }
.chip-dot.standby { background: #3aa0ff; box-shadow: 0 0 6px #3aa0ff; }
.chip-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip-state { font-size: 10px; opacity: 0.7; }
.notify-row { display: flex; gap: 10px; align-items: center; }
.notify-row input { flex: 1; }
.notify-row .primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* ============ 通用 ============ */
.btn-danger { border-color: var(--danger); color: var(--danger); background: rgba(255,102,102,0.08); border-radius: var(--radius-pill); padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-danger:hover { background: var(--danger); color: #fff; box-shadow: var(--shadow-glow-danger); }
.btn-danger.sm { padding: 5px 11px; font-size: 11px; border-radius: 8px; }
.btn-mini { font-size: 10px; padding: 6px 8px; background: var(--surface-2); border: var(--border-strong); border-radius: 7px; color: var(--text-sub); cursor: pointer; transition: all 0.2s; }
.btn-mini:hover { background: rgba(0,212,255,0.1); color: var(--accent); border-color: rgba(0,212,255,0.25); }
.btn-mini:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-mini:disabled:hover { background: var(--surface-2); color: var(--text-sub); border-color: var(--border-strong); }

@media (max-width: 1000px) { .top-row { grid-template-columns: 1fr; } }
</style>
