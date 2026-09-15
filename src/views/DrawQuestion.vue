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
          <span class="stat-pill" v-if="questionPoolSize" style="color:var(--accent2)">📋 题目池 {{ questionPoolSize }}</span>
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
            <select v-model="selectedSubject" @change="onSubjectChange" :disabled="!selectedGrade">
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
              <option value="custom">学生 + 自定义题库</option>
              <option value="all">全部</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 单元筛选条 -->
      <div v-if="unitList.length > 0 && mode !== 'student'" class="unit-filter">
        <div class="unit-filter-label">📚 单元筛选</div>
        <div class="unit-chip-row">
          <button
            v-for="u in unitList"
            :key="u.id"
            class="unit-chip"
            :class="{ checked: selectedUnits.includes(u.id) }"
            @click="toggleUnit(u.id)"
          >
            <span class="chip-check">{{ selectedUnits.includes(u.id) ? '✓' : '' }}</span>
            {{ u.name || u.title || '未命名单元' }}
          </button>
          <button class="unit-chip select-all" @click="toggleAllUnits">
            {{ selectedUnits.length === unitList.length ? '全不选' : '全选' }}
          </button>
        </div>
      </div>

      <!-- 抽背按钮 -->
      <div class="draw-btn-wrap">
        <div class="draw-btn-glow" :class="{ active: !canDraw }" :style="{ '--count': 8 }"></div>
        <button
          class="draw-btn primary"
          :disabled="!canDraw || drawing"
          @click="draw"
        >
          <span v-if="drawing" class="btn-spinner"></span>
          <span v-else class="btn-icon">🎲</span>
          <span class="btn-text">{{ drawing ? '抽取中...' : '开始抽背' }}</span>
        </button>
      </div>
    </section>

    <!-- ========== 结果展示区（空态提示） ========== -->
    <section class="result-area">
      <div class="empty-hint">
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

    <!-- ========== 抽背弹窗 ========== -->
    <transition name="modal">
      <div v-if="showModal" class="modal-mask" @mousedown.self="onModalMaskDown">
        <transition name="modal-card" appear>
          <div v-if="showModal" class="modal-card" :class="{ revealing: exploded }">
            <!-- 彩虹流光边框 -->
            <div class="card-border"></div>

            <!-- 粒子爆炸层 -->
            <transition name="particles">
              <div v-if="exploded" class="particle-field">
                <span
                  v-for="i in 12"
                  :key="i"
                  class="particle"
                  :style="particleStyle(i)"
                ></span>
              </div>
            </transition>

            <div class="modal-inner">
              <!-- 学生 -->
              <div class="modal-student">
                <div class="student-emoji">🎓</div>
                <div class="student-name">{{ currentStudent?.name || '...' }}</div>
              </div>

              <!-- 单元 + 篇目 chips -->
              <div v-if="currentQuestion" class="modal-chips">
                <span v-if="currentQuestion.unit_name || currentQuestion.unit" class="q-chip unit">
                  📚 {{ currentQuestion.unit_name || currentQuestion.unit }}
                </span>
                <span class="q-chip title">
                  📖 {{ currentQuestion.title || '题目' }}
                </span>
              </div>

              <!-- 课文全文 -->
              <div v-if="currentQuestion?.content" class="modal-content">
                <div class="content-text">{{ currentQuestion.content }}</div>
              </div>

              <!-- 四按钮 -->
              <div class="modal-actions">
                <button class="act-btn skip" @click="handleResult('skip')">
                  <span class="act-icon">⏭️</span>
                  <span class="act-label">跳过</span>
                </button>
                <button class="act-btn wrong" @click="handleResult('wrong')">
                  <span class="act-icon">✖️</span>
                  <span class="act-label">答错</span>
                </button>
                <button class="act-btn absent" @click="handleResult('absent')">
                  <span class="act-icon">🙋</span>
                  <span class="act-label">缺席</span>
                </button>
                <button class="act-btn correct" @click="handleResult('correct')">
                  <span class="act-icon">✅</span>
                  <span class="act-label">正确</span>
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'

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
const exploded = ref(false)
const history = ref([])

const showModal = ref(false)
const selectedUnits = ref([])
const unitList = ref([])

