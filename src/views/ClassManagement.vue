<template>
  <div class="page">
    <!-- ========== 页面头部 ========== -->
    <header class="page-header">
      <div class="header-title-wrap">
        <h1>📚 班级管理</h1>
        <span class="header-sub">年级 → 班级 → 学生 · 学科按年级绑定 · 抽背权重</span>
      </div>

      <!-- 模板 Banner（虚线闪烁 + 渐变底） -->
      <div class="template-banner">
        <div class="tpl-banner-decoration"></div>
        <div class="tpl-banner-body">
          <span class="tpl-emoji">📦</span>
          <span class="tpl-label">一键生成模板</span>
          <select v-model="selectedTemplate" class="tpl-select">
            <option value="">-- 选择模板 --</option>
            <option v-for="t in templates" :key="t.file" :value="t.file">{{ t.name }}</option>
          </select>
          <label class="tpl-check">
            <input type="checkbox" v-model="templateClear" />
            <span>覆盖旧数据</span>
          </label>
          <button class="primary sm tpl-apply" :disabled="!selectedTemplate" @click="applyTemplate">应用模板</button>
        </div>
      </div>
    </header>

    <!-- ========== 三列布局 ========== -->
    <div class="three-col">
      <!-- 年级 -->
      <div class="col card">
        <div class="col-header">
          <div class="col-title">
            <span class="col-icon">🏫</span>
            <span>年级</span>
            <span class="col-count" v-if="grades.length">{{ grades.length }}</span>
          </div>
          <button class="primary sm" @click="openGradeDialog()">+ 新增</button>
        </div>
        <div class="list">
          <div
            v-for="g in grades"
            :key="g.id"
            class="list-item"
            :class="{ active: selectedGrade === g.id }"
            @click="selectGrade(g.id)"
          >
            <span class="item-indicator"></span>
            <span class="item-name">{{ g.name }}</span>
            <div class="item-actions">
              <button class="icon-btn" @click.stop="openGradeDialog(g)">✏️</button>
              <button class="icon-btn danger" @click.stop="deleteGrade(g.id)">🗑️</button>
            </div>
          </div>
          <div v-if="grades.length === 0" class="empty">暂无年级</div>
        </div>
      </div>

      <!-- 班级 -->
      <div class="col card">
        <div class="col-header">
          <div class="col-title">
            <span class="col-icon">👪</span>
            <span>班级</span>
            <span class="col-sub" v-if="selectedGrade">· {{ gradeName }}</span>
            <span class="col-count" v-if="classes.length">{{ classes.length }}</span>
          </div>
          <button class="primary sm" :disabled="!selectedGrade" @click="openClassDialog()">+ 新增</button>
        </div>
        <div class="list">
          <div
            v-for="c in classes"
            :key="c.id"
            class="list-item"
            :class="{ active: selectedClass === c.id }"
            @click="selectClass(c.id)"
          >
            <span class="item-indicator"></span>
            <span class="item-name">{{ c.name }}</span>
            <div class="item-actions">
              <button class="icon-btn" @click.stop="openClassDialog(c)">✏️</button>
              <button class="icon-btn danger" @click.stop="deleteClass(c.id)">🗑️</button>
            </div>
          </div>
          <div v-if="classes.length === 0" class="empty">
            {{ selectedGrade ? '暂无班级' : '先选择年级' }}
          </div>
        </div>
      </div>

      <!-- 学生（带权重） -->
      <div class="col card">
        <div class="col-header">
          <div class="col-title">
            <span class="col-icon">🎓</span>
            <span>学生</span>
            <span class="col-sub" v-if="selectedClass">· {{ className }}</span>
            <span class="col-count" v-if="students.length">{{ students.length }}</span>
          </div>
          <button class="primary sm" :disabled="!selectedClass" @click="openStudentDialog()">+ 新增</button>
        </div>
        <div class="list student-list">
          <div v-for="s in students" :key="s.id" class="list-item student-item">
            <span class="item-indicator"></span>
            <span class="item-name">
              <span class="avatar" :style="{ background: avatarColor(s.name) }">
                {{ s.name.charAt(0) }}
              </span>
              <span class="stu-info">
                <span class="stu-name">{{ s.name }}</span>
                <span v-if="s.gender" class="gender-badge" :class="s.gender === '男' ? 'male' : 'female'">{{ genderSymbol(s.gender) }}</span>
              </span>
            </span>
            <div class="weight-control" @click.stop>
              <button class="w-btn" @click="changeWeight(s, -1)" :disabled="s.weight <= 1">−</button>
              <span class="w-label" :title="'权重：越大越容易被抽到'">
                <span class="w-val" :class="{ high: s.weight > 1 }">{{ s.weight || 1 }}</span>
              </span>
              <button class="w-btn" @click="changeWeight(s, 1)">+</button>
            </div>
            <div class="item-actions">
              <button class="icon-btn" @click.stop="openStudentDialog(s)">✏️</button>
              <button class="icon-btn danger" @click.stop="deleteStudent(s.id)">🗑️</button>
            </div>
          </div>
          <div v-if="students.length === 0" class="empty">
            {{ selectedClass ? '暂无学生' : '先选择班级' }}
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 学科 & 题目 ========== -->
    <div class="subject-section card">
      <div class="col-header">
        <div class="col-title">
          <span class="col-icon">📖</span>
          <span>学科 & 题目</span>
          <span v-if="selectedGrade" class="hint-label">绑定 {{ gradeName }}</span>
        </div>
        <button class="primary sm" :disabled="!selectedGrade" @click="openSubjectDialog()">+ 学科</button>
      </div>
      <div class="grade-subjects empty" v-if="!selectedGrade">
        <div class="empty-emoji">📚</div>
        请先选择左侧年级，该年级的学科会显示在这里
      </div>
      <template v-else>
        <!-- 分段控件风格 -->
        <div class="subject-tabs" v-if="subjects.length">
          <div class="seg-track">
            <div class="seg-fill" :style="segmentFillStyle"></div>
            <div
              v-for="(s, idx) in subjects"
              :key="s.id"
              class="seg-item"
              :class="{ active: selectedSubject === s.id }"
              :style="{ '--i': idx }"
              @click="selectSubject(s.id)"
            >
              <span class="seg-text">{{ s.name }}</span>
              <button class="icon-btn danger sm seg-close" @click.stop="deleteSubject(s.id)">×</button>
            </div>
          </div>
        </div>
        <div v-else class="empty-subject">该年级暂无学科，点击右上角新增</div>

        <div v-if="selectedSubject" class="questions">
          <div class="col-header">
            <h4 class="question-section-title">📋 {{ currentSubjectName }} · 题目</h4>
            <button class="primary sm" @click="openQuestionDialog()">+ 新增题目</button>
          </div>
          <div class="table-wrap">
            <table class="question-table">
              <thead>
                <tr>
                  <th style="width:56px">权重</th>
                  <th style="width:130px">所属单元</th>
                  <th>标题</th>
                  <th>内容</th>
                  <th style="width:120px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="q in questions" :key="q.id">
                  <td>
                    <div class="weight-control">
                      <button class="w-btn" @click="changeQuestionWeight(q, -1)">−</button>
                      <span class="w-val" :class="{ high: q.weight > 1 }">{{ q.weight || 1 }}</span>
                      <button class="w-btn" @click="changeQuestionWeight(q, 1)">+</button>
                    </div>
                  </td>
                  <td>
                    <span v-if="q.unit" class="q-unit-pill">{{ q.unit }}</span>
                    <span v-else class="q-unit-none">未分组</span>
                  </td>
                  <td class="td-title">
                    {{ q.title || '(无标题)' }}
                    <span v-if="isFromCatalog(q)" class="from-catalog-badge" title="题目本身无原文，内容列显示的是教材目录中的对应原文">📖</span>
                  </td>
                  <td class="td-content">
                    <template v-if="questionContent(q)">{{ questionContent(q) }}</template>
                    <span v-else class="td-no-content">(无内容)</span>
                  </td>
                  <td>
                    <button class="icon-btn" @click="openQuestionDialog(q)">✏️</button>
                    <button class="icon-btn danger" @click="deleteQuestion(q.id)">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="questions.length === 0" class="table-empty">该学科暂无题目</div>
          </div>
        </div>
      </template>
    </div>

    <!-- 已有单元候选（输入单元时下拉选择，也可直接输入新名称） -->
    <datalist id="cm-question-units">
      <option v-for="u in unitOptions" :key="u" :value="u"></option>
    </datalist>

    <!-- ========== 编辑弹窗 ========== -->
    <div v-if="editorDialog" class="dialog-overlay" @click.self="editorDialog = null">
      <div class="dialog card">
        <div class="dialog-top-bar"></div>
        <h3>{{ editorDialog.title }}</h3>
        <div class="dialog-body">
          <template v-if="editorDialog.showUnit">
            <label>所属单元（抽背时按单元分组）</label>
            <input
              v-model="editorDialog.unit"
              list="cm-question-units"
              placeholder="如：第一单元，可直接输入新单元名"
            />
          </template>
          <label>{{ editorDialog.field1Label }}</label>
          <input v-model="editorDialog.field1" :placeholder="editorDialog.field1Label" />
          <template v-if="editorDialog.showField2">
            <label>{{ editorDialog.field2Label }}</label>
            <input v-model="editorDialog.field2" :placeholder="editorDialog.field2Label" />
          </template>
          <template v-if="editorDialog.showField3">
            <label>{{ editorDialog.field3Label }}</label>
            <input v-model.number="editorDialog.field3" type="number" min="1" />
          </template>
          <template v-if="editorDialog.showTextarea">
            <label>内容</label>
            <textarea v-model="editorDialog.field3a" rows="4" placeholder="题目内容..."></textarea>
            <div class="fill-catalog-row">
              <button type="button" class="fill-catalog-btn" @click="fillFromCatalog">📖 从教材目录填入原文</button>
              <span class="fill-catalog-hint">教材原文不会自动写入，填入后点保存才生效</span>
            </div>
          </template>
        </div>
        <div class="dialog-actions">
          <button @click="editorDialog = null">取消</button>
          <button class="primary" @click="editorDialog.onSave">保存</button>
        </div>
        <button class="dialog-close" @click="editorDialog = null">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'

