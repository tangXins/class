<template>
  <div class="tc-page" :class="{ immersive }">
    <div class="tc-frame">

      <!-- ========== 左轨：三级导航 ========== -->
      <aside class="rail" :class="{ collapsed: railCollapsed }">
        <div class="rail-brand">
          <div class="brand-ic">📖</div>
          <div class="brand-txt">
            <b>教材目录</b>
            <span>统编版 · 全学段</span>
          </div>
          <button class="rail-collapse" :title="railCollapsed ? '展开导航' : '折叠导航'" @click="railCollapsed = !railCollapsed">
            {{ railCollapsed ? '»' : '«' }}
          </button>
        </div>

        <!-- 年级 -->
        <div class="seg">
          <div class="seg-label">年级</div>
          <div class="seg-scroll">
            <div
              v-for="g in gradeNames"
              :key="g"
              class="g-row"
              :class="{ active: currentGrade === g }"
              @click="selectGrade(g)"
              :title="g"
            >
              <span class="g-dot"></span>
              <span class="g-txt">{{ g }}</span>
              <span class="g-short">{{ g.slice(-2) }}</span>
            </div>
          </div>
        </div>

        <!-- 学科 -->
        <div class="seg">
          <div class="seg-label">学科</div>
          <div class="subj-grid">
            <div
              v-for="s in SUBJECT_DEFS"
              :key="s.name"
              class="s-chip"
              :class="{ active: currentSubject === s.name, off: !hasSubject(s.name) }"
              @click="selectSubject(s.name)"
              :title="hasSubject(s.name) ? s.name : s.name + '（暂无内容）'"
            >
              <span class="s-i">{{ s.icon }}</span>
              <span class="s-txt">{{ s.name }}</span>
              <span class="s-x">∅</span>
            </div>
          </div>
        </div>

        <!-- 册别（仅该学科分上/下册时显示） -->
        <div class="seg seg-vols" v-if="volumeNames.length > 1">
          <div class="seg-label">册别</div>
          <div class="vol-grid">
            <div
              v-for="v in volumeNames"
              :key="v"
              class="v-chip"
              :class="{ active: currentVolume === v }"
              @click="selectVolume(v)"
            >
              <span class="v-txt">{{ v }}</span>
            </div>
          </div>
        </div>

        <!-- 单元 -->
        <div class="seg seg-units">
          <div class="seg-label">单元</div>
          <div class="unit-scroll">
            <div
              v-for="u in units"
              :key="u.name"
              class="u-row"
              :class="{ active: currentUnit === u.name }"
              @click="selectUnit(u.name)"
            >
              <span class="u-txt">{{ u.name }}</span>
              <span class="u-cnt">{{ u.articles.length }} 篇</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- ========== 右侧阅读区 ========== -->
      <main class="read" :class="{ eye: eyeCare }">
        <div class="read-progress" :style="{ width: progressPct + '%' }"></div>

        <div class="read-bar">
          <div class="crumb">
            <span>{{ currentGrade || '未选择' }}</span>
            <span class="c-sep">›</span>
            <span>{{ currentSubject }}</span>
            <template v-if="currentVolume">
              <span class="c-sep">›</span>
              <span>{{ currentVolume }}</span>
            </template>
            <span class="c-sep">›</span>
            <b>{{ currentUnit || '—' }}</b>
          </div>

          <div class="read-tools">
            <div class="tool-group">
              <button title="缩小字号（−）" @click="changeFont(-1)">A−</button>
              <span class="tv">{{ fontSize }}</span>
              <button title="放大字号（=）" @click="changeFont(1)">A+</button>
            </div>
            <div class="tool-group">
              <button :title="'切换正文字体（当前：' + fontFaceLabel + '）'" @click="cycleFont">{{ fontFaceLabel }} ▾</button>
            </div>
            <button class="icon-tool" :class="{ on: eyeCare }" title="护眼模式" @click="eyeCare = !eyeCare">🛋️</button>
            <button class="icon-tool" :class="{ on: immersive }" title="沉浸模式（F）" @click="immersive = !immersive">⛶</button>
          </div>
        </div>

        <div class="read-scroll" :style="{ fontSize: fontSize + 'px' }">
          <!-- 有内容 -->
          <div v-if="currentArticle" class="paper" :class="'font-' + fontFace">
            <div class="a-hero">
              <span class="a-pill">📚 {{ currentUnit }}</span>
              <h1 class="a-title">{{ currentArticle.title }}</h1>
              <div class="a-author" v-if="currentArticle.author">—— {{ currentArticle.author }}</div>
              <div class="a-meta">
                <span class="meta-chip">📋 背诵篇目</span>
                <span class="meta-chip">⏱ 约 {{ estMinutes }} 分钟</span>
                <span class="meta-chip">🔖 第 {{ globalPos + 1 }} / {{ flatList.length }} 篇</span>
              </div>
            </div>

            <div class="ornament"><span>❦</span></div>

            <div class="a-text">
              <p v-for="(p, i) in paragraphs" :key="i">{{ p }}</p>
            </div>

            <!-- 上一篇 / 下一篇 -->
            <div class="nav-row">
              <div class="nav-card" :class="{ disabled: !prevArticle }" @click="prevA">
                <div class="nav-ic">←</div>
                <div class="nav-txt">
                  <div class="n-l">上一篇</div>
                  <div class="n-t">{{ prevArticle ? prevArticle.title : '已是第一篇' }}</div>
                </div>
              </div>
              <div class="nav-card next" :class="{ disabled: !nextArticle }" @click="nextA">
                <div class="nav-txt">
                  <div class="n-l">下一篇{{ nextArticle ? ' · ' + nextArticle.unit : '' }}</div>
                  <div class="n-t">{{ nextArticle ? nextArticle.title : '已是最后一篇' }}</div>
                </div>
                <span class="n-arrow">→</span>
              </div>
            </div>
          </div>

          <!-- 空态 -->
          <div v-else class="read-empty">
            <div class="re-emoji">📭</div>
            <div class="re-title">该学科暂无教材内容</div>
            <div class="re-sub">请在左侧选择其他年级或学科（标 ∅ 的学科暂无内容）</div>
          </div>
        </div>
      </main>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ========== 学科定义（图标固定） ==========
