<template>
  <div class="dict-page">
    <!-- 加载中 -->
    <div v-if="loading" class="state-box">
      <span class="spin"></span>
      <span>正在加载单词词库…</span>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="loadError" class="state-box error">
      <div class="state-emoji">📂</div>
      <div class="state-title">词库加载失败</div>
      <div class="state-sub">{{ loadError }}</div>
      <button class="pill-btn" @click="reload">🔄 重新加载</button>
    </div>

    <!-- ========== 设置面板 ========== -->
    <div v-else-if="phase === 'setup'" class="setup-wrap">
      <div class="setup-card">
        <div class="card-top-bar"></div>
        <header class="setup-header">
          <div class="sh-title">
            <span class="sh-icon">✍️</span>
            <div>
              <h1>英语单词听写</h1>
              <p>{{ wordBook.textbook }} · {{ wordBook.grade }}{{ wordBook.volume }}</p>
            </div>
          </div>
        </header>

        <div class="setup-body">
          <!-- 英语语音检测 -->
          <div v-if="voicesChecked" class="voice-warn" :class="hasEnglishVoice ? 'ok' : 'bad'">
            <template v-if="hasEnglishVoice">
              <span>🔊 已检测到英语语音：{{ englishVoiceName }}</span>
            </template>
            <template v-else>
              <span>
                ⚠️ 未检测到英语语音包，系统将用中文语音朗读英文，发音可能不标准。
                可在「Windows 设置 → 时间和语言 → 语音」中添加英语语音后重启软件。
              </span>
            </template>
          </div>

          <!-- 单元选择 -->
          <section class="opt-block">
            <div class="opt-label">
              <span>📚 选择听写单元</span>
              <button class="link-btn" @click="selectAllUnits(!allUnitsSelected)">
                {{ allUnitsSelected ? '全不选' : '全选' }}
              </button>
            </div>
            <div class="unit-chips">
              <button
                v-for="u in units"
                :key="u.unit"
                class="unit-chip"
                :class="{ active: selectedUnits.has(u.unit) }"
                @click="toggleUnit(u.unit)"
              >
                <span class="uc-check">{{ selectedUnits.has(u.unit) ? '✓' : '' }}</span>
                <span class="uc-name">{{ u.unit }}</span>
                <span class="uc-count">{{ u.words.length }}</span>
              </button>
            </div>
          </section>

          <!-- 朗读 / 顺序 -->
          <div class="opt-grid">
            <section class="opt-block">
              <div class="opt-label"><span>🔀 播放顺序</span></div>
              <div class="seg-row">
                <button :class="{ active: orderMode === 'sequence' }" @click="orderMode = 'sequence'">📋 按单元顺序</button>
                <button :class="{ active: orderMode === 'random' }" @click="orderMode = 'random'">🎲 随机乱序</button>
              </div>
            </section>

            <section class="opt-block">
              <div class="opt-label"><span>🔁 每词朗读次数</span></div>
              <div class="seg-row">
                <button v-for="n in [1, 2, 3]" :key="n" :class="{ active: repeatTimes === n }" @click="repeatTimes = n">{{ n }} 次</button>
              </div>
            </section>

            <section class="opt-block">
              <div class="opt-label"><span>⏱ 单词间隔</span></div>
              <div class="seg-row">
                <button v-for="s in [5, 8, 10]" :key="s" :class="{ active: intervalSec === s }" @click="intervalSec = s">{{ s }} 秒</button>
              </div>
            </section>

            <section class="opt-block">
              <div class="opt-label"><span>👁 间隔结束后显示单词</span></div>
              <div class="seg-row">
                <button :class="{ active: revealAfter }" @click="revealAfter = true">✅ 显示 2 秒</button>
                <button :class="{ active: !revealAfter }" @click="revealAfter = false">🚫 不显示</button>
              </div>
            </section>
          </div>
        </div>

        <footer class="setup-footer">
          <div class="word-count">
            共 <b>{{ selectedWords.length }}</b> 个单词
            <span v-if="!selectedWords.length" class="wc-tip">· 请至少选择一个单元</span>
          </div>
          <button class="start-btn" :disabled="!selectedWords.length" @click="start">
            ▶ 开始听写
          </button>
        </footer>
      </div>
    </div>

    <!-- ========== 听写舞台 ========== -->
    <div v-else-if="phase === 'running'" class="stage" ref="stageEl">
      <!-- 顶部进度 -->
      <div class="stage-top">
        <div class="st-info">
          <span class="st-pos">第 <b>{{ currentPos + 1 }}</b> / {{ playList.length }} 个</span>
          <span class="st-unit" :title="currentWord.unit">{{ shortUnit(currentWord.unit) }}</span>
        </div>
        <div class="st-progress">
          <div class="st-progress-fill" :style="{ width: ((currentPos) / playList.length * 100) + '%' }"></div>
        </div>
      </div>

      <!-- 中央展示 -->
      <div class="stage-center">
        <div class="word-panel">
          <div class="wp-index">No. {{ String(currentPos + 1).padStart(2, '0') }}</div>
          <div class="wp-meaning">{{ currentWord.meaning }}</div>

          <!-- 答案（单词） -->
          <transition name="ans">
            <div v-if="showAnswer" class="answer-box">
              <div class="ans-word">{{ currentWord.word }}</div>
              <div class="ans-phonetic">{{ currentWord.phonetic }} <span class="ans-pos">{{ currentWord.pos }}</span></div>
            </div>
          </transition>
        </div>

        <!-- 倒计时环 -->
        <div class="ring-wrap">
          <svg class="cd-ring" viewBox="0 0 120 120">
            <circle class="ring-track" cx="60" cy="60" r="52"></circle>
            <circle
              class="ring-value"
              cx="60"
              cy="60"
              r="52"
              :style="{ strokeDashoffset: ringOffset }"
            ></circle>
          </svg>
          <div class="ring-center">
            <template v-if="speaking">
              <span class="ring-speaker">🔊</span>
              <span class="ring-label">朗读中</span>
            </template>
            <template v-else>
              <span class="ring-num">{{ Math.ceil(countdownLeft) }}</span>
              <span class="ring-label">秒</span>
            </template>
          </div>
        </div>
      </div>

      <!-- 底部控制 -->
      <div class="stage-controls">
        <button class="ctrl-btn" title="上一个（←）" @click="gotoPos(currentPos - 1)" :disabled="currentPos === 0">⏮</button>
        <button class="ctrl-btn replay" title="重播当前词（R）" @click="replay">🔊</button>
        <button class="ctrl-btn pause-main" :title="paused ? '继续（空格）' : '暂停（空格）'" @click="togglePause">
          {{ paused ? '▶' : '⏸' }}
        </button>
        <button class="ctrl-btn" title="下一个（→）" @click="gotoPos(currentPos + 1)" :disabled="currentPos === playList.length - 1">⏭</button>
        <span class="ctrl-divider"></span>
        <button class="ctrl-pill" :class="{ on: showAnswer }" @click="showAnswer = !showAnswer">
          👁 {{ showAnswer ? '隐藏单词' : '显示单词' }}
        </button>
        <button class="ctrl-pill" title="全屏（F）" @click="toggleFullscreen">⛶ 全屏</button>
        <button class="ctrl-pill danger" @click="stopDictation">🏁 结束</button>
      </div>
    </div>

    <!-- ========== 结束回顾 ========== -->
    <div v-else class="review-wrap">
      <div class="finish-banner">
        <div class="fb-check">🎉</div>
        <h1>听写完成</h1>
        <p>本轮共听写 {{ playList.length }} 个单词 · {{ wordBook.grade }}{{ wordBook.volume }}</p>
      </div>

      <div class="review-card">
        <div class="review-table">
          <div v-for="(w, i) in playList" :key="i" class="review-row">
            <span class="rv-index">{{ i + 1 }}</span>
            <span class="rv-word">{{ w.word }}</span>
            <span class="rv-phonetic">{{ w.phonetic }}</span>
            <span class="rv-pos">{{ w.pos }}</span>
            <span class="rv-meaning">{{ w.meaning }}</span>
          </div>
        </div>
      </div>

      <div class="review-actions">
        <button class="pill-btn primary" @click="restartSame">🔁 用相同设置再来一轮</button>
        <button class="pill-btn" @click="backToSetup">⚙️ 返回设置</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ========== 数据加载 ==========
