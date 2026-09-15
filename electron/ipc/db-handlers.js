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

  // 题目
  ipcMain.handle('db:getQuestions', (_e, subjectId) => db.getQuestions(subjectId))
  ipcMain.handle('db:addQuestion', (_e, subjectId, title, content, weight) => db.addQuestion(subjectId, title, content, weight))
  ipcMain.handle('db:updateQuestion', (_e, id, title, content, weight) => db.updateQuestion(id, title, content, weight))
  ipcMain.handle('db:deleteQuestion', (_e, id) => db.deleteQuestion(id))

  // 加权随机抽
  ipcMain.handle('db:randomStudent', (_e, classId) => db.randomStudent(classId))
  ipcMain.handle('db:randomQuestion', (_e, subjectId) => db.randomQuestion(subjectId))

  // 模板
  ipcMain.handle('db:listTemplates', () => {
    const dir = path.join(__dirname, '..', 'templates')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const tpl = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
          return { file: f, name: tpl.name, description: tpl.description }
        } catch { return { file: f, name: f, description: '' } }
      })
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