const SUBJECT_DEFS = [
  { name: '语文', icon: '📖' },
  { name: '数学', icon: '🔢' },
  { name: '英语', icon: '🔤' },
  { name: '物理', icon: '⚛️' },
  { name: '化学', icon: '🧪' },
  { name: '生物', icon: '🧬' },
  { name: '政治', icon: '⚖️' },
  { name: '历史', icon: '📜' },
  { name: '地理', icon: '🌐' }
]

// ========== 状态 ==========
const catalog = ref(null)
const currentGrade = ref('')
const currentSubject = ref('语文')
const currentVolume = ref('')   // 册别：上册 / 下册 / 全一册；旧结构为空串
const currentUnit = ref('')
const articleIdx = ref(0)

// 支持的册别键（顺序即展示顺序）
const VOLUME_KEYS = ['上册', '下册', '全一册']

const fontSize = ref(18)
const fontFace = ref('yahei')
const eyeCare = ref(false)
const immersive = ref(false)
const railCollapsed = ref(false)

// ========== 数据视图 ==========
const gradeNames = computed(() => catalog.value ? Object.keys(catalog.value) : [])

function hasSubject(name) {
  const sd = catalog.value?.[currentGrade.value]?.[name]
  return !!(sd && typeof sd === 'object')
}

const subjectData = computed(() => {
  const sd = catalog.value?.[currentGrade.value]?.[currentSubject.value]
  return sd && typeof sd === 'object' ? sd : null
})

