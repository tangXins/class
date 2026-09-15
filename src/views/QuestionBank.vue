<template>
  <div class="qb-page">
    <!-- ====== 顶部筛选 ====== -->
    <div class="qb-top card">
      <div class="qb-title">📝 自定义题库管理</div>
      <div class="qb-filters">
        <div class="filter-tile">
          <label>年级</label>
          <select v-model="selectedGrade" @change="onGradeChange">
            <option value="">-- 请选择 --</option>
            <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
        <div class="filter-tile">
          <label>学科</label>
          <select v-model="selectedSubject" @change="onSubjectChange" :disabled="!selectedGrade">
            <option value="">-- 请选择 --</option>
            <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div class="filter-info" v-if="selectedSubject">
          <span class="info-pill">📋 共 {{ questions.length }} 题</span>
        </div>
      </div>
    </div>

    <!-- ====== 主区域：左列表 + 右编辑 ====== -->
    <div class="qb-main">
      <!-- 左侧题目列表 -->
      <div class="qb-left card">
        <div class="left-header">
          <span>题目列表</span>
          <span class="badge" v-if="questions.length" style="background:rgba(0,212,255,0.15);color:var(--accent)">
            {{ questions.length }}
          </span>
        </div>
        <div class="left-list" v-if="questions.length">
          <div
            v-for="q in questions"
            :key="q.id"
            class="list-item"
            :class="{ active: editingId === q.id }"
            @click="editQuestion(q)"
          >
            <div class="item-main">
              <div class="item-title">{{ q.title || '(未命名)' }}</div>
              <div class="item-unit" v-if="q.unit">🏷️ {{ q.unit }}</div>
            </div>
            <button class="btn-del" @click.stop="deleteQuestion(q)" title="删除">✕</button>
          </div>
        </div>
        <div class="left-empty" v-else>
          <div class="empty-icon">📭</div>
          <div class="empty-text">{{ selectedSubject ? '暂无题目，点击下方新增' : '请先选择年级和学科' }}</div>
        </div>
      </div>

      <!-- 右侧编辑区 -->
      <div class="qb-right card">
        <div class="right-header">
          <span>{{ editingId ? '✏️ 编辑题目' : '➕ 新增题目' }}</span>
          <span v-if="editingId" class="tag-accent">ID: {{ editingId }}</span>
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label>题目标题</label>
            <input v-model="form.title" placeholder="如：文言文背诵要点" />
          </div>
          <div class="form-row">
            <label>所属单元</label>
            <select v-model="form.unit">
              <option value="">-- 不选单元 --</option>
              <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
          <div class="form-row full">
            <label>题目内容</label>
            <textarea
              v-model="form.content"
              rows="12"
              placeholder="请输入题目内容，支持多行..."
            ></textarea>
          </div>
        </div>

        <div class="form-actions">
          <button class="primary" :disabled="!selectedSubject" @click="saveQuestion">
            💾 {{ editingId ? '保存修改' : '保存新题' }}
          </button>
          <button v-if="editingId" @click="cancelEdit">↩️ 取消</button>
        </div>
      </div>
    </div>

    <!-- 底部：新增按钮 -->
    <div class="qb-bottom">
      <button class="primary big-draw" :disabled="!selectedSubject" @click="startAdd">
        ➕ 新增题目
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'

const grades = ref([])
const subjects = ref([])
const questions = ref([])
const unitOptions = ref([])

const selectedGrade = ref('')
const selectedSubject = ref('')

const editingId = ref(null)
const form = reactive({
  title: '',
  unit: '',
  content: ''
})

// toast
const toastMsg = ref('')
let toastTimer = null
function showToast(msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 1800)
}

// confirm —— 简单确认用原生（避免依赖 App.vue 的 GlobalDialog）
function showConfirm(msg) {
  return new Promise(resolve => {
    // 优先原生
    const ok = window.confirm(msg)
    resolve(ok)
  })
}

async function loadGrades() {
  try {
    grades.value = await window.api.getGrades()
  } catch {
    grades.value = []
  }
}

async function onGradeChange() {
  selectedSubject.value = ''
  subjects.value = []
  questions.value = []
  unitOptions.value = []
  editingId.value = null
  resetForm()
  if (!selectedGrade.value) return
  try {
    subjects.value = await window.api.getSubjects(selectedGrade.value)
  } catch {
    subjects.value = []
  }
}

