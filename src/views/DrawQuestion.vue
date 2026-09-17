<template>
  <div class="page">
    <!-- ========== 控制面板 ========== -->
    <section class="control-panel card">
      <div class="panel-header">
        <h2 class="panel-title">🎯 抽背控制台</h2>
        <div class="panel-stats" v-if="selectedClass">
          <span class="stat-pill">👥 {{ students.length }} 人</span>
          <span class="stat-pill" v-if="studentsWithWeight > 0" style="color:var(--warning)">⚖️ 权重加成 {{ studentsWithWeight }}</span>
          <span class="stat-pill" style="color:var(--accent)">📊 总权重 {{ totalWeight }}</span>
          <span class="stat-pill" v-if="questionPool.length" style="color:var(--accent2)">📋 已选 {{ selectedIds.size }} / {{ questionPool.length }} 篇</span>
        </div>
      </div>

      <div class="control-grid">
        <div class="ctrl-tile">
          <div class="ctrl-icon">🏫</div>
          <div class="ctrl-body">
            <label>年级</label>
            <select v-model="selectedGrade" @change="onGradeChange">
              <option value="">-- 请选择 --</option>
              <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
        </div>

        <div class="ctrl-tile">
          <div class="ctrl-icon">👪</div>
          <div class="ctrl-body">
            <label>班级</label>
            <select v-model="selectedClass" @change="onClassChange" :disabled="!selectedGrade">
              <option value="">-- 请选择 --</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>

        <div class="ctrl-tile">
          <div class="ctrl-icon">📖</div>
          <div class="ctrl-body">
            <label>学科 <span class="hint" v-if="gradeName">（{{ gradeName }}）</span></label>
            <select v-model="selectedSubject" :disabled="!selectedGrade">
              <option value="">-- 请选择 --</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
        </div>

        <div class="ctrl-tile">
          <div class="ctrl-icon">🎲</div>
          <div class="ctrl-body">
            <label>模式</label>
            <select v-model="mode">
              <option value="student">仅抽学生</option>
              <option value="recit">学生 + 背诵篇目</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 抽背范围：紧凑入口，点击弹窗选择 -->
      <div v-if="questionPool.length" class="range-entry" @click="rangeModalOpen = true">
        <span class="re-ic">📚</span>
        <span class="re-text">
          <span class="re-label">抽背范围</span>
          <span class="re-summary">已选 {{ selectedIds.size }} / {{ questionPool.length }} 篇 · {{ unitGroups.length }} 个单元</span>
        </span>
        <span class="re-btn">更改</span>
      </div>

      <!-- 抽背按钮 -->
      <div class="draw-btn-wrap">
        <button
          class="draw-btn primary"
          :disabled="!canDraw || drawing"
          @click="draw"
        >
          <span v-if="drawing" class="btn-spinner"></span>
          <span v-else class="btn-icon">🎲</span>
          <span class="btn-text">{{ drawing ? '抽取中...' : drawBtnText }}</span>
        </button>
      </div>
    </section>

    <!-- ========== 抽背舞台（空态 / 滚动表演） ========== -->
    <section ref="stageEl" class="result-area" :class="{ rolling: stage === 'rolling', lock: rollLock }">
      <template v-if="stage === 'rolling'">
        <div class="roll-frame">
          <div class="roll-rays">
            <span v-for="n in 24" :key="n" class="ray" :style="rayStyle(n)"></span>
          </div>
          <div class="roll-eyebrow"><span class="re-dot"></span>命运转盘 · 抽取中<span class="re-dot"></span></div>

          <!-- 姓名滚轮 -->
          <div class="reel name-reel">
            <div class="reel-edge left"></div>
            <div class="reel-edge right"></div>
            <div class="reel-window">
              <div class="reel-strip" ref="nameStripEl">
                <div v-for="(nm, i) in rollNames" :key="'n' + i" class="reel-item name-item">{{ nm }}</div>
              </div>
              <div class="reel-fade top"></div>
              <div class="reel-fade bottom"></div>
            </div>
            <div class="reel-line"></div>
          </div>

          <!-- 篇目滚轮 -->
          <transition name="titleReel">
            <div v-if="needSubject" class="reel title-reel">
              <div class="reel-window">
                <div class="reel-strip" ref="titleStripEl">
                  <div v-for="(t, i) in rollTitles" :key="'t' + i" class="reel-item title-item">{{ t }}</div>
                </div>
                <div class="reel-fade top"></div>
                <div class="reel-fade bottom"></div>
              </div>
              <span class="reel-tag">📖 背诵篇目</span>
            </div>
          </transition>

          <div class="roll-hint">✦ 权重越高 · 机会越大 ✦</div>
        </div>
      </template>

      <div v-else class="empty-hint">
        <div class="empty-emoji">🎯</div>
        <div class="empty-title">准备好抽背了吗？</div>
        <div class="empty-sub">选择年级、班级后，点击上方「开始抽背」</div>
        <div class="empty-tip">💡 权重越高的学生越容易被抽到，在班级管理页调整</div>
      </div>
    </section>

    <!-- ========== 历史时间轴 ========== -->
    <section class="history card">
      <div class="history-header">
        <h3>📜 本轮历史 <span class="history-count">{{ history.length }}</span></h3>
        <button v-if="history.length" class="btn-clear" @click="history = []">🗑️ 清空</button>
      </div>

      <div class="history-timeline" v-if="history.length">
        <div v-for="(h, i) in history" :key="i" class="tl-item" :class="{ latest: i === 0 }">
          <div class="tl-dot" :class="{ hot: h.weight > 1 }"></div>
          <div class="tl-line" v-if="i < history.length - 1"></div>
          <div class="tl-body">
            <div class="tl-head">
              <span class="tl-num">#{{ history.length - i }}</span>
              <span class="tl-name">{{ h.student }}</span>
              <span v-if="h.weight > 1" class="tl-weight" title="权重 {{ h.weight }}">⚖️×{{ h.weight }}</span>
              <span class="tl-action" :class="'act-' + h.action">{{ actionLabel(h.action) }}</span>
            </div>
            <div v-if="h.question" class="tl-q">📋 {{ h.question }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-timeline">
        <div class="empty-tl-emoji">⏳</div>
        本轮还没有抽背记录
      </div>
    </section>

    <!-- ========== 抽背范围弹窗 ========== -->
    <transition name="modal">
      <div v-if="rangeModalOpen" class="range-mask" @click.self="rangeModalOpen = false">
        <div class="range-modal">
          <div class="rm-topbar"></div>
          <div class="rm-header">
            <h3>📚 选择抽背范围</h3>
            <button class="modal-x" @click="rangeModalOpen = false">✕</button>
          </div>
          <div class="rm-body">
            <div class="range-head">
              <span class="range-count">已选 <b>{{ selectedIds.size }}</b> / {{ questionPool.length }} 篇</span>
              <div class="range-tools">
                <button class="range-link" @click="selectAll(true)">全选</button>
                <button class="range-link" @click="selectAll(false)">全不选</button>
              </div>
            </div>

            <div class="unit-list">
              <div v-for="g in unitGroups" :key="g.name" class="unit-group">
                <div class="unit-line">
                  <button
                    class="unit-pill"
                    :class="{ on: isUnitAll(g), partial: isUnitPartial(g) }"
                    @click="toggleUnitAll(g)"
                    :title="isUnitAll(g) ? '取消整单元' : '选中整单元'"
                  >
                    <span class="pill-check">✓</span>
                    <span class="pill-name">{{ g.name }}</span>
                    <span class="pill-count">{{ g.lessons.length }} 篇</span>
                  </button>
                  <button class="unit-caret" @click="toggleUnitExpand(g.name)" :title="expandedUnits.includes(g.name) ? '收起课文' : '展开课文'">
                    {{ expandedUnits.includes(g.name) ? '▲' : '▼' }}
                  </button>
                </div>

                <!-- 课文级勾选 -->
                <transition name="lesson-expand">
                  <div v-if="expandedUnits.includes(g.name)" class="lesson-box">
                    <div class="lesson-box-hd">
                      <span>{{ g.name }} · 勾选具体课文</span>
                      <button class="range-link" @click="toggleUnitAll(g)">{{ isUnitAll(g) ? '本单元全不选' : '本单元全选' }}</button>
                    </div>
                    <div class="lesson-chips">
                      <button
                        v-for="q in g.lessons"
                        :key="q.id"
                        class="lesson-pill"
                        :class="{ on: selectedIds.has(q.id) }"
                        @click="toggleLesson(q.id)"
                      >
                        <span class="lesson-check">{{ selectedIds.has(q.id) ? '✓' : '' }}</span>
                        {{ q.title || '未命名题目' }}
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
            </div>
          </div>
          <div class="rm-actions">
            <button @click="rangeModalOpen = false">取消</button>
            <button class="primary" @click="rangeModalOpen = false">完成</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========== 抽中结果卡片 ========== -->
    <transition name="modal">
      <div v-if="showModal" class="draw-mask">
        <transition name="rcard" appear>
          <div v-if="showModal" class="rcard" :class="{ 'only-student': mode === 'student' }">
            <!-- 礼花层 -->
            <div class="rc-burst">
              <span v-for="n in 18" :key="n" class="burst-p" :style="burstStyle(n)"></span>
            </div>
            <div class="rc-shine"></div>
            <div class="rc-head">
              <span class="seq">RESULT #{{ history.length + 1 }}</span>
              <span class="w-pill">⚖️ 权重 ×{{ currentStudent?.weight || 1 }}</span>
            </div>

            <div class="rc-body">
              <!-- 学生 -->
              <div class="hero">
                <div class="ring"></div>
                <div class="ava" :style="{ background: avatarColor(currentStudent?.name || '') }">
                  {{ (currentStudent?.name || '…').charAt(0) }}
                </div>
              </div>
              <div class="rname">{{ currentStudent?.name || '...' }}</div>
              <div class="rmeta">
                <template v-if="mode === 'student'">
                  <span>{{ gradeName }} {{ classNameDq }}</span><span class="dot-sep"></span><span>仅抽学生</span>
                </template>
                <template v-else>
                  <span>{{ gradeName }} {{ classNameDq }}</span><span class="dot-sep"></span><span>{{ subjectName }}</span>
                </template>
              </div>

              <!-- 篇目任务卡 -->
              <div v-if="currentQuestion" class="task">
                <div class="task-ic">📖</div>
                <div class="task-main">
                  <div class="task-top">
                    📚 {{ currentQuestion.unit || '未分组' }}
                    <span class="u-sep">/</span>
                    背诵篇目
                  </div>
                  <div class="task-title">{{ currentQuestion.title || '题目' }}</div>
                  <div class="task-hide">
                    <template v-if="!peekContent">
                      <span class="tag">原文已隐藏</span><span>请学生起立背诵，背完判定</span>
                    </template>
                    <template v-else>
                      <span class="tag">教师视角</span>
                    </template>
                  </div>
                </div>
              </div>

              <!-- 仅学生模式提示 -->
              <div v-if="mode === 'student'" class="mode-tag">🎲 本轮只抽学生，不绑定篇目</div>

              <!-- 题目原文区（默认隐藏，教师手动查看） -->
              <template v-if="currentQuestion">
                <template v-if="!peekContent">
                  <button class="peek-btn" @click="peekContent = true">👁 教师查看原文（E）· 投影时请勿点开</button>
                </template>

                <template v-else>
                  <span class="teacher-flag">👁 教师视角 · 原文</span>
                  <div class="codebox" :class="{ empty: !effectiveContent }">
                    <template v-if="effectiveContent">{{ effectiveContent }}</template>
                    <span v-else>暂无原文内容，可在「班级管理 → 题目」中填写，或从教材目录导入</span>
                  </div>
                  <div class="code-tools">
                    <button class="mini-link" @click="peekContent = false">🙈 隐藏原文（E）</button>
                    <span v-if="!currentQuestion.content && effectiveContent" class="mini-from">📖 原文来自教材目录</span>
                  </div>
                </template>
              </template>

              <!-- 判定按钮 -->
              <div class="actions" :class="{ three: mode === 'student' }">
                <button class="ab skip" @click="handleResult('skip')">
                  <span class="ab-i">⏭️</span><span>跳过</span><span class="ab-k">[1]</span>
                </button>
                <button class="ab absent" @click="handleResult('absent')">
                  <span class="ab-i">🙋</span><span>缺席</span><span class="ab-k">[2]</span>
                </button>
                <button v-if="mode !== 'student'" class="ab wrong" @click="handleResult('wrong')">
                  <span class="ab-i">❌</span><span>答错</span><span class="ab-k">[3]</span>
                </button>
                <button class="ab correct" @click="handleResult('correct')">
                  <span class="ab-i">✅</span><span>正确</span><span class="ab-k">[4]</span>
                </button>
              </div>
              <div class="foot-hint">
                键盘 <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> 判定 · <kbd>Enter</kbd> = 正确 · <kbd>E</kbd> 查看原文
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

// ========== 硬编码配置 ==========
const COOLDOWN_CORRECT = 2
const COOLDOWN_ABSENT = 1

// ========== 状态 ==========
const grades = ref([])
const classes = ref([])
const subjects = ref([])
const selectedGrade = ref('')
const selectedClass = ref('')
const selectedSubject = ref('')
const mode = ref('student')

const students = ref([])
const currentStudent = ref(null)
const currentQuestion = ref(null)
const drawing = ref(false)
const history = ref([])

const showModal = ref(false)
// 教师是否手动展开背诵原文（每位新人自动重置为隐藏）
const peekContent = ref(false)

// 题目池（全量）+ 选中的题目 id 集合 + 展开的单元
const questionPool = ref([])
const selectedIds = ref(new Set())
const expandedUnits = ref([])

// 范围弹窗 + 滚动舞台
const rangeModalOpen = ref(false)
const stage = ref('idle')      // idle | rolling
const rollLock = ref(false)
// 老虎机滚轮：strip 条目（最后一项为真实结果）
const rollNames = ref([])
const rollTitles = ref([])
const stageEl = ref(null)
const nameStripEl = ref(null)
const titleStripEl = ref(null)

// 滚轮条目高度（与 CSS 保持一致）
const NAME_ITEM_H = 96
const TITLE_ITEM_H = 42
// 滚动总时长（ms）——加长随机过程，约 4.2 秒
const SPIN_MS = 4200

// 教材目录（题目无原文时回退）
const catalog = ref(null)

const gradeName = computed(() => grades.value.find(g => g.id === selectedGrade.value)?.name || '')
const classNameDq = computed(() => classes.value.find(c => c.id === selectedClass.value)?.name || '')
const subjectName = computed(() => subjects.value.find(s => s.id === selectedSubject.value)?.name || '')

const studentsWithWeight = computed(() => students.value.filter(s => (s.weight || 1) > 1).length)
const totalWeight = computed(() => students.value.reduce((s, st) => s + Math.max(1, st.weight || 1), 0))

// 模式决定是否需要学科（背诵篇目模式需要）
const needSubject = computed(() => mode.value === 'recit')
// 按钮是否可点击（题目池非空时至少要选 1 篇）
const canDraw = computed(() => {
  if (!selectedClass.value) return false
  if (needSubject.value && !selectedSubject.value) return false
  if (questionPool.value.length && selectedIds.value.size === 0) return false
  return true
})

const drawBtnText = computed(() => {
  if (questionPool.value.length) return `开始抽背（从选中的 ${selectedIds.value.size} 篇中随机）`
  return '开始抽背'
})

// 单元分组（保持题目在数据库中的出现顺序；空单元名归为“未分组”）
const unitGroups = computed(() => {
  const map = new Map()
  for (const q of questionPool.value) {
    const name = q.unit || '未分组'
    if (!map.has(name)) map.set(name, [])
    map.get(name).push(q)
  }
  return [...map.entries()].map(([name, lessons]) => ({ name, lessons }))
})

// 头像渐变色（与班级管理一致的确定性配色）
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  const hues = [
    [200, 290], [10, 50], [120, 170], [280, 330], [30, 100]
  ]
  const pair = hues[Math.abs(h) % hues.length]
  const h1 = pair[0] + (Math.abs(h) % 20 - 10)
  const h2 = pair[1] + (Math.abs(h >> 4) % 20 - 10)
  return `linear-gradient(135deg, hsl(${h1}, 70%, 55%), hsl(${h2}, 70%, 45%))`
}