const loading = ref(true)
const loadError = ref('')
const wordBook = ref(null)
const phase = ref('setup')   // setup | running | finished

async function loadBook() {
  loading.value = true
  loadError.value = ''
  const book = await window.api.words('words-en-9a.json')
  if (!book || !Array.isArray(book.units) || !book.units.length) {
    throw new Error('词库文件为空或格式不正确')
  }
  wordBook.value = book
  selectedUnits.value = new Set(book.units.map(u => u.unit))
}
async function reload() {
  try { await loadBook() } catch (e) { loadError.value = e.message || String(e) }
  loading.value = false
}

// ========== 设置项 ==========
const units = computed(() => wordBook.value?.units || [])
const selectedUnits = ref(new Set())
const orderMode = ref('sequence')   // sequence | random
const repeatTimes = ref(2)
const intervalSec = ref(8)
const revealAfter = ref(true)

function toggleUnit(name) {
  const s = new Set(selectedUnits.value)
  if (s.has(name)) s.delete(name); else s.add(name)
  selectedUnits.value = s
}
const allUnitsSelected = computed(() =>
  units.value.length > 0 && units.value.every(u => selectedUnits.value.has(u.unit))
)
function selectAllUnits(on) {
  selectedUnits.value = on ? new Set(units.value.map(u => u.unit)) : new Set()
}