// 册别解析：新结构 {上册:{单元:[]}, 下册:{...}}；旧结构 {单元:[]} 视为单册（name 为 ''）
const volumes = computed(() => {
  const sd = subjectData.value
  if (!sd) return []
  const hit = VOLUME_KEYS.filter(v => sd[v] && typeof sd[v] === 'object' && !Array.isArray(sd[v]))
  if (hit.length) return hit.map(name => ({ name, units: sd[name] }))
  return [{ name: '', units: sd }]
})
const volumeNames = computed(() => volumes.value.map(v => v.name).filter(Boolean))
const volumeData = computed(
  () => volumes.value.find(v => v.name === currentVolume.value)?.units || null
)

// 单元列表（保序，只保留非空数组单元）
const units = computed(() => {
  if (!volumeData.value) return []
  return Object.entries(volumeData.value)
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([name, articles]) => ({ name, articles }))
})

const currentArticles = computed(() =>
  units.value.find(u => u.name === currentUnit.value)?.articles || []
)
const currentArticle = computed(() => currentArticles.value[articleIdx.value] || null)

// 跨单元展平的全局篇目顺序
const flatList = computed(() =>
  units.value.flatMap(u => u.articles.map(a => ({ ...a, unit: u.name })))
)
const globalPos = computed(() =>
  flatList.value.findIndex(a => a.unit === currentUnit.value && a.title === currentArticle.value?.title)
)
const prevArticle = computed(() => globalPos.value > 0 ? flatList.value[globalPos.value - 1] : null)
const nextArticle = computed(() =>
  globalPos.value >= 0 && globalPos.value < flatList.value.length - 1
    ? flatList.value[globalPos.value + 1] : null
)
const progressPct = computed(() =>
  flatList.value.length && globalPos.value >= 0 ? ((globalPos.value + 1) / flatList.value.length) * 100 : 0
)

const paragraphs = computed(() =>
  (currentArticle.value?.content || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
)
const estMinutes = computed(() => {
  const len = (currentArticle.value?.content || '').replace(/\s/g, '').length
  return Math.max(1, Math.round(len / 80))
})

const fontFaceLabel = computed(() => ({ yahei: '雅黑', simsun: '宋体', kaiti: '楷体' })[fontFace.value])

// ========== 选择 ==========
function selectGrade(g) {
  currentGrade.value = g
  if (!hasSubject(currentSubject.value)) {
    const first = SUBJECT_DEFS.find(s => hasSubject(s.name))
    currentSubject.value = first?.name || '语文'
  }
  ensureVolume()
  ensureUnit()
}
function selectSubject(name) {
  if (!hasSubject(name)) return
  currentSubject.value = name
  ensureVolume()
  ensureUnit()
}
function selectVolume(v) {
  if (currentVolume.value === v) return
  currentVolume.value = v
  ensureUnit()
}
function ensureVolume() {
  if (!volumes.value.find(v => v.name === currentVolume.value)) {
    currentVolume.value = volumes.value[0]?.name || ''
  }
}
function selectUnit(u) {
  currentUnit.value = u
  articleIdx.value = 0
}
function ensureUnit() {
  if (!units.value.find(u => u.name === currentUnit.value)) {
    currentUnit.value = units.value[0]?.name || ''
    articleIdx.value = 0
  }
}

// 按全局展平位置跳转（自动跨单元）
function jumpFlat(pos) {
  if (pos < 0 || pos >= flatList.value.length) return
  const a = flatList.value[pos]
  if (a.unit !== currentUnit.value) currentUnit.value = a.unit
  const arr = units.value.find(u => u.name === a.unit)?.articles || []
  articleIdx.value = Math.max(0, arr.findIndex(x => x.title === a.title))
}
function prevA() { if (prevArticle.value) jumpFlat(globalPos.value - 1) }
function nextA() { if (nextArticle.value) jumpFlat(globalPos.value + 1) }

// 单元切换 J / K
function jumpUnit(dir) {
  const i = units.value.findIndex(u => u.name === currentUnit.value)
  const ni = i + dir
  if (ni >= 0 && ni < units.value.length) selectUnit(units.value[ni].name)
}

// 字号 / 字体
function changeFont(delta) {
  fontSize.value = Math.min(26, Math.max(14, fontSize.value + delta))
}
function cycleFont() {
  const order = ['yahei', 'simsun', 'kaiti']
  fontFace.value = order[(order.indexOf(fontFace.value) + 1) % order.length]
}

// ========== 键盘快捷键 ==========
function onKey(e) {
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === 'ArrowRight') nextA()
  else if (e.key === 'ArrowLeft') prevA()
  else if (e.key === 'j' || e.key === 'J') jumpUnit(1)
  else if (e.key === 'k' || e.key === 'K') jumpUnit(-1)
  else if (e.key === 'f' || e.key === 'F') immersive.value = !immersive.value
  else if (e.key === '=' || e.key === '+') changeFont(1)
  else if (e.key === '-') changeFont(-1)
  else if (e.key === 'Escape') immersive.value = false
}