// ========== 工具 ==========
function actionLabel(a) {
  return { correct: '正确', wrong: '答错', absent: '缺席', skip: '跳过' }[a] || a
}

// ========== 范围选择 ==========
function isUnitAll(g) {
  return g.lessons.every(q => selectedIds.value.has(q.id))
}
function isUnitPartial(g) {
  const n = g.lessons.filter(q => selectedIds.value.has(q.id)).length
  return n > 0 && n < g.lessons.length
}
function toggleUnitAll(g) {
  const next = new Set(selectedIds.value)
  if (isUnitAll(g)) g.lessons.forEach(q => next.delete(q.id))
  else g.lessons.forEach(q => next.add(q.id))
  selectedIds.value = next
}
function toggleLesson(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
function toggleUnitExpand(name) {
  const i = expandedUnits.value.indexOf(name)
  if (i >= 0) expandedUnits.value.splice(i, 1)
  else expandedUnits.value.push(name)
}
function selectAll(on) {
  selectedIds.value = on ? new Set(questionPool.value.map(q => q.id)) : new Set()
}

// ========== 教材目录回退（兼容册别结构 {上册:{单元:[]}} 与旧结构 {单元:[]}） ==========
function catalogUnitGroups(sd, unit) {
  const VOLUME_KEYS = ['上册', '下册', '全一册']
  const volKeys = VOLUME_KEYS.filter(v => sd[v] && typeof sd[v] === 'object' && !Array.isArray(sd[v]))
  if (!volKeys.length) {
    return unit && sd[unit]
      ? [sd[unit], ...Object.entries(sd).filter(([k]) => k !== unit).map(([, v]) => v)]
      : Object.values(sd)
  }
  const preferred = []
  const rest = []
  for (const vk of volKeys) {
    const vol = sd[vk]
    if (unit && vol[unit]) preferred.push(vol[unit])
    for (const [k, arr] of Object.entries(vol)) if (k !== unit) rest.push(arr)
  }
  return [...preferred, ...rest]
}

function findCatalogContent(title, unit) {
  if (!catalog.value || !title) return ''
  const sd = catalog.value[gradeName.value]?.[subjectName.value]
  if (!sd || typeof sd !== 'object') return ''
  const groups = catalogUnitGroups(sd, unit)
  for (const arr of groups) {
    if (Array.isArray(arr)) {
      const hit = arr.find(a => a.title === title)
      if (hit) return hit.content || ''
    }
  }
  return ''
}
// 当前题目的有效原文（题目自身为空时回退教材目录）
const effectiveContent = computed(() => {
  const q = currentQuestion.value
  if (!q) return ''
  if (q.content && q.content.trim()) return q.content
  return findCatalogContent(q.title, q.unit)
})

// ========== 数据加载 ==========
async function loadGrades() {
  grades.value = await window.api.getGrades()
  if (!selectedGrade.value && grades.value.length) selectedGrade.value = grades.value[0].id
}
async function loadClasses() {
  if (!selectedGrade.value) { classes.value = []; return }
  classes.value = await window.api.getClasses(selectedGrade.value)
  if (!classes.value.find(c => c.id === selectedClass.value)) {
    selectedClass.value = classes.value[0]?.id || ''
  }
}
async function loadSubjects() {
  if (!selectedGrade.value) { subjects.value = []; selectedSubject.value = ''; return }
  subjects.value = await window.api.getSubjects(selectedGrade.value)
  if (!subjects.value.find(s => s.id === selectedSubject.value)) {
    selectedSubject.value = subjects.value[0]?.id || ''
  }
}
async function loadStudents() {
  if (!selectedClass.value) { students.value = []; return }
  students.value = await window.api.getStudents(selectedClass.value)
}
async function loadCatalogData() {
  try { catalog.value = await window.api.catalog() } catch { catalog.value = null }
}

// 按 当前学科 + 模式 拉全量题目，前端做单元/课文两级筛选与纯随机
async function loadQuestionPool() {
  if (!selectedSubject.value || mode.value === 'student') {
    questionPool.value = []
    selectedIds.value = new Set()
    expandedUnits.value = []
    return
  }
  try {
    const list = await window.api.getQuestions(selectedSubject.value, { category: 'recit' })
    questionPool.value = Array.isArray(list) ? list : []
  } catch (e) {
    questionPool.value = []
  }
  selectedIds.value = new Set(questionPool.value.map(q => q.id))
  expandedUnits.value = []
}

async function onGradeChange() {
  selectedClass.value = ''
  selectedSubject.value = ''
  await loadClasses()
  await loadSubjects()
}
async function onClassChange() { await loadStudents() }

// ========== 抽背 ==========
const wait = (ms) => new Promise(r => setTimeout(r, ms))

/** 启动滚轮：瞬间归位 → 强制回流 → 三次贝塞尔减速滚到目标格 */
function spinReel(el, distance, duration) {
  if (!el) return
  el.style.transition = 'none'
  el.style.transform = 'translateY(0)'
  void el.offsetHeight // 强制回流
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.72, 0.1, 1)`
    el.style.transform = `translateY(-${distance}px)`
  }))
}

async function draw() {
  if (!canDraw.value || drawing.value) return
  drawing.value = true
  currentStudent.value = null
  currentQuestion.value = null
  peekContent.value = false

  // 1) 先抽出真实结果（保证加权随机的真实性）
  const s = await window.api.randomStudent(selectedClass.value)
  if (!s) { drawing.value = false; return }
  let q = null
  let titleSrc = []
  if (needSubject.value && selectedSubject.value && selectedIds.value.size) {
    const pool = questionPool.value.filter(qq => selectedIds.value.has(qq.id))
    q = pool[Math.floor(Math.random() * pool.length)]
    titleSrc = pool.map(x => x.title || '未命名')
  }

  // 2) 构建滚轮条目（最后一格锁定真实结果）
  const nameSrc = students.value.length ? students.value.map(x => x.name) : ['…']
  const pick = arr => arr[Math.floor(Math.random() * arr.length)]
  const NAME_COUNT = 30
  const TITLE_COUNT = 22
  rollNames.value = Array.from({ length: NAME_COUNT - 1 }, () => pick(nameSrc)).concat(s.name)
  rollTitles.value = q
    ? Array.from({ length: TITLE_COUNT - 1 }, () => titleSrc.length ? pick(titleSrc) : '—').concat(q.title)
    : []

  // 3) 滚动表演
  stage.value = 'rolling'
  rollLock.value = false
  await nextTick()
  // 窗口较矮时把舞台滚进视野（修复“看不到滚动过程”）
  try { stageEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}

  spinReel(nameStripEl.value, (NAME_COUNT - 1) * NAME_ITEM_H, SPIN_MS)
  if (q) spinReel(titleStripEl.value, (TITLE_COUNT - 1) * TITLE_ITEM_H, SPIN_MS - 600)

  // 姓名定格
  await wait(SPIN_MS)
  rollLock.value = true
  await wait(700) // 定格停留

  // 4) 弹出结果卡片
  currentStudent.value = s
  currentQuestion.value = q
  drawing.value = false
  stage.value = 'idle'
  await nextTick()
  showModal.value = true
}

// 舞台放射光线角度
function rayStyle(n) {
  const angle = (360 / 24) * (n - 1)
  return { transform: `rotate(${angle}deg)`, animationDelay: `${((n * 7) % 8) * 0.12}s` }
}
// 结果卡片礼花
function burstStyle(n) {
  const angle = (360 / 18) * (n - 1)
  const dist = 150 + ((n * 37) % 130)
  const colors = ['#00d4ff', '#7c3aed', '#ffd166', '#19d89c', '#ff6b9d']
  return {
    '--ba': angle + 'deg',
    '--bd': dist + 'px',
    '--bc': colors[n % colors.length],
    animationDelay: `${(0.04 * (n % 6)).toFixed(2)}s`
  }
}

// ========== 弹窗按钮 ==========
async function handleResult(action) {
  if (!currentStudent.value) return
  const sid = currentStudent.value.id
  const cid = selectedClass.value

  let newWeight = currentStudent.value.weight || 1
  let newCooldown = 0

  if (action === 'correct') {
    newWeight = Math.max(1, newWeight - 2)
    newCooldown = COOLDOWN_CORRECT
  } else if (action === 'wrong') {
    newWeight = Math.min(10, newWeight + 1)
    newCooldown = 0
  } else if (action === 'absent') {
    newWeight = Math.max(1, newWeight - 1)
    newCooldown = COOLDOWN_ABSENT
  } else if (action === 'skip') {
    // 不动
  }

  // 更新数据库
  if (action !== 'skip') {
    try { await window.api.updateStudentWeight(sid, newWeight) } catch {}
    if (newCooldown > 0) {
      try { await window.api.updateStudentCooldown(sid, newCooldown) } catch {}
    }
    try { await window.api.tickCooldowns(cid) } catch {}
  }

  // 记录历史
  history.value.unshift({
    student: currentStudent.value.name,
    weight: newWeight,
    question: currentQuestion.value?.title || '',
    action
  })

  // 关闭弹窗
  showModal.value = false
  currentStudent.value = null
  currentQuestion.value = null
  peekContent.value = false

  // 刷新学生列表
  await loadStudents()
}

// ========== 键盘快捷键 ==========
function onKey(e) {
  if (!showModal.value) return
  if (e.key === '1') handleResult('skip')
  else if (e.key === '2') handleResult('absent')
  else if (e.key === '3' && mode.value !== 'student') handleResult('wrong')
  else if (e.key === '4') handleResult('correct')
  else if (e.key === 'Enter') handleResult('correct')
  else if (e.key === 'e' || e.key === 'E') peekContent.value = !peekContent.value
}

// ========== 监听 ==========
watch(selectedGrade, loadClasses)
watch(selectedGrade, loadSubjects)
watch(selectedClass, loadStudents)
watch(selectedSubject, loadQuestionPool)
watch(mode, loadQuestionPool)

onMounted(async () => {
  document.addEventListener('keydown', onKey)
  await Promise.all([loadGrades(), loadCatalogData()])
  await Promise.all([loadClasses(), loadSubjects()])
  await loadStudents()
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
/* ========== 页面基础 ========== */
.page { padding: 20px; height: 100%; overflow-y: auto; }
.panel-title { font-size: 16px; color: var(--text-main); font-weight: bold; letter-spacing: 0.5px; }

/* ========== 控制面板 ========== */
.control-panel { padding: 20px; margin-bottom: 16px; }
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; flex-wrap: wrap; gap: 10px;
}
.panel-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-pill {
  padding: 3px 12px; border-radius: 999px; font-size: 11px;
  background: var(--surface-2); color: var(--text-sub);
  border: var(--border-medium);
}

/* 控制卡片 */
.control-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  margin-bottom: 16px;
}
.ctrl-tile {
  background: var(--surface-1);
  border: var(--border-medium);
  border-radius: var(--radius-md);
  padding: 14px;
  display: flex; gap: 12px;
  transition: all 0.25s var(--ease-out);
}
.ctrl-tile:hover {
  border-color: rgba(0,212,255,0.25);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}
.ctrl-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--accent-gradient);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0,212,255,0.25);
}
.ctrl-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ctrl-body label { font-size: 10px; color: var(--text-dim); }
.ctrl-body select { padding: 6px 10px; font-size: 13px; width: 100%; }
.ctrl-body .hint { color: var(--accent); font-size: 9px; }

/* ========== 抽背范围紧凑入口 ========== */
.range-entry {
  display: flex; align-items: center; gap: 13px;
  padding: 11px 16px; margin-bottom: 16px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: var(--border-medium);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}
.range-entry:hover {
  border-color: rgba(0,212,255,0.45);
  box-shadow: 0 0 0 3px rgba(0,212,255,0.08);
}
.re-ic { font-size: 19px; }
.re-text { flex: 1; display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.re-label { font-size: 13px; font-weight: bold; color: var(--text-main); }
.re-summary { font-size: 11.5px; color: var(--text-sub); }
.re-btn {
  flex-shrink: 0; font-size: 12px; font-weight: bold;
  padding: 5px 18px; border-radius: 999px;
  color: var(--accent);
  background: rgba(0,212,255,0.1);
  border: 1px solid rgba(0,212,255,0.35);
}
.range-entry:hover .re-btn { background: var(--accent-gradient); color: #fff; border-color: transparent; }

/* ========== 抽背按钮 ========== */
.draw-btn-wrap { display: flex; justify-content: center; position: relative; padding: 10px 0; }
.draw-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 15px 40px; font-size: 16px; font-weight: bold;
  border-radius: var(--radius-lg);
  letter-spacing: 1px;
  position: relative; z-index: 2;
}
.btn-icon { font-size: 19px; }
.btn-spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ========== 抽背舞台 ========== */
.result-area {
  padding: 44px 32px; min-height: 240px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  background: var(--surface-1);
  border: var(--border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}
/* ========== 抽背舞台：老虎机滚轮 ========== */
.result-area {
  padding: 30px 32px; min-height: 300px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  background: var(--surface-1);
  border: var(--border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.result-area.rolling {
  position: relative;
  flex-direction: column;
  border-color: rgba(0,212,255,0.35);
  background:
    radial-gradient(ellipse 70% 90% at 50% 115%, rgba(124,58,237,0.18), transparent 70%),
    radial-gradient(ellipse 70% 70% at 50% -20%, rgba(0,212,255,0.16), transparent 70%),
    var(--surface-1);
  box-shadow: inset 0 0 80px rgba(0,212,255,0.07);
}
.roll-frame {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: center;
  gap: 14px; width: 100%;
}

/* 背景旋转光线 */
.roll-rays {
  position: absolute; left: 50%; top: 58%;
  width: 600px; height: 600px;
  transform: translate(-50%, -50%);
  pointer-events: none; opacity: 0.55;
  animation: raysSpin 16s linear infinite;
}
.roll-rays .ray {
  position: absolute; left: 50%; top: 50%;
  width: 2px; height: 300px;
  transform-origin: 0 0;
  background: linear-gradient(to top, rgba(0,212,255,0) 5%, rgba(0,212,255,0.28) 55%, rgba(124,58,237,0.15) 100%);
  animation: rayPulse 2.6s ease-in-out infinite;
}
@keyframes raysSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
@keyframes rayPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.85; } }

.roll-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 12px; letter-spacing: 4px; color: var(--accent);
}
.re-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: dotBlink 1s ease-in-out infinite; }
@keyframes dotBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }

/* 滚轮通用 */
.reel { position: relative; width: 100%; max-width: 660px; }
.reel-window {
  position: relative;
  height: 96px; overflow: hidden;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(0,0,0,0.38), rgba(0,0,0,0.10) 42%, rgba(0,0,0,0.10) 58%, rgba(0,0,0,0.38));
  border: 1px solid rgba(0,212,255,0.2);
  box-shadow: inset 0 0 44px rgba(0,0,0,0.5);
}
.reel-strip { will-change: transform; }
.reel-item { display: flex; align-items: center; justify-content: center; }
.name-item {
  height: 96px;
  font-size: 58px; font-weight: 800; letter-spacing: 10px;
  color: var(--text-main);
  filter: blur(2.5px);
  text-shadow: 0 0 30px rgba(0,212,255,0.4);
  white-space: nowrap;
}
.title-reel { max-width: 540px; }
.title-reel .reel-window {
  height: 42px; border-radius: 11px;
  background: linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.08) 60%, rgba(0,0,0,0.3));
}
.title-item {
  height: 42px;
  font-size: 18px; font-weight: bold; letter-spacing: 2px;
  color: var(--accent);
  filter: blur(1.5px);
  white-space: nowrap;
}
/* 上下渐隐遮罩 */
.reel-fade { position: absolute; left: 0; right: 0; height: 28px; pointer-events: none; z-index: 2; }
.reel-fade.top { top: 0; background: linear-gradient(180deg, rgba(18,18,38,0.96), rgba(18,18,38,0)); }
.reel-fade.bottom { bottom: 0; background: linear-gradient(0deg, rgba(18,18,38,0.96), rgba(18,18,38,0)); }
/* 中线与两侧指示 */
.reel-line {
  position: absolute; left: 8px; right: 8px; top: 50%;
  height: 96px; margin-top: -48px;
  border-top: 1px solid rgba(0,212,255,0.55);
  border-bottom: 1px solid rgba(0,212,255,0.55);
  border-radius: 12px;
  box-shadow: 0 0 22px rgba(0,212,255,0.25);
  pointer-events: none; z-index: 3;
}
.reel-edge {
  position: absolute; top: 50%; z-index: 4;
  width: 0; height: 0; margin-top: -9px;
  border-top: 9px solid transparent;
  border-bottom: 9px solid transparent;
  filter: drop-shadow(0 0 6px rgba(0,212,255,0.8));
  pointer-events: none;
}
.reel-edge.left { left: 14px; border-left: 13px solid var(--accent); }
.reel-edge.right { right: 14px; border-right: 13px solid var(--accent); }
.reel-tag {
  position: absolute; right: 10px; bottom: -20px;
  font-size: 10px; color: var(--text-dim); letter-spacing: 1px;
}

/* 定格态 */
.result-area.lock .reel-window {
  border-color: rgba(0,212,255,0.8);
  box-shadow: 0 0 44px rgba(0,212,255,0.35), inset 0 0 44px rgba(0,0,0,0.4);
  animation: winFlash 0.6s var(--ease-out);
}
.result-area.lock .name-item:last-child {
  filter: blur(0);
  background: linear-gradient(90deg, #00d4ff, #7c3aed, #00d4ff);
  background-size: 200% auto;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: itemLock 0.6s var(--ease-bounce), nameHue 2.2s linear infinite 0.6s;
}
.result-area.lock .title-item:last-child {
  filter: blur(0); color: #fff;
  text-shadow: 0 0 18px rgba(0,212,255,0.8);
  animation: itemLock 0.6s var(--ease-bounce);
}
@keyframes winFlash {
  0% { box-shadow: 0 0 0 rgba(0,212,255,0); }
  40% { box-shadow: 0 0 70px rgba(0,212,255,0.55), inset 0 0 44px rgba(0,0,0,0.4); }
  100% { box-shadow: 0 0 44px rgba(0,212,255,0.35), inset 0 0 44px rgba(0,0,0,0.4); }
}
@keyframes itemLock {
  0% { transform: scale(0.82); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes nameHue { to { background-position: 200% center; } }
.roll-hint { font-size: 11px; color: var(--text-dim); letter-spacing: 3px; margin-top: 4px; }

/* 空态 */
.empty-hint { text-align: center; color: var(--text-sub); }
.empty-emoji {
  font-size: 52px; margin-bottom: 14px;
  animation: floatHint 3.5s ease-in-out infinite;
  display: inline-block;
}
@keyframes floatHint { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-10px) rotate(5deg)} }
.empty-title { font-size: 16px; color: var(--text-main); margin-bottom: 6px; font-weight: bold; }
.empty-sub { font-size: 13px; color: var(--text-sub); margin-bottom: 14px; }
.empty-tip {
  font-size: 11px; color: var(--warning);
  padding: 8px 16px; border-radius: 20px;
  background: rgba(255,136,0,0.1);
  border: 1px solid rgba(255,136,0,0.2);
  display: inline-block;
}

/* ========== 抽背范围弹窗 ========== */
.range-mask {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(10, 12, 28, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.range-modal {
  position: relative;
  width: 680px; max-width: 100%;
  max-height: 86vh;
  display: flex; flex-direction: column;
  border-radius: 20px; overflow: hidden;
  background: linear-gradient(180deg, #20203c, #17172e);
  border: 1px solid var(--highlight-medium);
  box-shadow: 0 24px 70px rgba(0,0,0,0.55);
}
.rm-topbar { height: 4px; flex-shrink: 0; background: var(--accent-gradient); }
.rm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 12px; flex-shrink: 0;
}
.rm-header h3 { font-size: 16px; color: var(--text-main); }
.modal-x {
  width: 32px; height: 32px; padding: 0; border-radius: 9px;
  background: var(--surface-2); border: var(--border-medium);
  color: var(--text-sub); cursor: pointer; font-size: 13px;
}
.modal-x:hover { color: var(--danger); border-color: var(--danger); }
.rm-body { flex: 1; overflow-y: auto; padding: 4px 24px 10px; }
.rm-actions {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 24px 20px; flex-shrink: 0;
  border-top: var(--border-soft);
}
.rm-actions button { padding: 8px 26px; font-size: 13px; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* 弹窗内部：范围选择 */
.range-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px; flex-wrap: wrap; gap: 8px;
}
.range-count { font-size: 12px; color: var(--text-sub); }
.range-count b { color: var(--accent2); font-size: 14px; }
.range-tools { display: flex; align-items: center; gap: 8px; }
.range-link {
  font-size: 11px;
  padding: 4px 14px;
  border-radius: 999px;
  background: transparent;
  border: var(--border-medium);
  color: var(--text-sub);
}
.range-link:hover { color: var(--accent); border-color: var(--accent); background: rgba(0,212,255,0.08); }

.unit-list { display: flex; flex-direction: column; gap: 10px; padding-bottom: 6px; }
.unit-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.unit-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 13px; font-weight: bold;
  background: var(--bg-2);
  border: 1.5px solid var(--surface-4);
  color: var(--text-sub);
}
.unit-pill .pill-check {
  width: 15px; height: 15px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 9px; color: transparent;
  background: transparent;
  border: 1.5px solid var(--surface-4);
  transition: all 0.2s;
}
.unit-pill .pill-count {
  font-size: 10px; font-weight: normal;
  padding: 1px 7px; border-radius: 999px;
  background: var(--surface-2); color: var(--text-dim);
}
.unit-pill:hover { border-color: var(--accent); color: var(--accent); }

.unit-pill.on {
  background: var(--accent-gradient);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 5px 14px rgba(60,120,220,0.25);
}
.unit-pill.on .pill-check {
  background: rgba(255,255,255,0.25);
  border-color: rgba(255,255,255,0.6);
  color: #fff;
}
.unit-pill.on .pill-count { background: rgba(255,255,255,0.2); color: rgba(255,255,255,0.9); }

.unit-pill.partial {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(0,212,255,0.08);
}
.unit-pill.partial .pill-check {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.unit-pill.partial .pill-count { background: rgba(0,212,255,0.12); color: var(--accent); }

.unit-caret {
  width: 30px; height: 30px;
  padding: 0;
  border-radius: 999px;
  font-size: 9px;
  background: transparent;
  border: var(--border-medium);
  color: var(--text-dim);
}
.unit-caret:hover { color: var(--accent); border-color: var(--accent); }

.lesson-box {
  margin-top: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: var(--border-soft);
}
.lesson-box-hd {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
  font-size: 11px; color: var(--text-dim);
}
.lesson-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.lesson-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--bg-1);
  border: 1px solid var(--surface-4);
  color: var(--text-sub);
}
.lesson-check {
  width: 14px; height: 14px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 8px;
  border: 1.5px solid var(--surface-4);
  color: transparent;
  transition: all 0.2s;
}
.lesson-pill:hover { border-color: var(--accent2); color: var(--accent2); }
.lesson-pill.on {
  background: rgba(124,58,237,0.1);
  border-color: rgba(124,58,237,0.45);
  color: var(--accent2);
  font-weight: bold;
}
.lesson-pill.on .lesson-check {
  background: var(--accent2);
  border-color: var(--accent2);
  color: #fff;
}
.lesson-expand-enter-active { transition: all 0.25s var(--ease-out); }
.lesson-expand-leave-active { transition: all 0.18s ease-in; }
.lesson-expand-enter-from, .lesson-expand-leave-to { opacity: 0; transform: translateY(-6px); }

/* ========== 结果卡片遮罩 ========== */
.draw-mask {
  position: fixed; inset: 0;
  background: rgba(10, 12, 28, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

/* ========== 结果卡片 ========== */
.rcard {
  position: relative;
  width: 472px; max-width: 100%;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(165deg, #242444 0%, #181832 60%, #14142b 100%);
  border: 1px solid var(--highlight-medium);
  box-shadow: 0 30px 80px rgba(0,0,0,0.55);
}
.rcard::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(220px 160px at 80% -20px, rgba(124,58,237,0.18), transparent 70%),
    radial-gradient(200px 140px at 0% 30%, rgba(0,212,255,0.12), transparent 70%);
}
/* 礼花层 */
.rc-burst { position: absolute; inset: 0; pointer-events: none; z-index: 6; overflow: visible; }
.burst-p {
  position: absolute; left: 50%; top: 120px;
  width: 8px; height: 8px; border-radius: 2px;
  background: var(--bc);
  box-shadow: 0 0 10px var(--bc);
  opacity: 0;
  animation: burstFly 0.95s cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
}
@keyframes burstFly {
  0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
  100% {
    transform: translate(calc(-50% + cos(var(--ba)) * var(--bd)), calc(-50% + sin(var(--ba)) * var(--bd))) rotate(540deg) scale(0.2);
    opacity: 0;
  }
}
/* 扫光 */
.rc-shine {
  position: absolute; top: -20%; bottom: -20%; width: 90px; z-index: 5;
  pointer-events: none;
  background: linear-gradient(105deg, transparent, rgba(255,255,255,0.16), transparent);
  transform: skewX(-18deg);
  animation: cardShine 3.4s ease-in-out 0.55s infinite;
}
@keyframes cardShine {
  0% { left: -15%; opacity: 0; }
  8% { opacity: 1; }
  26% { left: 112%; opacity: 0; }
  100% { left: 112%; opacity: 0; }
}
/* 头像光环呼吸 + 入场交错 */
.hero::before {
  content: ''; position: absolute; inset: -14px; border-radius: 50%;
  border: 2px solid rgba(0,212,255,0.4);
  animation: heroPulse 2s ease-out infinite;
  pointer-events: none;
}
@keyframes heroPulse {
  0% { transform: scale(0.85); opacity: 0.9; }
  100% { transform: scale(1.35); opacity: 0; }
}
.rcard-enter-active { animation: rcardIn 0.5s cubic-bezier(.34,1.4,.64,1); }
.rcard-enter-active .task { animation: riseIn 0.5s var(--ease-out) 0.22s both; }
.rcard-enter-active .codebox,
.rcard-enter-active .peek-btn,
.rcard-enter-active .mode-tag { animation: riseIn 0.5s var(--ease-out) 0.3s both; }
.rcard-enter-active .actions { animation: riseIn 0.5s var(--ease-out) 0.38s both; }
.rcard-enter-active .foot-hint { animation: riseIn 0.4s var(--ease-out) 0.48s both; }
@keyframes riseIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
.rcard-leave-active { animation: rcardOut 0.2s ease-in; }
@keyframes rcardIn {
  from { opacity: 0; transform: translateY(18px) scale(.94); }
}
@keyframes rcardOut { to { transform: scale(.95); opacity: 0; } }

.rc-head {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 26px 0;
}
.seq { font-size: 10px; color: var(--text-dim); letter-spacing: 1.5px; font-family: Consolas; }
.w-pill {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: bold;
  padding: 4px 12px; border-radius: 999px;
  color: #ffb048;
  background: rgba(255,136,0,0.12);
  border: 1px solid rgba(255,136,0,0.3);
}
.rc-body {
  position: relative; z-index: 2;
  padding: 12px 28px 24px;
  display: flex; flex-direction: column; align-items: center;
}

/* 头像光环 */
.hero { position: relative; width: 104px; height: 104px; margin: 6px 0 12px; }
.hero .ring {
  position: absolute; inset: -6px; border-radius: 50%;
  background: conic-gradient(from 0deg, #00d4ff, #7c3aed, #00d4ff);
  animation: ringSpin 5s linear infinite;
}
@keyframes ringSpin { to { transform: rotate(360deg); } }
.hero .ring::after {
  content: ''; position: absolute; inset: 5px; border-radius: 50%;
  background: linear-gradient(165deg, #242444, #14142b);
}
.hero .ava {
  position: absolute; inset: 9px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 38px; font-weight: 800; color: #fff;
  box-shadow: 0 10px 28px rgba(0,0,0,0.35);
}
.rname {
  font-size: 35px; font-weight: 800; letter-spacing: 5px;
  color: var(--text-main);
}
.rmeta { margin-top: 8px; font-size: 11.5px; color: var(--text-dim); display: flex; gap: 8px; align-items: center; }
.dot-sep { width: 3px; height: 3px; border-radius: 50%; background: var(--text-dim); }

/* 篇目任务卡 */
.task {
  width: 100%; margin-top: 18px;
  display: flex; gap: 14px; align-items: stretch;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(0,212,255,0.10), rgba(124,58,237,0.14));
  border: 1px solid var(--highlight-medium);
}
.task-ic {
  width: 46px; height: 46px; flex-shrink: 0; border-radius: 13px;
  background: var(--accent-gradient);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
  box-shadow: 0 8px 18px rgba(60,120,220,0.3);
}
.task-main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.task-top { display: flex; align-items: center; gap: 7px; font-size: 10.5px; color: var(--accent); font-weight: bold; }
.task-top .u-sep { color: var(--text-dim); font-weight: normal; }
.task-title { font-size: 19px; font-weight: 800; color: var(--text-main); letter-spacing: 1px; }
.task-hide { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--text-sub); }
.task-hide .tag {
  font-size: 10px; padding: 2px 8px; border-radius: 6px;
  border: 1px dashed var(--highlight-medium); color: var(--text-dim);
}

.mode-tag {
  margin-top: 18px; width: 100%;
  text-align: center; font-size: 12px; color: var(--text-sub);
  padding: 12px; border-radius: 12px;
  background: var(--surface-1); border: 1px dashed var(--highlight-medium);
}

/* 教师查看原文 */
.peek-btn {
  margin-top: 18px; width: 100%;
  padding: 11px;
  border-radius: 11px;
  font-size: 12.5px;
  background: var(--surface-2);
  border: var(--border-medium);
  color: var(--text-sub);
}
.peek-btn:hover { color: var(--accent); border-color: var(--accent); }

.teacher-flag {
  align-self: flex-start;
  font-size: 10.5px; font-weight: bold; color: #fff;
  background: var(--warning); border-radius: 7px;
  padding: 3px 10px; margin: 16px 0 9px;
}
.codebox {
  width: 100%; max-height: 210px; overflow-y: auto;
  background: rgba(0,0,0,0.22);
  border: 1px solid var(--highlight-soft);
  border-radius: 14px;
  padding: 15px 17px;
  font-size: 13.5px; line-height: 1.95;
  color: var(--text-sub);
  white-space: pre-wrap; word-break: break-word;
}
.codebox.empty { color: var(--text-dim); font-size: 12px; text-align: center; }
.codebox::-webkit-scrollbar { width: 6px; }
.codebox::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 3px; }
.code-tools { width: 100%; display: flex; align-items: center; margin-top: 9px; }
.mini-link {
  background: transparent; border: 0; cursor: pointer;
  font-size: 11px; color: var(--text-dim); padding: 0;
}
.mini-link:hover { color: var(--accent); }
.mini-from { margin-left: auto; font-size: 10px; color: var(--text-dim); }

/* 判定按钮 */
.actions {
  width: 100%;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px;
  margin-top: 20px;
}
.actions.three { grid-template-columns: repeat(3, 1fr); }
.ab {
  border-radius: 14px;
  padding: 12px 4px 10px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-size: 12px; font-weight: bold;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.18s, box-shadow 0.18s;
}
.ab .ab-i { font-size: 19px; }
.ab .ab-k { font-size: 9px; font-weight: normal; opacity: 0.55; font-family: Consolas; }
.ab:hover { transform: translateY(-3px); }
.ab:active { transform: translateY(0); }

.ab.skip { background: rgba(140,145,170,0.12); border-color: rgba(140,145,170,0.22); color: #aab0cc; }
.ab.absent { background: rgba(255,90,90,0.10); border-color: rgba(255,90,90,0.38); color: var(--danger); }
.ab.wrong { background: rgba(255,136,0,0.10); border-color: rgba(255,136,0,0.38); color: var(--warning); }
.ab.correct {
  background: linear-gradient(135deg, #19d89c, #0cb97e);
  color: #fff;
  box-shadow: 0 10px 24px rgba(16,200,140,0.35);
}

.foot-hint { margin-top: 13px; font-size: 10px; color: var(--text-dim); text-align: center; }
.foot-hint kbd {
  font-family: Consolas; background: var(--surface-2); border: 1px solid var(--highlight-medium);
  border-radius: 5px; padding: 1px 6px; margin: 0 2px;
}

/* ========== 历史时间轴 ========== */
.history { padding: 18px; }
.history-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.history-header h3 { font-size: 13px; color: var(--text-sub); display: flex; align-items: center; gap: 8px; }
.history-count {
  display: inline-flex; min-width: 22px; height: 22px;
  padding: 0 7px; border-radius: 11px;
  background: rgba(0,212,255,0.2); color: var(--accent);
  font-size: 11px; font-weight: bold;
  align-items: center; justify-content: center;
}
.btn-clear {
  font-size: 11px; padding: 4px 10px;
  background: rgba(255,102,102,0.1); color: var(--danger);
  border: 1px solid rgba(255,102,102,0.2);
  border-radius: 6px;
}
.btn-clear:hover { background: rgba(255,102,102,0.2); box-shadow: var(--shadow-glow-danger); }

.history-timeline { padding: 4px 0; }
.tl-item { display: flex; gap: 12px; position: relative; padding: 8px 0; }
.tl-item.latest { animation: latestSlide 0.5s var(--ease-bounce); }
@keyframes latestSlide {
  0% { opacity: 0; transform: translateX(-20px); }
  100% { opacity: 1; transform: translateX(0); }
}
.tl-dot {
  flex-shrink: 0; width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--text-dim);
  border: 2px solid var(--bg-1);
  box-shadow: 0 0 0 2px var(--outline-soft);
  margin-top: 8px; position: relative; z-index: 2;
}
.tl-item.latest .tl-dot {
  background: var(--accent);
  box-shadow: 0 0 0 2px rgba(0,212,255,0.15), 0 0 10px var(--accent);
  animation: dotPop 0.5s var(--ease-bounce);
}
.tl-dot.hot { background: var(--warning); box-shadow: 0 0 0 2px rgba(255,136,0,0.2), 0 0 8px var(--warning); }
@keyframes dotPop {
  0% { transform: scale(0.5); }
  100% { transform: scale(1); }
}
.tl-line {
  position: absolute; left: 5px; top: 24px;
  width: 2px; height: calc(100% - 8px);
  background: linear-gradient(180deg, var(--highlight-strong), var(--highlight-soft));
  z-index: 1;
}
.tl-body { flex: 1; padding: 6px 14px; border-radius: var(--radius-sm); transition: background 0.2s; }
.tl-item.latest .tl-body { background: rgba(0,212,255,0.08); border-left: 2px solid var(--accent); }
.tl-body:hover { background: var(--surface-1); }
.tl-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tl-num { font-size: 10px; color: var(--text-dim); font-family: Consolas; }
.tl-name { font-size: 13px; color: var(--text-main); font-weight: 500; }
.tl-weight {
  font-size: 10px; color: var(--warning);
  padding: 1px 6px; border-radius: 8px;
  background: rgba(255,136,0,0.12);
}
.tl-action { font-size: 10px; font-weight: 500; padding: 1px 7px; border-radius: 8px; }
.tl-action.act-correct { background: rgba(0,220,130,0.15); color: #00e082; }
.tl-action.act-wrong   { background: rgba(255,136,0,0.15); color: var(--warning); }
.tl-action.act-absent  { background: rgba(255,80,80,0.15);   color: var(--danger); }
.tl-action.act-skip    { background: rgba(150,150,150,0.15); color: #aaa; }
.tl-q { margin-top: 4px; font-size: 11px; color: var(--text-sub); line-height: 1.5; }
.empty-timeline { text-align: center; padding: 24px; color: var(--text-dim); font-size: 12px; }
.empty-tl-emoji { font-size: 28px; margin-bottom: 6px; }

/* ========== 浅色主题：弹窗/卡片高对比覆盖 ========== */
html[data-theme-mode='light'] .range-mask,
html[data-theme-mode='light'] .draw-mask { background: rgba(18, 24, 44, 0.45); }
html[data-theme-mode='light'] .reel-fade.top { background: linear-gradient(180deg, rgba(244,247,252,0.97), rgba(244,247,252,0)); }
html[data-theme-mode='light'] .reel-fade.bottom { background: linear-gradient(0deg, rgba(244,247,252,0.97), rgba(244,247,252,0)); }
html[data-theme-mode='light'] .reel-window {
  background: linear-gradient(180deg, rgba(244,247,252,0.95), rgba(244,247,252,0.5) 42%, rgba(244,247,252,0.5) 58%, rgba(244,247,252,0.95));
  border-color: rgba(10,147,173,0.25);
}
html[data-theme-mode='light'] .name-item { color: #1d2433; }
html[data-theme-mode='light'] .title-item { color: #0a93ad; }
html[data-theme-mode='light'] .range-modal {
  background: #ffffff;
  border-color: #e6eaf3;
  box-shadow: 0 28px 80px rgba(20,30,60,0.28);
}
html[data-theme-mode='light'] .rcard {
  background: #ffffff;
  border-color: #e6eaf3;
  box-shadow: 0 28px 80px rgba(20,30,60,0.28);
}
html[data-theme-mode='light'] .hero .ring::after { background: #fff; }
html[data-theme-mode='light'] .rname { color: #1d2433; }
html[data-theme-mode='light'] .task {
  background: linear-gradient(135deg, #f0faff, #f6f2ff);
  border-color: #e3e9f5;
}
html[data-theme-mode='light'] .task-top { color: #0a93ad; }
html[data-theme-mode='light'] .task-title { color: #1d2436; }
html[data-theme-mode='light'] .peek-btn { background: #f7f9fd; border-color: #d7def0; color: #59627a; }
html[data-theme-mode='light'] .codebox { background: #fafbfe; border-color: #e6eaf3; color: #333c52; }
html[data-theme-mode='light'] .ab.skip { background: #f2f4f8; border-color: #e3e7f0; color: #7a8398; }
html[data-theme-mode='light'] .ab.absent { background: #ffeff0; border-color: #fbd2d4; color: #e0434c; }
html[data-theme-mode='light'] .ab.wrong { background: #fff5ea; border-color: #f7dcb8; color: #d97a12; }
html[data-theme-mode='light'] .modal-x { background: #f7f9fd; border-color: #e3e7f0; color: #7a8398; }

/* ========== 响应式 ========== */
@media (max-width: 900px) {
  .control-grid { grid-template-columns: repeat(2, 1fr); }
  .name-item { font-size: 40px; letter-spacing: 5px; }
}
@media (max-width: 560px) {
  .actions { grid-template-columns: repeat(2, 1fr); }
  .actions.three { grid-template-columns: repeat(3, 1fr); }
}
</style>