// 选中的单词（按顺序/随机）
const selectedWords = computed(() => {
  const list = []
  for (const u of units.value) {
    if (!selectedUnits.value.has(u.unit)) continue
    for (const w of u.words) list.push({ ...w, unit: u.unit })
  }
  if (orderMode.value === 'random') {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
  }
  return list
})

function shortUnit(u = '') {
  // "Unit 1 How can we..." → "Unit 1"
  return u.split(' ').slice(0, 2).join(' ')
}

// ========== 英语语音检测 ==========
const voices = ref([])
const voicesChecked = ref(false)
const hasEnglishVoice = computed(() => voices.value.some(v => /^en/i.test(v.culture || '')))
const englishVoiceName = computed(() => voices.value.find(v => /^en/i.test(v.culture || ''))?.name || 'English')

// ========== 听写运行 ==========
const playList = ref([])
const currentPos = ref(0)
const currentWord = computed(() => playList.value[currentPos.value] || {})
const paused = ref(false)
const showAnswer = ref(false)
const speaking = ref(true)
const countdownLeft = ref(0)
const countdownPct = ref(0)
const stageEl = ref(null)
const isFullscreen = ref(false)

let cycleToken = 0
const ringCircumference = 2 * Math.PI * 52
const ringOffset = computed(() => ringCircumference * (1 - countdownPct.value))

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function waitIfPaused(token) {
  if (!paused.value) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (token !== cycleToken || !paused.value) { clearInterval(timer); resolve() }
    }, 150)
  })
}

function start() {
  if (!selectedWords.value.length) return
  playList.value = selectedWords.value
  currentPos.value = 0
  paused.value = false
  showAnswer.value = false
  phase.value = 'running'
  cycleToken++
  runCycle(cycleToken)
}

