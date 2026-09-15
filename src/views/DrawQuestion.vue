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
          <span class="stat-pill" v-if="mode === 'question' && questions.length" style="color:var(--accent2)">📋 {{ questions.length }} 题</span>
        </div>
      </div>

      <!-- 4 选 择 分 段 卡 片 -->
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
              <option value="question">学生 + 题目</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 抽背按钮（外圈光束动画） -->
      <div class="draw-btn-wrap">
        <div class="draw-btn-glow" :class="{ active: !selectedClass || (mode === 'question' && !selectedSubject) }" :style="{ '--count': 8 }"></div>
        <button
          class="draw-btn primary"
          :disabled="!selectedClass || (mode === 'question' && !selectedSubject) || drawing"
          @click="draw"
        >
          <span v-if="drawing" class="btn-spinner"></span>
          <span v-else class="btn-icon">🎲</span>
          <span class="btn-text">{{ drawing ? '抽取中...' : '开始抽背' }}</span>
        </button>
      </div>
    </section>

    <!-- ========== 结果展示区 ========== -->
    <section class="result-area" :class="{ revealing: exploded }">
      <!-- 空态 -->
      <div v-if="!currentStudent" class="empty-hint">
        <div class="empty-emoji">🎯</div>
        <div class="empty-title">准备好抽背了吗？</div>
        <div class="empty-sub">选择年级、班级后，点击上方「开始抽背」</div>
        <div class="empty-tip">💡 权重越高的学生越容易被抽到，在班级管理页调整</div>
      </div>

      <!-- 抽背结果 -->
      <div v-else class="draw-result">
        <!-- 粒子爆炸层（纯 CSS） -->
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

        <!-- 学生卡片 -->
        <div class="student-card" :class="{ revealing: !drawing, shuffling: drawing }">
          <!-- 彩虹流光边框 -->
          <div class="card-border" v-if="!drawing"></div>

          <div class="card-inner">
            <div class="student-emoji">{{ drawing ? '🎲' : '🎓' }}</div>
            <div class="student-name-wrap">
              <span class="student-name" :class="{ revealed: !drawing }">{{ currentStudent.name }}</span>
            </div>

            <div class="student-meta" v-if="!drawing">
              <span class="weight-chip" :title="'抽背权重：' + currentStudent.weight">
                ⚖️ 权重 {{ currentStudent.weight }}
                <span v-if="currentStudent.weight > 1" class="weight-plus">+</span>
              </span>
            </div>

            <div class="student-tip" v-if="!drawing">
              请 <b>{{ currentStudent.name }}</b> 同学起来
              {{ mode === 'question' ? '背诵下面这道题目' : '回答问题' }}
            </div>
          </div>
        </div>

        <!-- 题目卡片 -->
        <transition name="question">
          <div v-if="mode === 'question' && currentQuestion && !drawing" class="question-card">
            <div class="question-header">
              <span class="question-icon">📋</span>
              <span class="question-title">{{ currentQuestion.title || '题目' }}</span>
              <span class="weight-chip mini" :title="'题目权重：' + currentQuestion.weight">
                ⚖️ {{ currentQuestion.weight }}
              </span>
            </div>
            <div class="question-content">{{ currentQuestion.content || '(无内容)' }}</div>
          </div>
        </transition>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

// ========== 状态 ==========
const grades = ref([])
const classes = ref([])
const subjects = ref([])
const selectedGrade = ref('')
const selectedClass = ref('')
const selectedSubject = ref('')
const mode = ref('student')

const students = ref([])
const questions = ref([])
const currentStudent = ref(null)
const currentQuestion = ref(null)
const drawing = ref(false)
const exploded = ref(false)   // 粒子爆炸状态
const history = ref([])

const gradeName = computed(() => grades.value.find(g => g.id === selectedGrade.value)?.name || '')
const className = computed(() => classes.value.find(c => c.id === selectedClass.value)?.name || '')

const studentsWithWeight = computed(() => students.value.filter(s => (s.weight || 1) > 1).length)
const totalWeight = computed(() => students.value.reduce((s, st) => s + Math.max(1, st.weight || 1), 0))

// 粒子位置计算函数（为每个粒子生成不同的角度+距离）
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
async function loadQuestions() {
  if (!selectedSubject.value) { questions.value = []; return }
  questions.value = await window.api.getQuestions(selectedSubject.value)
}

async function onGradeChange() {
  selectedClass.value = ''
  selectedSubject.value = ''
  await loadClasses()
  await loadSubjects()
}
async function onClassChange() { await loadStudents() }
async function onSubjectChange() { await loadQuestions() }

// ========== 抽背 ==========
async function draw() {
  if (!selectedClass.value || drawing.value) return
  drawing.value = true
  exploded.value = false
  currentStudent.value = null
  currentQuestion.value = null

  // 名字洗牌动画：循环切换真实学生名字（不是拼接 ???）
  const start = Date.now()
  const duration = 800
  const pool = students.value.length ? students.value : [{ name: '抽取中...', weight: 1 }]
  const interval = setInterval(async () => {
    const temp = pool[Math.floor(Math.random() * pool.length)]
    currentStudent.value = { name: temp.name, weight: temp.weight || 1 }
    if (Date.now() - start >= duration) {
      clearInterval(interval)
      await doReveal()
    }
  }, 60)  // 比之前的 80ms 更快，洗牌感更强
}