const gradeName = computed(() => grades.value.find(g => g.id === selectedGrade.value)?.name || '')
const className = computed(() => classes.value.find(c => c.id === selectedClass.value)?.name || '')

const studentsWithWeight = computed(() => students.value.filter(s => (s.weight || 1) > 1).length)
const totalWeight = computed(() => students.value.reduce((s, st) => s + Math.max(1, st.weight || 1), 0))

// 模式决定是否需要学科
const needSubject = computed(() => ['recit', 'custom', 'all'].includes(mode.value))
// 按钮是否可点击
const canDraw = computed(() => selectedClass.value && (!needSubject.value || selectedSubject.value))

// 当前题目池大小（仅作显示）
const questionPoolSize = computed(() => {
  if (!selectedSubject.value) return 0
  if (mode.value === 'student') return 0
  // 返回 unitList 数量作粗略估算（不额外请求，够用）
  if (selectedUnits.value.length === 0 && unitList.value.length > 0) return 0
  return 0  // 精确数字可后续从 getQuestions 拉
})

// ========== 工具 ==========
function actionLabel(a) {
  return { correct: '正确', wrong: '答错', absent: '缺席', skip: '跳过' }[a] || a
}

function particleStyle(i) {
  const angle = (i / 12) * 2 * Math.PI
  const dist = 100 + Math.random() * 80
  const dx = Math.cos(angle) * dist
  const dy = Math.sin(angle) * dist
  const delay = Math.random() * 0.15
  const size = 6 + Math.random() * 10
  const hue = (i * 30) % 360
  return {
    '--dx': dx + 'px',
    '--dy': dy + 'px',
    '--delay': delay + 's',
    '--size': size + 'px',
    '--hue': hue
  }
}

// ========== 数据加载 ==========
async function loadGrades() {
  grades.value = await window.api.getGrades()
  if (!selectedGrade.value && grades.value.length) selectedGrade.value = grades.value[0].id
}
async function loadClasses() {
  if (!selectedGrade.value) { classes.value = []; return }
  classes.value = await window.api.getClasses(selectedGrade.value)
  if (!selectedClass.value && classes.value.length) selectedClass.value = classes.value[0].id
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
async function loadUnits() {
  if (!selectedSubject.value) { unitList.value = []; selectedUnits.value = []; return }
  try {
    const list = await window.api.getUnits(selectedSubject.value, 'recit')
    unitList.value = Array.isArray(list) ? list : []
    selectedUnits.value = unitList.value.map(u => u.id)
  } catch (e) {
    unitList.value = []
    selectedUnits.value = []
  }
}

function toggleUnit(id) {
  const i = selectedUnits.value.indexOf(id)
  if (i >= 0) selectedUnits.value.splice(i, 1)
  else selectedUnits.value.push(id)
}
function toggleAllUnits() {
  if (selectedUnits.value.length === unitList.value.length) {
    selectedUnits.value = []
  } else {
    selectedUnits.value = unitList.value.map(u => u.id)
  }
}

async function onGradeChange() {
  selectedClass.value = ''
  selectedSubject.value = ''
  await loadClasses()
  await loadSubjects()
}
async function onClassChange() { await loadStudents() }
async function onSubjectChange() { await loadUnits() }

// ========== 抽背 ==========
async function draw() {
  if (!canDraw.value || drawing.value) return
  drawing.value = true
  exploded.value = false
  currentStudent.value = null
  currentQuestion.value = null

  // 短暂洗牌 delay
  await new Promise(r => setTimeout(r, 700))

  await doReveal()
}

async function doReveal() {
  drawing.value = false

  // 抽学生
  const s = await window.api.randomStudent(selectedClass.value)
  currentStudent.value = s

  // 抽题目
  let q = null
  if (needSubject.value && selectedSubject.value) {
    const qOptions = {}
    if (mode.value === 'recit') qOptions.category = 'recit'
    if (mode.value === 'custom') qOptions.category = 'custom'
    if (mode.value === 'all') qOptions.category = undefined
    if (selectedUnits.value.length) qOptions.units = selectedUnits.value
    try {
      q = await window.api.randomQuestion(selectedSubject.value, qOptions)
    } catch {
      q = await window.api.randomQuestion(selectedSubject.value)
    }
    currentQuestion.value = q
  }

  // 打开弹窗 + 触发粒子爆炸
  await nextTick()
  showModal.value = true
  exploded.value = true
  setTimeout(() => { exploded.value = false }, 1100)
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

  // 刷新学生列表
  await loadStudents()
}

function onModalMaskDown() {
  // 遮罩点击不关闭，必须点底部按钮
}

// ========== 监听 ==========
watch(selectedGrade, loadClasses)
watch(selectedGrade, loadSubjects)
watch(selectedClass, loadStudents)
watch(selectedSubject, loadUnits)

onMounted(async () => {
  await loadGrades()
  await Promise.all([loadClasses(), loadSubjects()])
  await loadStudents()
})
</script>

<style scoped>
/* ========== 页面基础 ========== */
.page { padding: 20px; height: 100%; overflow-y: auto; }
.panel-title { font-size: 16px; color: #fff; font-weight: bold; letter-spacing: 0.5px; }

/* ========== 控制面板 ========== */
.control-panel { padding: 20px; margin-bottom: 16px; }
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; flex-wrap: wrap; gap: 10px;
}
.panel-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-pill {
  padding: 3px 12px; border-radius: 999px; font-size: 11px;
  background: var(--surface-3); color: var(--text-sub);
  border: var(--border-medium);
}

/* 控制卡片 */
.control-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  margin-bottom: 16px;
}
.ctrl-tile {
  background: linear-gradient(145deg, rgba(30,30,54,0.7), rgba(15,15,32,0.6));
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px;
  display: flex; gap: 12px;
  transition: all 0.25s var(--ease-out);
}
.ctrl-tile:hover {
  border-color: rgba(0,212,255,0.25);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.ctrl-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--accent-gradient);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0,212,255,0.3);
}
.ctrl-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ctrl-body label { font-size: 10px; color: var(--text-dim); }
.ctrl-body select { padding: 6px 10px; font-size: 13px; width: 100%; }
.ctrl-body .hint { color: var(--accent); font-size: 9px; }

