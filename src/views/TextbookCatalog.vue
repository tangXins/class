<template>
  <div class="cat-page">
    <!-- ====== 左侧三层 tab ====== -->
    <div class="cat-sidebar card">
      <!-- 年级 -->
      <div class="seg-block">
        <div class="seg-title">🎓 年级</div>
        <div class="seg-group grades">
          <button
            v-for="g in grades"
            :key="g"
            class="seg-btn"
            :class="{ active: currentGrade === g }"
            @click="selectGrade(g)"
          >{{ g }}</button>
        </div>
      </div>

      <div class="divider"></div>

      <!-- 学科 -->
      <div class="seg-block">
        <div class="seg-title">📚 学科</div>
        <div class="seg-group subjects">
          <button
            v-for="s in subjects"
            :key="s"
            class="seg-btn"
            :class="{ active: currentSubject === s, disabled: !hasSubjectData(s) }"
            :disabled="!hasSubjectData(s)"
            @click="selectSubject(s)"
          >
            {{ s }}
            <span v-if="!hasSubjectData(s)" class="seg-empty">∅</span>
          </button>
        </div>
      </div>

      <div class="divider"></div>

      <!-- 单元 -->
      <div class="seg-block">
        <div class="seg-title">📖 单元</div>
        <div class="seg-group units">
          <template v-if="currentUnits && currentUnits.length">
            <button
              v-for="u in currentUnits"
              :key="u"
              class="seg-btn unit-btn"
              :class="{ active: currentUnit === u }"
              @click="selectUnit(u)"
            >{{ u }}</button>
          </template>
          <div v-else class="units-empty">暂无单元数据</div>
        </div>
      </div>
    </div>

    <!-- ====== 右侧主内容 ====== -->
    <div class="cat-main card">
      <!-- 工具栏 -->
      <div class="content-toolbar" v-if="currentArticle">
        <div class="content-title">
          <span class="article-title">{{ currentArticle.title }}</span>
          <span v-if="currentArticle.author" class="article-author">—— {{ currentArticle.author }}</span>
        </div>
        <div class="content-tools">
          <div class="font-ctrl">
            <button class="tool-btn" @click="fontSize = Math.max(14, fontSize - 1)" title="减小字号">A−</button>
            <span class="font-val">{{ fontSize }}px</span>
            <button class="tool-btn" @click="fontSize = Math.min(24, fontSize + 1)" title="增大字号">A+</button>
          </div>
        </div>
      </div>

      <!-- 单元内文章列表（如果有多个） -->
      <div class="unit-articles" v-if="currentUnit && getUnitArticles().length > 1">
        <div class="unit-articles-label">本单元共 {{ getUnitArticles().length }} 篇</div>
        <div class="unit-articles-list">
          <button
            v-for="(a, i) in getUnitArticles()"
            :key="i"
            class="article-chip"
            :class="{ active: currentArticle && currentArticle.title === a.title }"
            @click="selectArticle(a)"
          >{{ a.title }}</button>
        </div>
      </div>

      <!-- 文章内容 -->
      <div class="content-scroll">
        <template v-if="currentArticle">
          <article class="article-body" :style="{ fontSize: fontSize + 'px' }">
            <h1 class="article-h1">{{ currentArticle.title }}</h1>
            <p v-if="currentArticle.author" class="article-by">—— {{ currentArticle.author }}</p>
            <div class="article-text">{{ currentArticle.content }}</div>
          </article>
        </template>
        <!-- 无数据 -->
        <div v-else-if="currentUnit && (!currentUnits || currentUnits.length === 0 || !getUnitArticles().length)" class="placeholder">
          <div class="ph-icon">📭</div>
          <div class="ph-text">暂无数据，后续补充</div>
        </div>
        <div v-else-if="!currentSubject" class="placeholder">
          <div class="ph-icon">👉</div>
          <div class="ph-text">请先选择学科和单元</div>
        </div>
        <div v-else class="placeholder">
          <div class="ph-icon">📖</div>
          <div class="ph-text">请选择一个单元查看全文</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'

// 静态年级/学科顺序
const grades = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']

const catalog = ref(null)

const currentGrade = ref('九年级')
const currentSubject = ref('语文')
const currentUnit = ref('')
const fontSize = ref(18)
const currentArticle = ref(null)

// ========== 加载 catalog ==========
async function loadCatalog() {
  try {
    catalog.value = await window.api.catalog()
  } catch (e) {
    console.warn('[catalog] 加载失败:', e.message)
    catalog.value = null
  }
}

// ========== 计算 ==========
const gradeData = computed(() => catalog.value?.[currentGrade.value] || null)
const subjectData = computed(() => gradeData.value?.[currentSubject.value] || null)
const currentUnits = computed(() => {
  const u = subjectData.value
  if (!u || typeof u !== 'object') return []
  return Object.keys(u)
})

function hasSubjectData(s) {
  const g = catalog.value?.[currentGrade.value]
  if (!g) return false
  const d = g[s]
  return d && typeof d === 'object' && Object.keys(d).length > 0
}