// 主控循环：朗读 → 间隔倒计时 → （可选显示答案）→ 下一个
async function runCycle(token, skipFirstSpeak = false) {
  while (token === cycleToken) {
    showAnswer.value = false
    if (!skipFirstSpeak) {
      speaking.value = true
      for (let i = 0; i < repeatTimes.value; i++) {
        if (token !== cycleToken) return
        await waitIfPaused(token)
        if (token !== cycleToken) return
        await window.api.tts.awaitSpeak(currentWord.value.word, { lang: 'en', rate: -1 })
        await sleep(850)
      }
    }
    if (token !== cycleToken) return
    // 间隔倒计时
    speaking.value = false
    await countdown(intervalSec.value, token)
    if (token !== cycleToken) return

    // 间隔结束后短暂显示答案
    if (revealAfter.value) {
      showAnswer.value = true
      await sleep(2200)
      if (token !== cycleToken) return
      showAnswer.value = false
    }

    if (currentPos.value >= playList.value.length - 1) {
      showAnswer.value = true
      finish()
      return
    }
    currentPos.value++
  }
}

// 倒计时（200ms 粒度，支持暂停冻结）
async function countdown(seconds, token) {
  countdownLeft.value = seconds
  countdownPct.value = 0
  let waited = 0
  while (waited < seconds * 1000) {
    if (token !== cycleToken) return
    if (paused.value) await waitIfPaused(token)
    if (token !== cycleToken) return
    const chunkStart = performance.now()
    await sleep(200)
    waited += performance.now() - chunkStart
    countdownLeft.value = Math.max(0, seconds - waited / 1000)
    countdownPct.value = Math.min(1, waited / (seconds * 1000))
  }
  countdownPct.value = 1
}

// ========== 控制 ==========
function togglePause() { paused.value = !paused.value }
function replay() {
  cycleToken++
  paused.value = false
  runCycle(cycleToken)
}
function gotoPos(i) {
  if (i < 0 || i >= playList.value.length) return
  currentPos.value = i
  paused.value = false
  cycleToken++
  runCycle(cycleToken)
}
function stopDictation() {
  cycleToken++
  finish()
}
function finish() {
  phase.value = 'finished'
  speaking.value = false
  countdownPct.value = 0
}
function restartSame() {
  phase.value = 'setup'
  start()
}
function backToSetup() {
  phase.value = 'setup'
}

// ========== 全屏 ==========
async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await stageEl.value.requestFullscreen()
    else await document.exitFullscreen()
  } catch {}
}
function onFsChange() { isFullscreen.value = !!document.fullscreenElement }

// ========== 键盘快捷键 ==========
function onKey(e) {
  if (phase.value !== 'running') return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.code === 'Space') { e.preventDefault(); togglePause() }
  else if (e.key === 'r' || e.key === 'R') replay()
  else if (e.key === 'ArrowLeft') gotoPos(currentPos.value - 1)
  else if (e.key === 'ArrowRight') gotoPos(currentPos.value + 1)
  else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
}

onMounted(async () => {
  await reload()
  // 语音检测不阻塞界面
  try {
    voices.value = await window.api.tts.voices()
  } catch { voices.value = [] }
  voicesChecked.value = true
  document.addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', onFsChange)
})

onUnmounted(() => {
  cycleToken++
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', onFsChange)
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
})
</script>

<style scoped>
.dict-page {
  height: 100%;
  box-sizing: border-box;
  padding: 22px;
  overflow-y: auto;
  color: var(--text-main);
}

/* ========== 通用状态 ========== */
.state-box {
  height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; color: var(--text-sub);
  font-size: 14px;
}
.state-box.error { gap: 8px; }
.state-emoji { font-size: 46px; }
.state-title { font-size: 18px; font-weight: bold; color: var(--text-main); }
.state-sub { font-size: 12px; color: var(--text-dim); margin-bottom: 6px; }
.spin {
  width: 34px; height: 34px;
  border-radius: 50%;
  border: 3px solid rgba(0,212,255,0.15);
  border-top-color: var(--accent);
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ========== 胶囊按钮 ========== */
.pill-btn {
  padding: 9px 22px; border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg-2);
  color: var(--text-main); cursor: pointer;
  font-size: 13px;
  transition: all 0.25s var(--ease-bounce, ease);
}
.pill-btn:hover { transform: scale(1.05); border-color: var(--accent); }
.pill-btn.primary {
  background: var(--accent-gradient);
  color: #fff; border-color: transparent;
  box-shadow: 0 8px 22px rgba(0,150,255,0.3);
}