async function onSubjectChange() {
  questions.value = []
  editingId.value = null
  resetForm()
  if (!selectedSubject.value) return
  // 加载 custom 题目
  try {
    questions.value = await window.api.getQuestions(selectedSubject.value, { category: 'custom' })
  } catch {
    questions.value = []
  }
  // 用 recit 的已有单元做 unit 选项复用
  try {
    const units = await window.api.getUnits(selectedSubject.value, 'recit')
    unitOptions.value = Array.isArray(units) ? units : []
  } catch {
    unitOptions.value = []
  }
}

function resetForm() {
  form.title = ''
  form.unit = ''
  form.content = ''
}

function editQuestion(q) {
  editingId.value = q.id
  form.title = q.title || ''
  form.unit = q.unit || ''
  form.content = q.content || ''
}

function cancelEdit() {
  editingId.value = null
  resetForm()
}

function startAdd() {
  editingId.value = null
  resetForm()
  // unit 复用 recit 现有单元
  if (unitOptions.value.length) {
    form.unit = unitOptions.value[0] || ''
  }
}

async function saveQuestion() {
  if (!selectedSubject.value) return showToast('请先选择学科')
  if (!form.title.trim()) return showToast('请填写标题')

  try {
    if (editingId.value) {
      await window.api.updateQuestion(
        editingId.value,
        form.title.trim(),
        form.content,
        form.unit,
        'custom'
      )
      showToast('✓ 修改已保存')
    } else {
      await window.api.addQuestion(
        selectedSubject.value,
        form.title.trim(),
        form.content,
        form.unit,
        'custom'
      )
      showToast('✓ 题目已新增')
    }
    cancelEdit()
    await onSubjectChange() // 刷新列表
  } catch (e) {
    showToast('保存失败：' + e.message)
  }
}

async function deleteQuestion(q) {
  const ok = await showConfirm(`确定删除「${q.title || '(未命名)'}」吗？此操作不可恢复。`)
  if (!ok) return
  try {
    await window.api.deleteQuestion(q.id)
    showToast('✓ 已删除')
    if (editingId.value === q.id) cancelEdit()
    await onSubjectChange()
  } catch (e) {
    showToast('删除失败：' + e.message)
  }
}

onMounted(() => {
  loadGrades()
})
</script>

<style scoped>
.qb-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

/* ====== 顶部 ====== */
.qb-top {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
}
.qb-title {
  font-size: 17px;
  font-weight: bold;
  background: linear-gradient(135deg, #fff, #c4c4ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.qb-filters {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-left: auto;
}
.filter-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.filter-tile label {
  font-size: 10px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.filter-tile select {
  min-width: 160px;
}
.filter-info {
  display: flex;
  gap: 6px;
}
.info-pill {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(0, 212, 255, 0.1);
  color: var(--accent);
  border: 1px solid rgba(0, 212, 255, 0.25);
}

/* ====== 主区域 ====== */
.qb-main {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}

.qb-left {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
  overflow: hidden;
}
.left-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-sub);
  font-weight: 600;
  letter-spacing: 0.3px;
  margin-bottom: 10px;
}
.left-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface-1);
  border: var(--border-subtle);
  cursor: pointer;
  transition: all 0.2s;
}
.list-item:hover {
  background: var(--surface-3);
  border-color: rgba(0, 212, 255, 0.25);
}
.list-item.active {
  background: rgba(0, 212, 255, 0.12);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(0, 212, 255, 0.2);
}
.item-main {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-unit {
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 2px;
}
.btn-del {
  width: 24px;
  height: 24px;
  min-width: 0;
  padding: 0;
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-dim);
  background: transparent;
  border: var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-del:hover {
  background: var(--danger);
  color: #fff;
  border-color: var(--danger);
  transform: none;
}

.left-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-dim);
  font-size: 12px;
}
.empty-icon {
  font-size: 36px;
  opacity: 0.5;
}

/* ====== 右侧编辑 ====== */
.qb-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: auto;
}
.right-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: bold;
  color: var(--text-main);
  margin-bottom: 16px;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-row label {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
  font-weight: 600;
}
.form-row.full {
  flex: 1;
  min-height: 0;
}
.form-row textarea {
  flex: 1;
  resize: none;
  min-height: 200px;
  line-height: 1.7;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 14px;
  border-top: var(--border-subtle);
}

/* ====== 底部 ====== */
.qb-bottom {
  display: flex;
  justify-content: center;
  padding: 4px 0 0;
}
.qb-bottom button {
  font-size: 14px;
  padding: 10px 32px;
}
</style>