// ========== 全局 Dialog ==========
const showAlert = inject('showAlert')
const showConfirm = inject('showConfirm')

// ========== 状态 ==========
const grades = ref([])
const classes = ref([])
const students = ref([])
const subjects = ref([])
const questions = ref([])
// 教材目录（题目无原文时回退显示 / 编辑时填入）
const catalog = ref(null)

const selectedGrade = ref(null)
const selectedClass = ref(null)
const selectedSubject = ref(null)

const templates = ref([])
const selectedTemplate = ref('')
const templateClear = ref(true)

const editorDialog = ref(null)
let editingId = null

const gradeName = computed(() => grades.value.find(g => g.id === selectedGrade.value)?.name || '')
const className = computed(() => classes.value.find(c => c.id === selectedClass.value)?.name || '')
const currentSubjectName = computed(() => subjects.value.find(s => s.id === selectedSubject.value)?.name || '')
// 该学科已使用的单元名（去重，保序），作为输入候选
const unitOptions = computed(() => {
  const seen = new Set()
  const out = []
  for (const q of questions.value) {
    const u = (q.unit || '').trim()
    if (u && !seen.has(u)) { seen.add(u); out.push(u) }
  }
  return out
})

// 分段控件的 fill 位置（根据当前激活 index 计算）
const segmentFillStyle = computed(() => {
  const idx = subjects.value.findIndex(s => s.id === selectedSubject.value)
  if (idx < 0) return { display: 'none' }
  return {
    transform: `translateX(calc(${idx * 100}% + ${idx * 6}px))`,
    width: `calc(${100 / subjects.value.length}% - 6px)`
  }
})