/* ========== 设置卡片 ========== */
.setup-wrap {
  max-width: 820px;
  margin: 0 auto;
}
.setup-card {
  position: relative;
  background: var(--bg-2);
  border: var(--border-medium);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.card-top-bar {
  height: 4px;
  background: var(--accent-gradient);
}
.setup-header { padding: 22px 28px 14px; }
.sh-title { display: flex; align-items: center; gap: 14px; }
.sh-icon {
  width: 52px; height: 52px; border-radius: 14px;
  background: var(--accent-gradient);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
  box-shadow: 0 8px 22px rgba(0,150,255,0.3);
}
.sh-title h1 { margin: 0; font-size: 22px; font-weight: 800; }
.sh-title p { margin: 4px 0 0; font-size: 12px; color: var(--text-sub); }

.setup-body {
  padding: 8px 28px 20px;
  display: flex; flex-direction: column; gap: 18px;
}

/* 语音提示 */
.voice-warn {
  font-size: 12px; line-height: 1.7;
  padding: 10px 14px; border-radius: 12px;
}
.voice-warn.ok {
  color: #00a862;
  background: rgba(0,200,120,0.08);
  border: 1px solid rgba(0,200,120,0.3);
}
.voice-warn.bad {
  color: #d98a00;
  background: rgba(255,180,0,0.09);
  border: 1px solid rgba(255,180,0,0.32);
}

/* 选项块 */
.opt-block { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.opt-label {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 700;
}
.link-btn {
  border: 0; background: none; cursor: pointer;
  color: var(--accent); font-size: 12px;
}
.link-btn:hover { text-decoration: underline; }

/* 单元 chips */
.unit-chips { display: flex; flex-direction: column; gap: 7px; }
.unit-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 12px;
  background: var(--bg-3);
  border: 1px solid var(--border-strong);
  color: var(--text-main); cursor: pointer;
  font-size: 12.5px;
  transition: all 0.22s var(--ease-bounce, ease);
  text-align: left;
}
.unit-chip:hover { border-color: var(--accent); transform: translateX(3px); }
.unit-chip.active {
  border-color: var(--accent);
  background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.1));
  box-shadow: 0 4px 14px rgba(0,150,255,0.15);
}
.uc-check {
  width: 18px; height: 18px; border-radius: 6px; flex-shrink: 0;
  border: 1.5px solid var(--text-dim);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: #fff;
}
.unit-chip.active .uc-check {
  background: var(--accent-gradient);
  border-color: transparent;
}
.uc-name { flex: 1; min-width: 0; }
.uc-count {
  font-size: 10.5px; color: var(--text-sub);
  background: rgba(128,128,160,0.12);
  border-radius: 999px; padding: 2px 10px; flex-shrink: 0;
}

/* 两列网格 */
.opt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 22px;
}

/* 分段选择 */
.seg-row { display: flex; gap: 6px; flex-wrap: wrap; }
.seg-row button {
  padding: 7px 14px; border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: transparent; color: var(--text-sub);
  font-size: 12px; cursor: pointer;
  transition: all 0.22s var(--ease-bounce, ease);
}
.seg-row button:hover { border-color: var(--accent); color: var(--text-main); }
.seg-row button.active {
  background: var(--accent-gradient);
  color: #fff; border-color: transparent;
  box-shadow: 0 4px 12px rgba(0,150,255,0.28);
}