async function doReveal() {
  drawing.value = false
  const s = await window.api.randomStudent(selectedClass.value)
  currentStudent.value = s

  let q = null
  if (mode.value === 'question' && selectedSubject.value) {
    q = await window.api.randomQuestion(selectedSubject.value)
    currentQuestion.value = q
  }

  if (s) {
    history.value.unshift({
      student: s.name,
      weight: s.weight || 1,
      question: q?.title || ''
    })
  }

  // 触发粒子爆炸，1.1 秒后清除
  exploded.value = true
  setTimeout(() => { exploded.value = false }, 1100)
}

// ========== 监听 ==========
watch(selectedGrade, loadClasses)
watch(selectedGrade, loadSubjects)
watch(selectedClass, loadStudents)
watch(selectedSubject, loadQuestions)

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

/* 四个控制卡片 */
.control-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  margin-bottom: 20px;
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

/* ========== 结果展示区 ========== */
.result-area {
  padding: 48px 32px; min-height: 360px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  background: radial-gradient(ellipse at center, rgba(124,58,237,0.08) 0%, transparent 60%),
              linear-gradient(135deg, rgba(13,13,24,0.9), rgba(26,26,46,0.9));
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  position: relative; overflow: hidden;
}
.result-area.revealing::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at center, rgba(0,212,255,0.12), transparent 70%);
  animation: revealFlash 0.8s ease-out;
}
@keyframes revealFlash {
  0% { opacity: 1; } 100% { opacity: 0; }
}

/* 空态 */
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

/* ========== 学生卡片 ========== */
.draw-result { display: flex; flex-direction: column; align-items: center; gap: 20px; position: relative; }

.student-card {
  position: relative; padding: 40px 56px;
  border-radius: 20px;
  background: linear-gradient(145deg, #1e1e36, #0f0f20);
  transition: all 0.5s var(--ease-out);
  overflow: hidden;
  min-width: 280px;
}
.student-card.shuffling {
  background: linear-gradient(145deg, rgba(15,15,32,0.95), rgba(30,30,54,0.95));
}
.student-card.revealing {
  transform: scale(1.05);
  animation: cardEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes cardEnter {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1.0); opacity: 1; }
}

/* 彩虹流光边框（conic 旋转 + mask 挖洞） */
.card-border {
  position: absolute; inset: -2px; border-radius: 22px;
  background: conic-gradient(
    from 0deg,
    #00d4ff, #7c3aed, #ff3d8a, #ff8800, #00ff88, #00d4ff
  );
  animation: rainbowSpin 4s linear infinite;
  z-index: -1;
  filter: blur(1px);
}
@keyframes rainbowSpin { to { transform: rotate(360deg); } }

.card-inner {
  text-align: center;
  position: relative;
  padding: 4px;
}
.student-emoji {
  font-size: 48px; margin-bottom: 12px;
  display: inline-block;
  transition: all 0.3s;
}
.student-card.shuffling .student-emoji { animation: emojiSpin 0.5s ease infinite; }
@keyframes emojiSpin { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-15deg) scale(0.9)} 75%{transform:rotate(15deg) scale(1.1)} }

/* 名字——渐变文字 + reveal 动画 */
.student-name-wrap { margin-bottom: 4px; }
.student-name {
  font-size: 42px; font-weight: bold;
  letter-spacing: 4px;
  display: inline-block;
  color: #fff;
  text-shadow: 0 0 30px rgba(0,212,255,0.4);
  animation: nameShuffle 60ms linear infinite;
  filter: blur(2px);
  opacity: 0.7;
}
.student-name.revealed {
  background: linear-gradient(135deg, #00d4ff, #7c3aed, #00d4ff);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: nameReveal 0.8s ease-out, gradientFlow 3s linear infinite 0.8s;
  filter: none;
  opacity: 1;
  text-shadow: none;
}
@keyframes nameShuffle {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
@keyframes nameReveal {
  0% { filter: blur(12px); opacity: 0; transform: scale(0.6); letter-spacing: 12px; }
  100% { filter: blur(0); opacity: 1; transform: scale(1); letter-spacing: 4px; }
}
@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

.student-meta { margin-top: 10px; }
.weight-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 14px; border-radius: 20px;
  background: rgba(255,136,0,0.15);
  border: 1px solid rgba(255,136,0,0.3);
  color: var(--warning);
  font-size: 12px; font-weight: bold;
}
.weight-chip.mini { font-size: 11px; padding: 2px 8px; }
.weight-plus {
  background: var(--warning); color: #000;
  border-radius: 50%; width: 16px; height: 16px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; margin-left: 2px;
}

.student-tip {
  font-size: 13px; color: var(--text-sub);
  margin-top: 14px; line-height: 1.5;
}
.student-tip b { color: var(--accent); }

/* ========== 粒子爆炸 ========== */
.particle-field {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none; z-index: 10;
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

/* ========== 题目卡片 ========== */
.question-card {
  padding: 20px 28px; border-radius: 16px;
  background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(0,212,255,0.1));
  border: 1px solid rgba(124,58,237,0.4);
  max-width: 480px; text-align: center;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(124,58,237,0.2);
}
.question-header {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 10px; flex-wrap: wrap;
}
.question-icon { font-size: 18px; }
.question-title { font-size: 16px; color: #fff; font-weight: bold; }
.question-content {
  font-size: 14px; color: var(--text-sub); line-height: 1.7;
}
.question-enter-active { animation: questionSlide 0.5s var(--ease-bounce); }
.question-leave-active { transition: opacity 0.2s; }
.question-enter-from { opacity: 0; transform: translateY(20px); }
.question-leave-to { opacity: 0; transform: translateY(-10px); }
@keyframes questionSlide {
  0% { opacity: 0; transform: translateY(30px) scale(0.9); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

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

/* 时间轴核心 */
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

/* 左侧时间轴线 + 节点 */
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

/* 内容 */
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
</style>