// ========== 工具函数 ==========
// 确定性 hash → 渐变头像色（同名学生颜色一致）
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  const hues = [
    [200, 290],  // 青→紫
    [10, 50],    // 橙→黄
    [120, 170],  // 绿→青
    [280, 330],  // 紫→粉
    [30, 100]    // 金→绿
  ]
  const pair = hues[Math.abs(h) % hues.length]
  const h1 = pair[0] + (Math.abs(h) % 20 - 10)
  const h2 = pair[1] + (Math.abs(h >> 4) % 20 - 10)
  return `linear-gradient(135deg, hsl(${h1}, 70%, 55%), hsl(${h2}, 70%, 45%))`
}
function genderSymbol(g) { return g === '男' ? '♂' : g === '女' ? '♀' : g }

// ========== 加载 ==========
async function loadGrades(forceReset = false) {
  grades.value = await window.api.getGrades()
  if (grades.value.length && (forceReset || !selectedGrade.value || !grades.value.find(g => g.id === selectedGrade.value))) {
    selectedGrade.value = grades.value[0].id
  }
}
async function loadClasses() {
  if (!selectedGrade.value) { classes.value = []; return }
  classes.value = await window.api.getClasses(selectedGrade.value)
  if (!classes.value.find(c => c.id === selectedClass.value)) {
    selectedClass.value = classes.value[0]?.id || null
  }
}
async function loadStudents() {
  if (!selectedClass.value) { students.value = []; return }
  students.value = await window.api.getStudents(selectedClass.value)
}
async function loadSubjects() {
  if (!selectedGrade.value) { subjects.value = []; selectedSubject.value = null; return }
  subjects.value = await window.api.getSubjects(selectedGrade.value)
  if (!subjects.value.find(s => s.id === selectedSubject.value)) {
    selectedSubject.value = subjects.value[0]?.id || null
  }
}
async function loadQuestions() {
  if (!selectedSubject.value) { questions.value = []; return }
  questions.value = await window.api.getQuestions(selectedSubject.value)
}
async function loadCatalog() {
  try { catalog.value = await window.api.catalog() } catch { catalog.value = null }
}

