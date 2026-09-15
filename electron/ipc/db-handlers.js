const fs = require('fs')
const path = require('path')

function register(ipcMain, db) {
  // 年级
  ipcMain.handle('db:getGrades', () => db.getGrades())
  ipcMain.handle('db:addGrade', (_e, name, sortOrder) => db.addGrade(name, sortOrder))
  ipcMain.handle('db:updateGrade', (_e, id, name, sortOrder) => db.updateGrade(id, name, sortOrder))
  ipcMain.handle('db:deleteGrade', (_e, id) => db.deleteGrade(id))

  // 班级
  ipcMain.handle('db:getClasses', (_e, gradeId) => db.getClasses(gradeId))
  ipcMain.handle('db:getAllClasses', () => db.getClasses(null))
  ipcMain.handle('db:addClass', (_e, gradeId, name) => db.addClass(gradeId, name))
  ipcMain.handle('db:updateClass', (_e, id, name) => db.updateClass(id, name))
  ipcMain.handle('db:deleteClass', (_e, id) => db.deleteClass(id))

  // 学生（支持 weight）
  ipcMain.handle('db:getStudents', (_e, classId) => db.getStudents(classId))
  ipcMain.handle('db:addStudent', (_e, classId, name, gender, weight) => db.addStudent(classId, name, gender, weight))
  ipcMain.handle('db:updateStudent', (_e, id, name, gender, weight) => db.updateStudent(id, name, gender, weight))
  ipcMain.handle('db:updateStudentWeight', (_e, id, weight) => db.updateStudentWeight(id, weight))
  ipcMain.handle('db:deleteStudent', (_e, id) => db.deleteStudent(id))

  // 学科（现在绑定年级）
  ipcMain.handle('db:getSubjects', (_e, gradeId) => db.getSubjects(gradeId))
  ipcMain.handle('db:addSubject', (_e, name, gradeId) => db.addSubject(name, gradeId))
  ipcMain.handle('db:updateSubject', (_e, id, name, gradeId) => db.updateSubject(id, name, gradeId))
  ipcMain.handle('db:deleteSubject', (_e, id) => db.deleteSubject(id))

  // 题目（unit/category 支持）
  ipcMain.handle('db:getQuestions', (_e, subjectId, options) => db.getQuestions(subjectId, options || {}))
  ipcMain.handle('db:getUnits', (_e, subjectId, category) => db.getUnits(subjectId, category || 'recit'))
  ipcMain.handle('db:addQuestion', (_e, subjectId, title, content, unit, category) => db.addQuestion(subjectId, title, content, unit || '', category || 'recit'))
  ipcMain.handle('db:updateQuestion', (_e, id, title, content, unit, category) => db.updateQuestion(id, title, content, unit, category))
  ipcMain.handle('db:deleteQuestion', (_e, id) => db.deleteQuestion(id))

  // 加权随机抽（学生自动跳过 cooldown）
  ipcMain.handle('db:randomStudent', (_e, classId, skipCooldown) => db.randomStudent(classId, skipCooldown !== false))
  ipcMain.handle('db:randomQuestion', (_e, subjectId, options) => db.randomQuestion(subjectId, options || {}))

  // cooldown 管理
  ipcMain.handle('db:updateStudentCooldown', (_e, id, cooldown) => db.updateStudentCooldown(id, cooldown))
  ipcMain.handle('db:tickCooldowns', (_e, classId) => db.tickCooldowns(classId))

  // 模板
  ipcMain.handle('db:listTemplates', () => {
    const dir = path.join(__dirname, '..', 'templates')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && f !== 'catalog.json')
      .map(f => {
        try {
          const tpl = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
          // 没有 name 字段的不是有效模板（如教材目录数据），直接跳过
          if (!tpl.name || !Array.isArray(tpl.grades)) return null
          return { file: f, name: tpl.name, description: tpl.description }
        } catch { return null }
      })
      .filter(Boolean)
  })

  // ============ 教材目录（纯 JSON，与 SQLite 解耦）============
  ipcMain.handle('catalog:get', () => {
    const p = path.join(__dirname, '..', 'templates', 'catalog.json')
    if (!fs.existsSync(p)) return null
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch { return null }
  })

  ipcMain.handle('db:applyTemplate', (_e, file, clear) => {
    const tplPath = path.join(__dirname, '..', 'templates', file)
    if (!fs.existsSync(tplPath)) return { error: '模板文件不存在' }
    let template
    try {
      template = JSON.parse(fs.readFileSync(tplPath, 'utf-8'))
    } catch (e) {
      return { error: '模板解析失败: ' + e.message }
    }
    template.clear = !!clear
    return db.applyTemplate(template)
  })
}

module.exports = { register }