/* 底部 */
.setup-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 28px 22px;
  border-top: 1px solid var(--border-strong);
}
.word-count { font-size: 13px; color: var(--text-sub); }
.word-count b { color: var(--accent); font-size: 16px; }
.wc-tip { color: var(--text-dim); }
.start-btn {
  padding: 11px 34px; border-radius: 999px; border: 0;
  background: var(--accent-gradient);
  color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
  box-shadow: 0 10px 26px rgba(0,150,255,0.35);
  transition: all 0.25s var(--ease-bounce, ease);
}
.start-btn:hover:not(:disabled) { transform: scale(1.06); box-shadow: 0 12px 32px rgba(0,150,255,0.5); }
.start-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ========== 听写舞台 ========== */
.stage {
  height: 100%;
  display: flex; flex-direction: column;
}
.stage-top { padding: 6px 8px 0; }
.st-info {
  display: flex; align-items: baseline; gap: 14px;
  padding: 0 6px 8px;
  font-size: 13px; color: var(--text-sub);
}
.st-pos b { color: var(--accent); font-size: 17px; }
.st-unit {
  font-size: 11.5px; color: var(--text-dim);
  max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.st-progress {
  height: 5px; border-radius: 999px;
  background: rgba(128,128,160,0.15);
  overflow: hidden;
}
.st-progress-fill {
  height: 100%; border-radius: 999px;
  background: var(--accent-gradient);
  box-shadow: 0 0 10px rgba(0,212,255,0.6);
  transition: width 0.4s var(--ease-bounce, ease);
}

.stage-center {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  gap: clamp(30px, 7vw, 110px);
  padding: 10px 30px;
}
.word-panel {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  max-width: 60%;
}
.wp-index {
  font-size: 14px; letter-spacing: 3px;
  color: var(--text-dim); font-family: Consolas, monospace;
}
.wp-meaning {
  font-size: clamp(38px, 5.6vw, 78px);
  font-weight: 800; line-height: 1.25;
  text-align: center;
  background: var(--accent-gradient);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* 答案框 */
.answer-box {
  text-align: center;
  padding: 14px 30px;
  border-radius: 16px;
  background: rgba(0,212,255,0.07);
  border: 1.5px solid rgba(0,212,255,0.35);
  box-shadow: 0 0 24px rgba(0,212,255,0.15);
}
.ans-word { font-size: clamp(30px, 4vw, 54px); font-weight: 800; color: var(--text-main); }
.ans-phonetic { margin-top: 4px; font-size: 16px; color: var(--accent); font-family: Consolas, monospace; }
.ans-pos { color: var(--text-dim); margin-left: 8px; }

.ans-enter-active { animation: ansIn 0.4s var(--ease-bounce, ease); }
.ans-leave-active { transition: all 0.2s ease-in; }
.ans-leave-to { opacity: 0; transform: scale(0.9); }
@keyframes ansIn {
  0% { opacity: 0; transform: scale(0.8) translateY(14px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* 倒计时环 */
.ring-wrap {
  position: relative;
  width: clamp(110px, 13vw, 170px);
  height: clamp(110px, 13vw, 170px);
  flex-shrink: 0;
}
.cd-ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring-track {
  fill: none;
  stroke: rgba(128,128,160,0.16);
  stroke-width: 7;
}
.ring-value {
  fill: none;
  stroke: var(--accent);
  stroke-width: 7;
  stroke-linecap: round;
  stroke-dasharray: 326.7;
  stroke-dashoffset: 326.7;
  transition: stroke-dashoffset 0.22s linear;
  filter: drop-shadow(0 0 6px rgba(0,212,255,0.6));
}
.ring-center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px;
}
.ring-num { font-size: clamp(30px, 3.4vw, 46px); font-weight: 800; color: var(--accent); }
.ring-speaker {
  font-size: clamp(24px, 2.8vw, 38px);
  animation: pulse 1.1s ease-in-out infinite;
}
.ring-label { font-size: 11px; color: var(--text-dim); }
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.18); opacity: 0.7; }
}

/* 底部控制 */
.stage-controls {
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  padding: 10px 20px 16px;
  flex-wrap: wrap;
}
.ctrl-btn {
  width: 44px; height: 44px; border-radius: 14px;
  border: 1px solid var(--border-strong);
  background: var(--bg-2); color: var(--text-main);
  font-size: 17px; cursor: pointer;
  transition: all 0.22s var(--ease-bounce, ease);
}
.ctrl-btn:hover:not(:disabled) { transform: scale(1.08); border-color: var(--accent); }
.ctrl-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ctrl-btn.pause-main {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--accent-gradient);
  color: #fff; border-color: transparent; font-size: 21px;
  box-shadow: 0 8px 22px rgba(0,150,255,0.4);
}
.ctrl-btn.replay { color: var(--accent); }
.ctrl-divider { width: 1px; height: 26px; background: var(--border-strong); margin: 0 6px; }
.ctrl-pill {
  padding: 9px 16px; border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg-2); color: var(--text-sub);
  font-size: 12.5px; cursor: pointer;
  transition: all 0.22s var(--ease-bounce, ease);
}
.ctrl-pill:hover { border-color: var(--accent); color: var(--text-main); transform: scale(1.05); }
.ctrl-pill.on {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(0,212,255,0.08);
}
.ctrl-pill.danger:hover { color: #ff5a7a; border-color: #ff5a7a; }

/* ========== 结束回顾 ========== */
.review-wrap {
  max-width: 900px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 20px;
  padding-bottom: 30px;
}
.finish-banner { text-align: center; padding: 26px 0 6px; }
.fb-check { font-size: 54px; animation: bounceIn 0.6s var(--ease-bounce, ease); }
.finish-banner h1 { margin: 10px 0 6px; font-size: 28px; font-weight: 800; }
.finish-banner p { margin: 0; font-size: 13px; color: var(--text-sub); }
@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  60% { transform: scale(1.12); }
  100% { opacity: 1; transform: scale(1); }
}