// 题目自身无原文时，按 年级+学科+单元+标题 从教材目录匹配（同单元优先，全局兜底）
// 兼容册别结构 {上册:{单元:[...]}} 与旧结构 {单元:[...]}
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
  const sd = catalog.value[gradeName.value]?.[currentSubjectName.value]
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
// 表格显示用：题目原文 → 教材目录原文
function questionContent(q) {
  if (q.content && q.content.trim()) return q.content
  return findCatalogContent(q.title, q.unit)
}
function isFromCatalog(q) {
  return !(q.content && q.content.trim()) && !!findCatalogContent(q.title, q.unit)
}
// 编辑弹窗：从教材目录填入原文（保存后才写入题目）
function fillFromCatalog() {
  const d = editorDialog.value
  const title = d.field1.trim()
  const unit = (d.unit || '').trim()
  if (!title) {
    showAlert('请先填写标题，再从教材目录匹配原文。', { title: '缺少标题', type: 'warning' })
    return
  }
  const c = findCatalogContent(title, unit)
  if (!c) {
    showAlert(`教材目录中未找到「${title}」。请确认年级、学科、单元、标题与教材目录一致。`, { title: '未匹配到', type: 'warning' })
    return
  }
  d.field3a = c
}

function selectGrade(id) { selectedGrade.value = id }
function selectClass(id) { selectedClass.value = id }
function selectSubject(id) { selectedSubject.value = id }

watch(selectedGrade, async () => {
  selectedClass.value = null
  selectedSubject.value = null
  await loadClasses()
  await loadSubjects()
  await loadStudents()
})
watch(selectedClass, loadStudents)
watch(selectedSubject, loadQuestions)

// ========== 模板 ==========
async function loadTemplates() {
  templates.value = await window.api.listTemplates()
}
async function applyTemplate() {
  if (!selectedTemplate.value) return
  try {
    const result = await window.api.applyTemplate(selectedTemplate.value, templateClear.value)
    if (result && result.error) {
      showAlert('模板应用失败：' + result.error, { type: 'error', title: '❌ 失败' })
      return
    }
    if (!result || result.grades === undefined) {
      showAlert('模板应用返回异常', { type: 'error', title: '❌ 失败' })
      return
    }
    selectedTemplate.value = ''
    selectedSubject.value = null
    await loadGrades(true)
    showAlert(`模板应用成功！

📚 年级 ${result.grades} 个
🏫 班级 ${result.classes} 个
📖 学科 ${result.subjects} 个
👥 学生 ${result.students} 人`, { type: 'success', title: '✅ 应用成功' })
  } catch (e) {
    console.error('[applyTemplate] exception:', e)
    showAlert('模板应用异常：' + (e?.message || e), { type: 'error', title: '❌ 异常' })
  }
}

// ========== 弹窗 ==========
function openGradeDialog(g) {
  editingId = g?.id || null
  editorDialog.value = {
    title: g ? '编辑年级' : '新增年级',
    field1Label: '年级名称',
    field1: g?.name || '',
    field2Label: '排序（数字小的在前）',
    field2: g?.sort_order || '',
    showField2: true,
    onSave: saveGrade
  }
}
function openClassDialog(c) {
  editingId = c?.id || null
  editorDialog.value = {
    title: c ? '编辑班级' : '新增班级',
    field1Label: '班级名称',
    field1: c?.name || '',
    onSave: saveClass
  }
}
function openStudentDialog(s) {
  editingId = s?.id || null
  editorDialog.value = {
    title: s ? '编辑学生' : '新增学生',
    field1Label: '姓名',
    field1: s?.name || '',
    field2Label: '性别',
    field2: s?.gender || '',
    field3Label: '抽背权重',
    field3: s?.weight || 1,
    showField2: true,
    showField3: true,
    onSave: saveStudent
  }
}
function openSubjectDialog(s) {
  editingId = s?.id || null
  editorDialog.value = {
    title: s ? '编辑学科' : '新增学科',
    field1Label: '学科名称',
    field1: s?.name || '',
    onSave: saveSubject
  }
}
function openQuestionDialog(q) {
  editingId = q?.id || null
  editorDialog.value = {
    title: q ? '编辑题目' : '新增题目',
    showUnit: true,
    unit: q?.unit || '',
    category: q?.category || 'recit',
    field1Label: '标题',
    field1: q?.title || '',
    showTextarea: true,
    field3Label: '抽背权重',
    field3: q?.weight || 1,
    onSave: saveQuestion
  }
}

