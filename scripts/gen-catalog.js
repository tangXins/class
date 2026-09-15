/**
 * 从 class-9-1.json 的 questions 数据生成教材目录 catalog.json
 * 输出到 electron/templates/catalog.json
 *
 * catalog 结构:
 * {
 *   "年级": {
 *     "九年级": {
 *       "语文": {
 *         "第一单元": [ { title, author, content }, ... ],
 *         ...
 *       },
 *       "数学": null, ...
 *     },
 *     "八年级": null, ...一年级~七年级 null...
 *   }
 * }
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'electron', 'templates', 'class-9-1.json')
const OUT = path.join(ROOT, 'electron', 'templates', 'catalog.json')

// 全部年级（一年级 ~ 九年级）
const ALL_GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
// 全部学科
const ALL_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('源文件不存在:', SRC)
    process.exit(1)
  }
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf-8'))
  const srcQuestions = raw.questions || {}

  const catalog = {}

  for (const grade of ALL_GRADES) {
    catalog[grade] = {}
    if (!srcQuestions[grade]) {
      // 没有该年级数据：全部学科 null
      for (const subject of ALL_SUBJECTS) catalog[grade][subject] = null
      continue
    }

    for (const subject of ALL_SUBJECTS) {
      const qs = srcQuestions[grade][subject]
      if (!Array.isArray(qs) || qs.length === 0) {
        catalog[grade][subject] = null
        continue
      }
      // 按 unit 分组
      const byUnit = {}
      for (const q of qs) {
        const unit = q.unit || '未分单元'
        if (!byUnit[unit]) byUnit[unit] = []
        byUnit[unit].push({
          title: q.title || '',
          author: q.author || '',
          content: q.content || ''
        })
      }
      catalog[grade][subject] = byUnit
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2), 'utf-8')

  // 统计
  let totalArticles = 0
  let totalUnits = 0
  const stats = []
  for (const grade of ALL_GRADES) {
    for (const subject of ALL_SUBJECTS) {
      const units = catalog[grade][subject]
      if (!units) continue
      const unitNames = Object.keys(units)
      const cnt = unitNames.reduce((n, u) => n + units[u].length, 0)
      totalArticles += cnt
      totalUnits += unitNames.length
      if (cnt > 0) stats.push(`${grade}/${subject}: ${unitNames.length}单元/${cnt}篇`)
    }
  }

  console.log('✅ 生成:', OUT)
  console.log('📊 统计:', totalUnits, '个单元,', totalArticles, '篇课文')
  stats.forEach(s => console.log('  -', s))
}

main()