/* ========== 单元筛选条 ========== */
.unit-filter {
  margin-bottom: 16px;
  padding: 12px 14px;
  background: linear-gradient(145deg, rgba(30,30,54,0.5), rgba(15,15,32,0.4));
  border: var(--border-subtle);
  border-radius: var(--radius-md);
}
.unit-filter-label {
  font-size: 11px; color: var(--text-dim);
  margin-bottom: 8px;
}
.unit-chip-row {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.unit-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; font-size: 12px;
  border-radius: 20px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
}
.unit-chip:hover {
  border-color: rgba(0,212,255,0.3);
  color: #fff;
}
.unit-chip.checked {
  background: rgba(0,212,255,0.15);
  border-color: rgba(0,212,255,0.4);
  color: var(--accent);
}
.unit-chip.select-all {
  border-style: dashed;
}
.chip-check {
  font-weight: bold; font-size: 11px; width: 12px;
  color: var(--accent);
}

/* ========== 抽背按钮 ========== */
.draw-btn-wrap { display: flex; justify-content: center; position: relative; padding: 10px 0; }
.draw-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 16px 40px; font-size: 17px; font-weight: bold;
  border-radius: var(--radius-lg);
  letter-spacing: 2px;
  animation: btnPulse 2.5s ease-in-out infinite;
  position: relative; z-index: 2;
}
.btn-icon { font-size: 20px; }
.btn-spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}
@keyframes btnPulse {
  0%, 100% { box-shadow: 0 4px 24px rgba(0,212,255,0.4); }
  50% { box-shadow: 0 4px 36px rgba(124,58,237,0.5); }
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 外圈光束旋转 */
.draw-btn-glow {
  position: absolute; top: 50%; left: 50%;
  width: calc(100% + 20px); height: calc(100% + 20px);
  transform: translate(-50%, -50%);
  border-radius: var(--radius-lg);
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(0,212,255,0.4) 40deg,
    transparent 80deg,
    transparent 180deg,
    rgba(124,58,237,0.4) 220deg,
    transparent 260deg,
    transparent 360deg
  );
  animation: glowSpin 3s linear infinite;
  z-index: 1;
  filter: blur(6px);
  opacity: 0.8;
}
.draw-btn-glow.active { opacity: 0.25; animation-play-state: paused; }
@keyframes glowSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }

/* ========== 结果展示区（空态） ========== */
.result-area {
  padding: 48px 32px; min-height: 240px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  background: radial-gradient(ellipse at center, rgba(124,58,237,0.08) 0%, transparent 60%),
              linear-gradient(135deg, rgba(13,13,24,0.9), rgba(26,26,46,0.9));
  border: var(--border-subtle);
  border-radius: var(--radius-md);
}

.empty-hint { text-align: center; color: var(--text-sub); }
.empty-emoji {
  font-size: 56px; margin-bottom: 16px;
  animation: floatHint 3.5s ease-in-out infinite;
  display: inline-block;
}
@keyframes floatHint { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-10px) rotate(5deg)} }
.empty-title { font-size: 16px; color: #fff; margin-bottom: 6px; }
.empty-sub { font-size: 13px; color: var(--text-sub); margin-bottom: 14px; }
.empty-tip {
  font-size: 11px; color: var(--warning);
  padding: 8px 16px; border-radius: 20px;
  background: rgba(255,136,0,0.1);
  border: 1px solid rgba(255,136,0,0.2);
  display: inline-block;
}

/* ========== 抽背弹窗 ========== */
.modal-mask {
  position: fixed; inset: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.modal-enter-active { transition: opacity 0.3s ease; }
.modal-leave-active { transition: opacity 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

.modal-card {
  position: relative;
  width: 500px; max-width: 100%;
  border-radius: 20px;
  background: linear-gradient(145deg, #1e1e36, #0f0f20);
  padding: 36px 40px 28px;
  overflow: hidden;
  animation: modalCardEnter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
@keyframes modalCardEnter {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* 彩虹流光边框 */
.modal-card .card-border {
  position: absolute; inset: -2px; border-radius: 22px;
  background: conic-gradient(
    from 0deg,
    #00d4ff, #7c3aed, #ff3d8a, #ff8800, #00ff88, #00d4ff
  );
  animation: rainbowSpin 4s linear infinite;
  z-index: 0;
  filter: blur(1px);
}
@keyframes rainbowSpin { to { transform: rotate(360deg); } }

.modal-inner {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
}

/* 学生区 */
.modal-student { text-align: center; margin-bottom: 4px; }
.modal-student .student-emoji {
  font-size: 48px; margin-bottom: 8px;
  display: inline-block;
}
.modal-student .student-name {
  font-size: 40px; font-weight: bold;
  letter-spacing: 4px;
  background: linear-gradient(135deg, #00d4ff, #7c3aed, #00d4ff);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: gradientFlow 3s linear infinite, nameReveal 0.6s ease-out;
}
@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes nameReveal {
  0% { filter: blur(12px); opacity: 0; transform: scale(0.8); letter-spacing: 10px; }
  100% { filter: blur(0); opacity: 1; transform: scale(1); letter-spacing: 4px; }
}

/* chips */
.modal-chips {
  display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
}
.q-chip {
  padding: 4px 14px;
  font-size: 13px;
  border-radius: 20px;
  border: 1px solid;
}
.q-chip.unit {
  background: rgba(0,212,255,0.1);
  border-color: rgba(0,212,255,0.3);
  color: var(--accent);
}
.q-chip.title {
  background: rgba(124,58,237,0.15);
  border-color: rgba(124,58,237,0.4);
  color: #b388ff;
}

/* 课文全文区域 */
.modal-content {
  width: 100%;
  max-height: 220px;
  overflow-y: auto;
  padding: 14px 16px;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-sizing: border-box;
}
.modal-content::-webkit-scrollbar { width: 6px; }
.modal-content::-webkit-scrollbar-thumb {
  background: rgba(0,212,255,0.3); border-radius: 3px;
}
.modal-content .content-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-sub);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 四按钮 */
.modal-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}
.act-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  padding: 12px 6px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.act-btn .act-icon { font-size: 20px; }
.act-btn:hover { transform: translateY(-2px); }
.act-btn:active { transform: translateY(0); }

.act-btn.skip {
  background: rgba(150,150,150,0.12);
  border-color: rgba(150,150,150,0.25);
  color: #bbb;
}
.act-btn.skip:hover { background: rgba(150,150,150,0.22); }

.act-btn.wrong {
  background: rgba(255,136,0,0.12);
  border-color: rgba(255,136,0,0.35);
  color: var(--warning);
}
.act-btn.wrong:hover { background: rgba(255,136,0,0.25); box-shadow: 0 4px 16px rgba(255,136,0,0.25); }

.act-btn.absent {
  background: rgba(255,80,80,0.12);
  border-color: rgba(255,80,80,0.35);
  color: var(--danger);
}
.act-btn.absent:hover { background: rgba(255,80,80,0.25); box-shadow: 0 4px 16px rgba(255,80,80,0.25); }

.act-btn.correct {
  background: rgba(0,220,130,0.12);
  border-color: rgba(0,220,130,0.35);
  color: #00e082;
}
.act-btn.correct:hover { background: rgba(0,220,130,0.25); box-shadow: 0 4px 16px rgba(0,220,130,0.25); }

/* ========== 粒子爆炸 ========== */
.particle-field {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none; z-index: 5;
}
.particle {
  position: absolute;
  width: var(--size); height: var(--size);
  border-radius: 50%;
  background: hsl(var(--hue), 90%, 60%);
  box-shadow: 0 0 calc(var(--size) * 1.5) hsl(var(--hue), 90%, 60%);
  animation: particleFly 1s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  animation-delay: var(--delay);
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
}
@keyframes particleFly {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0); opacity: 0; }
}
.particles-enter-active { animation: particleFieldIn 0.05s linear; }
.particles-leave-active { animation: particleFieldOut 0.2s linear; }
.particles-leave-to { opacity: 0; }
@keyframes particleFieldIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes particleFieldOut { from { opacity: 1; } to { opacity: 0; } }

/* ========== 历史时间轴 ========== */
.history { padding: 18px; }
.history-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.history-header h3 { font-size: 13px; color: var(--text-sub); display: flex; align-items: center; gap: 8px; }
.history-count {
  display: inline-block; min-width: 22px; height: 22px;
  padding: 0 7px; border-radius: 11px;
  background: rgba(0,212,255,0.2); color: var(--accent);
  font-size: 11px; font-weight: bold;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn-clear {
  font-size: 11px; padding: 4px 10px;
  background: rgba(255,102,102,0.1); color: var(--danger);
  border: 1px solid rgba(255,102,102,0.2);
  border-radius: 6px;
}
.btn-clear:hover {
  background: rgba(255,102,102,0.2);
  box-shadow: var(--shadow-glow-danger);
}

.history-timeline { padding: 4px 0; }
.tl-item {
  display: flex; gap: 12px; position: relative;
  padding: 8px 0;
}
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
.tl-dot.hot {
  background: var(--warning);
  box-shadow: 0 0 0 2px rgba(255,136,0,0.2), 0 0 8px var(--warning);
}
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

.tl-body {
  flex: 1; padding: 6px 14px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}
.tl-item.latest .tl-body {
  background: rgba(0,212,255,0.06);
  border-left: 2px solid var(--accent);
}
.tl-body:hover { background: var(--surface-1); }

.tl-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tl-num {
  font-size: 10px; color: var(--text-dim);
  font-family: Consolas;
}
.tl-name { font-size: 13px; color: #fff; font-weight: 500; }
.tl-weight {
  font-size: 10px; color: var(--warning);
  padding: 1px 6px; border-radius: 8px;
  background: rgba(255,136,0,0.12);
}
.tl-action {
  font-size: 10px; font-weight: 500;
  padding: 1px 7px; border-radius: 8px;
}
.tl-action.act-correct { background: rgba(0,220,130,0.15); color: #00e082; }
.tl-action.act-wrong   { background: rgba(255,136,0,0.15); color: var(--warning); }
.tl-action.act-absent  { background: rgba(255,80,80,0.15);   color: var(--danger); }
.tl-action.act-skip    { background: rgba(150,150,150,0.15); color: #aaa; }

.tl-q {
  margin-top: 4px; font-size: 11px; color: var(--text-sub);
  line-height: 1.5;
}

.empty-timeline {
  text-align: center; padding: 24px;
  color: var(--text-dim); font-size: 12px;
}
.empty-tl-emoji { font-size: 28px; margin-bottom: 6px; }

/* ========== 响应式 ========== */
@media (max-width: 900px) {
  .control-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .modal-actions { grid-template-columns: repeat(2, 1fr); }
}
</style>