// ========== 保存 ==========
async function saveGrade() {
  const d = editorDialog.value
  if (!d.field1.trim()) return
  if (editingId) {
    await window.api.updateGrade(editingId, d.field1.trim(), parseInt(d.field2) || 0)
  } else {
    await window.api.addGrade(d.field1.trim(), parseInt(d.field2) || 0)
  }
  editingId = null; editorDialog.value = null; await loadGrades()
}
async function saveClass() {
  const d = editorDialog.value
  if (!d.field1.trim() || !selectedGrade.value) return
  if (editingId) {
    await window.api.updateClass(editingId, d.field1.trim())
  } else {
    await window.api.addClass(selectedGrade.value, d.field1.trim())
  }
  editingId = null; editorDialog.value = null; await loadClasses()
}
async function saveStudent() {
  const d = editorDialog.value
  if (!d.field1.trim() || !selectedClass.value) return
  const weight = Math.max(1, parseInt(d.field3) || 1)
  if (editingId) {
    await window.api.updateStudent(editingId, d.field1.trim(), d.field2.trim(), weight)
  } else {
    await window.api.addStudent(selectedClass.value, d.field1.trim(), d.field2.trim(), weight)
  }
  editingId = null; editorDialog.value = null; await loadStudents()
}
async function saveSubject() {
  const d = editorDialog.value
  const name = d.field1.trim()
  if (!name || !selectedGrade.value) return
  // 同年级重名校验（编辑时排除自身）
  const dup = subjects.value.find(s => s.name === name && s.id !== editingId)
  if (dup) {
    showAlert(`「${name}」学科在该年级已存在，无需重复添加。如需修改，请直接编辑原学科。`, { title: '学科已存在', type: 'warning' })
    return
  }
  try {
    if (editingId) {
      await window.api.updateSubject(editingId, name, selectedGrade.value)
    } else {
      await window.api.addSubject(name, selectedGrade.value)
    }
  } catch (e) {
    showAlert('保存失败：' + (e?.message || e), { title: '出错了', type: 'error' })
    return
  }
  editingId = null; editorDialog.value = null; await loadSubjects()
}
async function saveQuestion() {
  const d = editorDialog.value
  if (!selectedSubject.value) return
  const weight = Math.max(1, parseInt(d.field3) || 1)
  const unit = (d.unit || '').trim()
  const category = d.category || 'recit'
  if (editingId) {
    await window.api.updateQuestion(editingId, d.field1.trim(), d.field3a || '', unit, category)
  } else {
    await window.api.addQuestion(selectedSubject.value, d.field1.trim(), d.field3a || '', unit, category)
  }
  editingId = null; editorDialog.value = null; await loadQuestions()
}

// ========== 删除 ==========
async function deleteGrade(id) {
  if (!(await showConfirm('确定删除该年级？将级联删除所有下级班级、学生、学科和题目', { type: 'danger' }))) return
  await window.api.deleteGrade(id); await loadGrades()
}
async function deleteClass(id) {
  if (!(await showConfirm('确定删除该班级？将级联删除所有学生', { type: 'danger' }))) return
  await window.api.deleteClass(id); await loadClasses()
}
async function deleteStudent(id) {
  if (!(await showConfirm('确定删除该学生？', { type: 'danger' }))) return
  await window.api.deleteStudent(id); await loadStudents()
}
async function deleteSubject(id) {
  if (!(await showConfirm('确定删除该学科？将级联删除所有题目', { type: 'danger' }))) return
  await window.api.deleteSubject(id); await loadSubjects()
}
async function deleteQuestion(id) {
  if (!(await showConfirm('确定删除该题目？', { type: 'danger' }))) return
  await window.api.deleteQuestion(id); await loadQuestions()
}

// ========== 权重 ==========
async function changeWeight(s, delta) {
  const newW = Math.max(1, (s.weight || 1) + delta)
  await window.api.updateStudentWeight(s.id, newW)
  s.weight = newW
}
async function changeQuestionWeight(q, delta) {
  const newW = Math.max(1, (q.weight || 1) + delta)
  await window.api.updateQuestion(q.id, q.title, q.content, newW)
  q.weight = newW
}