.review-card {
  background: var(--bg-2);
  border: var(--border-medium);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 14px 44px rgba(0,0,0,0.22);
}
.review-table { max-height: 48vh; overflow-y: auto; }
.review-row {
  display: grid;
  grid-template-columns: 44px 1.3fr 1.4fr 50px 1fr;
  align-items: center; gap: 10px;
  padding: 9px 18px;
  font-size: 12.5px;
  border-bottom: 1px solid var(--border-strong);
}
.review-row:nth-child(odd) { background: rgba(128,128,160,0.05); }
.rv-index { color: var(--text-dim); font-family: Consolas; }
.rv-word { font-weight: 700; color: var(--text-main); }
.rv-phonetic { color: var(--accent); font-family: Consolas; font-size: 11.5px; }
.rv-pos { color: var(--text-dim); font-size: 11px; }
.rv-meaning { color: var(--text-sub); }

.review-actions { display: flex; justify-content: center; gap: 12px; }

/* ========== 浅色主题覆盖 ========== */
html[data-theme-mode='light'] .voice-warn.ok { color: #008a4e; }
html[data-theme-mode='light'] .voice-warn.bad { color: #b07000; }
html[data-theme-mode='light'] .setup-card,
html[data-theme-mode='light'] .review-card { box-shadow: 0 16px 46px rgba(40,60,120,0.14); }

/* ========== 响应式 ========== */
@media (max-width: 720px) {
  .opt-grid { grid-template-columns: 1fr; }
  .stage-center { flex-direction: column-reverse; gap: 16px; }
  .word-panel { max-width: 100%; }
  .review-row {
    grid-template-columns: 36px 1fr 1fr;
    gap: 6px;
  }
  .rv-pos, .rv-meaning { grid-column: 2 / 4; }
}
</style>