onMounted(async () => {
  catalog.value = await window.api.catalog()
  const g = gradeNames.value.includes('九年级') ? '九年级' : gradeNames.value[0] || ''
  currentGrade.value = g
  if (!hasSubject(currentSubject.value)) {
    const first = SUBJECT_DEFS.find(s => hasSubject(s.name))
    currentSubject.value = first?.name || '语文'
  }
  ensureVolume()
  ensureUnit()
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.tc-page {
  height: 100%; padding: 14px;
  --t1: #f3f4ff; --t2: #a4a7c4; --t3: #6d7090;
  --rail-bg: linear-gradient(180deg, #1a1a36, #15152c);
  --read-bg: linear-gradient(180deg, #191931, #14142a);
  --inset: rgba(255,255,255,0.05);
  --line: rgba(255,255,255,0.09);
  --paper: rgba(255,255,255,0.03);
  --grad: linear-gradient(135deg, #00d4ff, #7c3aed);
}

.tc-frame {
  height: 100%;
  display: flex;
  border-radius: 20px; overflow: hidden;
  background: var(--read-bg);
  border: 1px solid var(--line);
  box-shadow: 0 24px 70px rgba(0,0,0,0.45);
}

/* ========== 左轨 ========== */
.rail {
  width: 252px; flex-shrink: 0;
  background: var(--rail-bg);
  border-right: 1px solid var(--line);
  padding: 18px 14px;
  display: flex; flex-direction: column; gap: 16px;
  overflow: hidden;
  transition: width 0.28s var(--ease-out, ease);
}
.rail.collapsed { width: 64px; padding: 18px 8px; align-items: center; }

/* 品牌 */
.rail-brand { display: flex; align-items: center; gap: 9px; padding: 0 4px; }
.brand-ic {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: var(--grad);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
  box-shadow: 0 6px 16px rgba(60,120,220,0.35);
}
.brand-txt { flex: 1; min-width: 0; }
.brand-txt b { display: block; font-size: 13.5px; color: var(--t1); }
.brand-txt span { display: block; font-size: 9px; color: var(--t3); margin-top: 2px; }
.rail-collapse {
  width: 24px; height: 24px; padding: 0; border-radius: 7px;
  background: transparent; border: 1px solid var(--line);
  color: var(--t3); font-size: 10px; cursor: pointer; flex-shrink: 0;
}
.rail-collapse:hover { color: var(--t1); border-color: var(--t1); }
.rail.collapsed .brand-txt { display: none; }

/* 分区 */
.seg { display: flex; flex-direction: column; gap: 7px; min-height: 0; }
.seg-label {
  font-size: 10px; color: var(--t3); letter-spacing: 1.5px;
  font-weight: 700; padding: 0 6px;
}
.seg-scroll { display: flex; flex-direction: column; gap: 3px; max-height: 150px; overflow-y: auto; }
.unit-scroll { display: flex; flex-direction: column; gap: 3px; overflow-y: auto; min-height: 0; }
.seg-units { flex: 1; }

/* 年级行 */
.g-row {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 10px; border-radius: 10px; cursor: pointer;
  font-size: 12.5px; color: var(--t2);
  border: 1px solid transparent;
}
.g-row:hover { background: var(--inset); color: var(--t1); }
.g-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--t3); flex-shrink: 0; }
.g-short { display: none; font-size: 11px; }
.g-row.active {
  background: var(--grad); color: #fff; font-weight: 700;
  box-shadow: 0 6px 16px rgba(60,120,220,0.3);
}
.g-row.active .g-dot { background: #fff; }

/* 学科芯片 */
.subj-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.s-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 9px; border-radius: 10px; cursor: pointer;
  background: var(--inset); border: 1px solid var(--line);
  font-size: 11.5px; color: var(--t2);
}
.s-i { font-size: 14px; flex-shrink: 0; }
.s-x { display: none; margin-left: auto; font-size: 9px; color: var(--t3); }
.s-chip:hover { border-color: rgba(0,212,255,0.4); color: var(--t1); }
.s-chip.active {
  background: linear-gradient(135deg, rgba(0,212,255,0.16), rgba(124,58,237,0.18));
  border-color: rgba(0,212,255,0.5); color: var(--t1); font-weight: 700;
}
.s-chip.off { opacity: 0.32; cursor: not-allowed; }
.s-chip.off .s-x { display: inline; }

/* 册别芯片 */
.vol-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.v-chip {
  display: flex; align-items: center; justify-content: center;
  padding: 8px 4px; border-radius: 10px; cursor: pointer;
  background: var(--inset); border: 1px solid var(--line);
  font-size: 11.5px; color: var(--t2);
  transition: all 0.22s var(--ease-out, ease);
}
.v-chip:hover { border-color: rgba(0,212,255,0.4); color: var(--t1); }
.v-chip.active {
  background: var(--grad); color: #fff; font-weight: 700;
  border-color: transparent;
  box-shadow: 0 5px 14px rgba(60,120,220,0.32);
}

/* 单元行 */
.u-row {
  position: relative;
  display: flex; align-items: center; gap: 9px;
  padding: 9px 12px; border-radius: 10px; cursor: pointer;
  font-size: 12px; color: var(--t2);
  border: 1px solid transparent;
}
.u-row:hover { background: var(--inset); color: var(--t1); }
.u-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.u-cnt {
  margin-left: auto; font-size: 9.5px; color: var(--t3);
  background: var(--inset); border: 1px solid var(--line);
  border-radius: 999px; padding: 1px 8px; flex-shrink: 0;
}
.u-row.active { background: var(--inset); border-color: rgba(0,212,255,0.35); color: var(--t1); font-weight: 700; }
.u-row.active::before {
  content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 16px; border-radius: 2px; background: var(--grad);
}
.u-row.active .u-cnt { color: #00d4ff; }

/* 折叠态 */
.rail.collapsed .seg-label,
.rail.collapsed .s-txt,
.rail.collapsed .u-txt,
.rail.collapsed .u-cnt,
.rail.collapsed .seg-units,
.rail.collapsed .seg-vols { display: none; }
.rail.collapsed .g-row { justify-content: center; padding: 7px 4px; }
.rail.collapsed .g-txt { display: none; }
.rail.collapsed .g-short { display: inline; }
.rail.collapsed .subj-grid { grid-template-columns: 1fr; }
.rail.collapsed .s-chip { justify-content: center; padding: 8px 4px; }
.rail.collapsed .s-chip.off .s-x { display: none; }

/* ========== 阅读区 ========== */
.read {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--read-bg);
}
.read-progress {
  height: 3px; flex-shrink: 0; width: 0;
  background: var(--grad);
  box-shadow: 0 0 12px rgba(0,212,255,0.6);
  transition: width 0.3s var(--ease-out, ease);
}
.read-bar {
  display: flex; align-items: center; gap: 14px; flex-shrink: 0;
  padding: 12px 26px;
  border-bottom: 1px solid var(--line);
}
.crumb { font-size: 11.5px; color: var(--t2); display: flex; gap: 8px; align-items: center; min-width: 0; overflow: hidden; }
.crumb b { color: var(--t1); font-weight: 700; white-space: nowrap; }
.crumb .c-sep { color: var(--t3); }

.read-tools { margin-left: auto; display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
.tool-group {
  display: flex; align-items: center; gap: 2px;
  background: var(--inset); border: 1px solid var(--line);
  border-radius: 9px; padding: 3px;
}
.tool-group button {
  border: 0; background: transparent; color: var(--t2);
  font-size: 11px; padding: 4px 8px; border-radius: 6px; cursor: pointer;
}
.tool-group button:hover { color: var(--t1); background: rgba(255,255,255,0.06); }
.tool-group .tv { font-size: 10px; color: var(--t3); min-width: 28px; text-align: center; font-family: Consolas; }
.icon-tool {
  width: 30px; height: 30px; padding: 0; border-radius: 9px;
  background: var(--inset); border: 1px solid var(--line);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; cursor: pointer; color: var(--t2);
}
.icon-tool:hover { color: var(--t1); }
.icon-tool.on {
  background: linear-gradient(135deg, rgba(0,212,255,0.18), rgba(124,58,237,0.2));
  border-color: rgba(0,212,255,0.5);
}

.read-scroll { flex: 1; overflow-y: auto; padding: 34px 48px 28px; }

/* 纸张 */
.paper {
  max-width: 720px; margin: 0 auto;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 38px 50px 32px;
}
.font-yahei { font-family: "Microsoft YaHei","Segoe UI","PingFang SC",sans-serif; }
.font-simsun { font-family: "SimSun","NSimSun",serif; }
.font-kaiti { font-family: "KaiTi","STKaiti",serif; }

.a-hero { text-align: center; }
.a-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: #00d4ff;
  background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3);
  border-radius: 999px; padding: 4px 13px;
}
.a-title {
  margin: 16px 0 8px; font-size: 2.2em; font-weight: 800; letter-spacing: 6px;
  background: linear-gradient(135deg, #ffffff, #b8b8f0);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  line-height: 1.3;
}
.a-author { font-size: 0.72em; color: var(--t3); }
.a-meta { margin-top: 13px; display: flex; justify-content: center; gap: 9px; flex-wrap: wrap; }
.meta-chip {
  font-size: 0.62em; color: var(--t2); background: var(--inset);
  border: 1px solid var(--line); border-radius: 8px; padding: 3px 10px;
}

.ornament { display: flex; align-items: center; gap: 10px; margin: 22px 0 20px; color: var(--t3); }
.ornament::before, .ornament::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, var(--line));
}
.ornament::after { background: linear-gradient(90deg, var(--line), transparent); }
.ornament span { font-size: 12px; }

.a-text { line-height: 2.1; color: var(--t2); }
.a-text p { margin-bottom: 14px; text-indent: 2em; }
.a-text p:first-child::first-letter {
  font-size: 2.6em; float: left; line-height: 1;
  padding: 4px 10px 0 0; color: #00d4ff; font-weight: 800;
}

/* 上一篇 / 下一篇 */
.nav-row { display: flex; gap: 13px; margin-top: 24px; }
.nav-card {
  flex: 1; min-width: 0;
  border: 1px solid var(--line); border-radius: 14px;
  padding: 13px 16px; cursor: pointer;
  display: flex; align-items: center; gap: 11px;
  background: var(--inset);
}
.nav-card.next {
  background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.12));
  border-color: rgba(0,212,255,0.3);
}
.nav-card.disabled { opacity: 0.35; cursor: default; }
.nav-ic {
  width: 34px; height: 34px; flex-shrink: 0; border-radius: 10px;
  background: var(--line);
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.nav-txt { min-width: 0; flex: 1; }
.nav-txt .n-l { font-size: 9.5px; color: var(--t3); margin-bottom: 2px; }
.nav-txt .n-t {
  font-size: 13px; font-weight: 700; color: var(--t1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.n-arrow { color: var(--t3); font-size: 17px; flex-shrink: 0; }
.nav-card.next .n-arrow { color: #00d4ff; }

/* 空态 */
.read-empty { text-align: center; padding: 110px 20px; color: var(--t3); }
.re-emoji { font-size: 54px; margin-bottom: 16px; }
.re-title { font-size: 17px; color: var(--t1); font-weight: bold; margin-bottom: 8px; }
.re-sub { font-size: 12px; color: var(--t3); }

/* ========== 护眼模式 ========== */
.read.eye { background: linear-gradient(180deg, #2c2413, #221c0e); }
.read.eye .paper { background: rgba(255,221,150,0.05); }
.read.eye .a-text { color: #d8c9a0; }
.read.eye .a-text p:first-child::first-letter { color: #ffb84d; }
.read.eye .a-pill { color: #ffb84d; background: rgba(255,184,77,0.1); border-color: rgba(255,184,77,0.3); }

/* ========== 沉浸模式 ========== */
.tc-page.immersive .rail { display: none; }

/* ========== 浅色主题覆盖 ========== */
html[data-theme-mode='light'] .tc-page {
  --t1: #1d2436; --t2: #59607a; --t3: #9aa2b8;
  --rail-bg: #f7f9fd;
  --read-bg: #fbfcfe;
  --inset: #f1f4fa;
  --line: #e5eaf4;
  --paper: #ffffff;
}
html[data-theme-mode='light'] .tc-frame { box-shadow: 0 20px 60px rgba(40,60,120,0.15); }
html[data-theme-mode='light'] .paper { box-shadow: 0 12px 40px rgba(40,60,120,0.08); }
html[data-theme-mode='light'] .a-title {
  background: linear-gradient(135deg, #1d2436, #6a4bd6);
  -webkit-background-clip: text; background-clip: text;
}
html[data-theme-mode='light'] .a-text { color: #33384a; }
html[data-theme-mode='light'] .a-text p:first-child::first-letter { color: #7c3aed; }
html[data-theme-mode='light'] .a-pill { color: #0a93ad; background: #e6f8fc; border-color: #b8ecf5; }
html[data-theme-mode='light'] .tool-group button:hover { background: rgba(0,0,0,0.05); }
html[data-theme-mode='light'] .read.eye { background: #f7f1dd; }
html[data-theme-mode='light'] .read.eye .paper { background: #fffdf5; box-shadow: 0 12px 40px rgba(120,90,20,0.08); }
html[data-theme-mode='light'] .read.eye .a-text { color: #4a4030; }

/* ========== 响应式 ========== */
@media (max-width: 900px) {
  .rail { width: 64px; padding: 18px 8px; align-items: center; }
  .rail .seg-label, .rail .s-txt, .rail .u-txt, .rail .u-cnt, .rail .seg-units, .rail .seg-vols, .rail .brand-txt { display: none; }
  .rail .g-row { justify-content: center; padding: 7px 4px; }
  .rail .g-txt { display: none; }
  .rail .g-short { display: inline; }
  .rail .subj-grid { grid-template-columns: 1fr; }
  .rail .s-chip { justify-content: center; padding: 8px 4px; }
  .rail .s-chip.off .s-x { display: none; }
  .read-scroll { padding: 24px 20px; }
  .paper { padding: 28px 22px 24px; }
}
</style>