// ========== 启动 ==========
onMounted(async () => {
  await Promise.all([loadGrades(), loadTemplates(), loadCatalog()])
  // 手机端改了数据 → 自动刷新
  window.api.relay.onDataChanged(() => { loadGrades().catch(() => {}) })
})
</script>

<style scoped>
/* ==============================================
   基础
============================================== */
.page { padding: 20px; height: 100%; overflow-y: auto; }

/* ==============================================
   页面头部 + 模板 Banner
============================================== */
.page-header { margin-bottom: 18px; }
.header-title-wrap { margin-bottom: 14px; }
.page-header h1 {
  font-size: 22px; color: #fff; font-weight: bold;
  letter-spacing: 1px; margin-bottom: 4px;
  background: linear-gradient(135deg, #fff 30%, #a8a8ff);
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
}
.header-sub { font-size: 12px; color: var(--text-sub); letter-spacing: 0.3px; }

/* 模板 Banner */
.template-banner {
  position: relative;
  padding: 14px 18px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(124,58,237,0.18), rgba(0,212,255,0.12));
  border: 1px dashed rgba(124,58,237,0.4);
  overflow: hidden;
  animation: bannerDashed 3s linear infinite;
}
@keyframes bannerDashed {
  0%,100% { border-color: rgba(124,58,237,0.35); }
  50% { border-color: rgba(0,212,255,0.35); }
}
.tpl-banner-decoration {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 10% 50%, rgba(0,212,255,0.1), transparent 40%),
    radial-gradient(circle at 90% 50%, rgba(124,58,237,0.12), transparent 40%);
  pointer-events: none;
}
.tpl-banner-body {
  position: relative; z-index: 1;
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
}
.tpl-emoji { font-size: 22px; filter: drop-shadow(0 0 6px rgba(124,58,237,0.5)); }
.tpl-label { font-size: 13px; color: #fff; font-weight: bold; letter-spacing: 0.5px; }
.tpl-select { min-width: 170px; }
.tpl-check {
  font-size: 12px; color: var(--text-sub);
  display: flex; gap: 6px; align-items: center; cursor: pointer;
}
.tpl-apply { margin-left: auto; }

/* ==============================================
   三列
============================================== */
.three-col {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px; margin-bottom: 16px;
}
.col { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.col-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px;
  background: linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.1));
  border-bottom: var(--border-soft);
}
.col-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #fff; font-weight: bold; letter-spacing: 0.5px;
}
.col-icon {
  width: 24px; height: 24px; border-radius: 6px;
  background: rgba(0,212,255,0.15);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px;
}
.col-sub { font-size: 11px; color: var(--text-dim); font-weight: normal; }
.col-count {
  font-size: 10px; font-weight: bold;
  padding: 1px 7px; border-radius: 10px;
  background: rgba(0,212,255,0.15); color: var(--accent);
  border: 1px solid rgba(0,212,255,0.2);
}

.hint-label {
  color: var(--accent); font-size: 11px; font-weight: normal;
  padding: 2px 8px; border-radius: 8px;
  background: rgba(0,212,255,0.1);
}