function getUnitArticles() {
  if (!subjectData.value || !currentUnit.value) return []
  return subjectData.value[currentUnit.value] || []
}

// ========== 选择 ==========
function selectGrade(g) {
  currentGrade.value = g
  // 如果当前学科在新年级无数据 → 自动切到第一个有数据的学科
  if (!hasSubjectData(currentSubject.value)) {
    const first = subjects.find(s => hasSubjectData(s))
    currentSubject.value = first || ''
  }
  currentUnit.value = ''
  currentArticle.value = null
  ensureUnit()
}

function selectSubject(s) {
  currentSubject.value = s
  currentUnit.value = ''
  currentArticle.value = null
  ensureUnit()
}

function selectUnit(u) {
  currentUnit.value = u
  const articles = getUnitArticles()
  currentArticle.value = articles[0] || null
}

function selectArticle(a) {
  currentArticle.value = a
}

// 确保 unit 自动选中（切换年级/学科后自动挑第一个有数据的单元）
function ensureUnit() {
  if (currentUnits.value.length > 0 && !currentUnit.value) {
    selectUnit(currentUnits.value[0])
  }
}

onMounted(async () => {
  await loadCatalog()
  // 加载完后确保 unit / article 都选中
  ensureUnit()
  if (!currentArticle.value) {
    const articles = getUnitArticles()
    currentArticle.value = articles[0] || null
  }
})
</script>

<style scoped>
.cat-page {
  padding: 20px;
  display: flex;
  gap: 16px;
  min-height: 100%;
}

/* ====== 左侧 sidebar ====== */
.cat-sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  gap: 4px;
}
.cat-sidebar .divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--surface-4), transparent);
  margin: 12px 4px;
}

.seg-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.seg-title {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
  font-weight: 600;
}
.seg-group {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.seg-btn {
  flex: 0 0 auto;
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 8px;
  background: var(--surface-1);
  border: var(--border-subtle);
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 0;
  padding-inline: 10px;
}
.seg-btn:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text-main);
  border-color: rgba(0, 212, 255, 0.25);
  transform: translateY(-1px);
}
.seg-btn.active {
  background: var(--accent-gradient);
  color: #fff;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 212, 255, 0.35);
  font-weight: 600;
}
.seg-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.seg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  color: var(--text-dim);
}
.seg-empty {
  font-size: 9px;
  opacity: 0.6;
  margin-left: 2px;
}

/* 年级：大号分段控制器 */
.seg-group.grades .seg-btn {
  font-size: 13px;
  padding: 7px 10px;
  font-weight: 500;
}

/* 单元按钮更窄 */
.seg-group.units {
  flex-direction: column;
  flex-wrap: nowrap;
}
.seg-group.units .seg-btn {
  text-align: left;
  font-size: 12px;
  padding: 7px 12px;
}
.seg-group.units .seg-btn.active {
  border-left: 3px solid #fff;
}

.units-empty {
  font-size: 11px;
  color: var(--text-dim);
  padding: 8px 4px;
}

/* ====== 右侧主内容 ====== */
.cat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.content-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: var(--border-subtle);
  background: linear-gradient(180deg, rgba(0, 212, 255, 0.06), transparent);
}
.content-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.article-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}
.article-author {
  font-size: 12px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.content-tools {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}
.font-ctrl {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-1);
  padding: 3px 6px;
  border-radius: 8px;
  border: var(--border-subtle);
}
.font-val {
  font-size: 11px;
  color: var(--text-dim);
  font-family: Consolas, monospace;
  min-width: 38px;
  text-align: center;
}
.tool-btn {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 6px;
  min-width: 28px;
  background: transparent;
  border: var(--border-subtle);
  color: var(--text-sub);
}
.tool-btn:hover {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

/* 单元内文章切换 */
.unit-articles {
  padding: 10px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: var(--border-subtle);
  flex-wrap: wrap;
}
.unit-articles-label {
  font-size: 11px;
  color: var(--text-dim);
  flex-shrink: 0;
}
.unit-articles-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}
.article-chip {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 999px;
  background: var(--surface-1);
  border: var(--border-subtle);
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}
.article-chip:hover {
  background: var(--surface-3);
  color: var(--text-main);
}
.article-chip.active {
  background: rgba(0, 212, 255, 0.15);
  color: var(--accent);
  border-color: rgba(0, 212, 255, 0.4);
}

/* 正文区 */
.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px 40px 40px;
}
.article-body {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.8;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
}
.article-h1 {
  font-size: 1.8em;
  font-weight: bold;
  text-align: center;
  margin-bottom: 6px;
  color: var(--text-main);
  background: linear-gradient(135deg, #fff, #c4c4ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.article-by {
  text-align: center;
  font-size: 0.9em;
  color: var(--text-dim);
  margin-bottom: 28px;
}
.article-text {
  white-space: pre-wrap;
}

/* 占位 */
.placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-dim);
}
.ph-icon {
  font-size: 48px;
  opacity: 0.5;
}
.ph-text {
  font-size: 13px;
}
</style>