/* ==============================================
   列表
============================================== */
.list { flex: 1; max-height: 420px; overflow-y: auto; padding: 8px; }
.list-item {
  position: relative;
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; margin-bottom: 4px;
  border-radius: 10px; cursor: pointer;
  transition: all 0.25s var(--ease-out);
  border: 1px solid transparent;
}
.list-item:hover {
  background: var(--surface-2);
  border-color: var(--border-medium);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.2);
}
.list-item.active {
  background: linear-gradient(135deg, rgba(0,212,255,0.14), rgba(124,58,237,0.1));
  border-color: rgba(0,212,255,0.3);
  box-shadow: 0 4px 16px rgba(0,212,255,0.15);
}
.list-item.active .item-name { color: #fff; text-shadow: 0 0 6px rgba(0,212,255,0.2); }

/* 左侧指示条 */
.item-indicator {
  position: absolute; left: 6px; top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px; height: 60%;
  border-radius: 3px;
  background: var(--accent-gradient);
  box-shadow: 0 0 10px rgba(0,212,255,0.5);
  transition: transform 0.3s var(--ease-out);
}
.list-item.active .item-indicator { transform: translateY(-50%) scaleY(1); }

.item-name {
  font-size: 13px; color: var(--text-main); flex: 1;
  transition: color 0.2s;
}
.item-actions { display: flex; gap: 2px; opacity: 0.5; transition: opacity 0.2s; }
.list-item:hover .item-actions, .list-item.active .item-actions { opacity: 1; }

.empty {
  padding: 32px 16px; text-align: center;
  color: var(--text-dim); font-size: 12px;
}

/* ==============================================
   学生列表
============================================== */
.student-list .student-item { flex-wrap: nowrap !important; gap: 10px; min-width: 0; }
.student-item .item-name {
  flex: 1 1 0; min-width: 0; display: flex; align-items: center;
}
.stu-info {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--text-main);
  min-width: 0; flex: 1;
}
.stu-name {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.student-item .weight-control,
.student-item .item-actions { flex-shrink: 0; }
.student-item .item-actions { flex-wrap: nowrap; white-space: nowrap; }
.student-item .icon-btn { flex-shrink: 0; }

/* 头像（确定性渐变） */
.avatar {
  width: 32px; height: 32px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; color: #fff; font-weight: bold;
  margin-right: 10px; flex-shrink: 0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  position: relative;
}
.avatar::after {
  content: '';
  position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(180deg, var(--highlight-strong), transparent);
  pointer-events: none;
}

.gender-badge {
  font-size: 10px; padding: 1px 7px;
  border-radius: 8px; font-weight: bold;
  line-height: 16px;
}
.gender-badge.male {
  color: #5ac8fa; background: rgba(90,200,250,0.15);
  border: 1px solid rgba(90,200,250,0.3);
}
.gender-badge.female {
  color: #ff6b9d; background: rgba(255,107,157,0.15);
  border: 1px solid rgba(255,107,157,0.3);
}

/* ==============================================
   权重控件
============================================== */
.weight-control {
  display: inline-flex; align-items: center; gap: 2px;
  background: rgba(0,0,0,0.25);
  border-radius: 20px; padding: 3px;
  border: var(--border-soft);
}
.w-btn {
  width: 22px; height: 22px; border-radius: 50%;
  border: none;
  background: var(--surface-3);
  color: var(--text-sub);
  font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  font-weight: bold;
}
.w-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,212,255,0.4);
  transform: scale(1.05);
}
.w-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.w-label {
  font-size: 10px; color: var(--text-dim);
  padding: 0 6px;
}
.w-val {
  min-width: 16px; text-align: center;
  font-weight: bold; color: var(--accent);
  font-size: 12px;
  font-family: Consolas, monospace;
}
.w-val.high {
  color: var(--warning);
  text-shadow: 0 0 6px rgba(255,136,0,0.4);
}

/* ==============================================
   学科 & 题目区
============================================== */
.subject-section { padding: 0; overflow: hidden; }
.subject-section .col-header { padding: 14px 16px; }

.grade-subjects {
  padding: 32px; text-align: center;
}
.grade-subjects .empty-emoji {
  font-size: 40px; margin-bottom: 8px; opacity: 0.6;
}

/* 分段控件 */
.subject-tabs {
  padding: 8px 16px 14px;
}
.seg-track {
  position: relative;
  display: flex; gap: 6px;
  padding: 6px;
  background: rgba(0,0,0,0.25);
  border-radius: 12px;
  border: var(--border-medium);
}
.seg-fill {
  position: absolute; top: 6px; bottom: 6px;
  left: 6px;
  border-radius: 9px;
  background: var(--accent-gradient);
  box-shadow: 0 4px 16px rgba(0,212,255,0.3);
  transition: all 0.35s var(--ease-bounce);
  z-index: 0;
}
.seg-item {
  position: relative; z-index: 1;
  flex: 1;
  padding: 8px 14px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; color: var(--text-sub);
  cursor: pointer;
  transition: color 0.25s;
  white-space: nowrap;
}
.seg-item.active { color: #fff; font-weight: bold; text-shadow: 0 0 6px rgba(0,0,0,0.3); }
.seg-item:hover { color: var(--text-main); }
.seg-text { pointer-events: none; }
.seg-close {
  opacity: 0;
  transition: opacity 0.2s;
  padding: 2px 4px; font-size: 11px;
}
.seg-item:hover .seg-close,
.seg-item.active .seg-close { opacity: 1; }
.seg-item.active .seg-close { color: var(--text-sub); }
.seg-item.active .seg-close:hover { color: #fff; background: rgba(255,0,0,0.3); }

.empty-subject { padding: 16px; text-align: center; color: var(--text-dim); font-size: 11px; }

/* ==============================================
   题目表格
============================================== */
.questions { padding: 0 16px 16px; }
.question-section-title {
  font-size: 12px; color: var(--text-sub);
  font-weight: bold; letter-spacing: 0.5px;
}
.table-wrap {
  border-radius: var(--radius-md);
  border: var(--border-medium);
  overflow: hidden;
  background: rgba(0,0,0,0.2);
}
.question-table { width: 100%; border-collapse: collapse; }
.question-table th {
  text-align: left; padding: 12px 14px;
  font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.8px; font-weight: bold;
  background: linear-gradient(180deg, rgba(0,212,255,0.12), rgba(124,58,237,0.08));
  color: var(--accent);
  border-bottom: var(--border-medium);
}
.question-table td {
  padding: 11px 14px;
  border-bottom: var(--border-soft);
  font-size: 12px; color: var(--text-sub);
  transition: background 0.15s;
}
.question-table tbody tr:hover td {
  background: rgba(0,212,255,0.05);
  color: var(--text-main);
}
.question-table tbody tr:last-child td { border-bottom: none; }
.td-title { color: var(--text-main); font-weight: 500; }
.td-content {
  max-width: 320px; overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.td-no-content { color: var(--text-dim); }
.from-catalog-badge { margin-left: 5px; font-size: 11px; }
/* 编辑弹窗：从教材目录填入 */
.fill-catalog-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.fill-catalog-btn {
  font-size: 11px; padding: 5px 13px; border-radius: 999px;
  background: rgba(0,212,255,0.1);
  border: 1px solid rgba(0,212,255,0.35);
  color: var(--accent);
}
.fill-catalog-btn:hover { background: var(--accent-gradient); color: #fff; border-color: transparent; }
.fill-catalog-hint { font-size: 10px; color: var(--text-dim); }
/* 单元胶囊 */
.q-unit-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--accent);
  background: rgba(0,212,255,0.1);
  border: 1px solid rgba(0,212,255,0.28);
  white-space: nowrap;
}
.q-unit-none { font-size: 11px; color: var(--text-dim); }
.table-empty { padding: 24px; text-align: center; color: var(--text-dim); font-size: 12px; }

/* ==============================================
   通用按钮
============================================== */
.sm { padding: 5px 11px; font-size: 11px; }
.icon-btn {
  background: transparent; border: none;
  padding: 5px 7px; font-size: 12px;
  border-radius: 7px; cursor: pointer;
  transition: all 0.15s;
}
.icon-btn:hover { background: var(--surface-4); transform: scale(1.08); }
.icon-btn.danger:hover { background: rgba(255,102,102,0.2); color: var(--danger); }

/* ==============================================
   编辑弹窗
============================================== */
.dialog-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  animation: dialogFade 0.2s ease;
}
@keyframes dialogFade { from { opacity: 0; } to { opacity: 1; } }

.dialog {
  min-width: 400px;
  padding: 28px 28px 24px;
  position: relative;
  animation: dialogPop 0.3s var(--ease-bounce);
}
@keyframes dialogPop {
  0% { opacity: 0; transform: scale(0.85) translateY(10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.dialog-top-bar {
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px; border-radius: 16px 16px 0 0;
  background: var(--accent-gradient);
}
.dialog h3 { font-size: 16px; margin-bottom: 18px; color: #fff; font-weight: bold; }
.dialog-body {
  display: flex; flex-direction: column; gap: 6px;
}
.dialog-body label { font-size: 11px; color: var(--text-sub); margin-top: 6px; }
.dialog-body input, .dialog-body textarea { margin-bottom: 4px; }
.dialog-body textarea { resize: vertical; min-height: 80px; font-family: inherit; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.dialog-close {
  position: absolute; top: 12px; right: 14px;
  width: 28px; height: 28px;
  border-radius: 50%;
  padding: 0;
  font-size: 13px;
  background: transparent; border: none;
  color: var(--text-dim); cursor: pointer;
  transition: all 0.2s;
}
.dialog-close:hover {
  background: rgba(255,102,102,0.15);
  color: var(--danger);
  transform: rotate(90deg);
}

/* ==============================================
   响应式
============================================== */
@media (max-width: 1200px) {
  .three-col { grid-template-columns: repeat(2, 1fr); }
  /* 学生列独占整行，避免窗口非最大化时删除按钮被挤换行/裁切 */
  .three-col > .col:nth-child(3) { grid-column: 1 / -1; }
}
@media (max-width: 800px) {
  .three-col { grid-template-columns: 1fr; }
}
</style>
