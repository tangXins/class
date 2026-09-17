const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

class AppDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath
    this.db = null
  }

  async init() {
    const SQL = await initSqlJs()

    if (fs.existsSync(this.dbPath)) {
      const data = fs.readFileSync(this.dbPath)
      this.db = new SQL.Database(data)
    } else {
      this.db = new SQL.Database()
    }

    // 迁移守卫：建表 + 旧库加新列
    this.db.run(`
      CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grade_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        gender TEXT DEFAULT '',
        weight INTEGER DEFAULT 1,
        last_drawn TEXT
      );
      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grade_id INTEGER,
        name TEXT NOT NULL,
        FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        title TEXT DEFAULT '',
        content TEXT DEFAULT '',
        weight INTEGER DEFAULT 1,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      );
    `)

    // 迁移：给旧库加新列（dirty flag：只有真的改了表才 save）
    const changed = this.migrate()
    if (changed) this.save()
  }

  /** 返回是否真的做了 schema 变更 */
  migrate() {
    let changed = false

    // 检查 subjects.grade_id
    const subCols = this.query("PRAGMA table_info(subjects)")
    if (!subCols.find(c => c.name === 'grade_id')) {
      this.db.run('ALTER TABLE subjects ADD COLUMN grade_id INTEGER')
      const firstGrade = this.query('SELECT id FROM grades ORDER BY sort_order LIMIT 1')
      if (firstGrade[0]) this.db.run('UPDATE subjects SET grade_id=?', [firstGrade[0].id])
      changed = true
    }

    // 检查 students.weight
    const stuCols = this.query("PRAGMA table_info(students)")
    if (!stuCols.find(c => c.name === 'weight')) {
      this.db.run('ALTER TABLE students ADD COLUMN weight INTEGER DEFAULT 1')
      changed = true
    }
    if (!stuCols.find(c => c.name === 'last_drawn')) {
      this.db.run('ALTER TABLE students ADD COLUMN last_drawn TEXT')
      changed = true
    }

    // 检查 questions.weight / unit / category
    const qCols = this.query("PRAGMA table_info(questions)")
    if (!qCols.find(c => c.name === 'weight')) {
      this.db.run('ALTER TABLE questions ADD COLUMN weight INTEGER DEFAULT 1')
      changed = true
    }
    if (!qCols.find(c => c.name === 'unit')) {
      this.db.run("ALTER TABLE questions ADD COLUMN unit TEXT DEFAULT ''")
      changed = true
    }
    if (!qCols.find(c => c.name === 'category')) {
      this.db.run("ALTER TABLE questions ADD COLUMN category TEXT DEFAULT 'recit'")
      changed = true
    }

    // 检查 students.cooldown
    if (!stuCols.find(c => c.name === 'cooldown')) {
      this.db.run('ALTER TABLE students ADD COLUMN cooldown INTEGER DEFAULT 0')
      changed = true
    }

    // 一次性数据清理（PRAGMA user_version 守卫）：
    // v1 — 移除老师手动新增的自定义题（content 非空）。抽背篇目统一由教材目录提供，
    //      教材镜像题 content 为空，不受影响。
    const uvRow = this.query('PRAGMA user_version')
    const userVersion = uvRow[0] ? (uvRow[0].user_version || 0) : 0
    if (userVersion < 1) {
      this.db.run("DELETE FROM questions WHERE content IS NOT NULL AND TRIM(content) != ''")
      this.db.run('PRAGMA user_version = 1')
      changed = true
    }

    return changed
  }

  save() {
    const data = this.db.export()
    fs.writeFileSync(this.dbPath, Buffer.from(data))
  }

  close() { this.db?.close() }

  query(sql, params = []) {
    const stmt = this.db.prepare(sql)
    stmt.bind(params)
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  }

  run(sql, params = []) {
    this.db.run(sql, params)
  }

  // 取 last_insert_rowid：必须在 run() 之后、save() 之前调用
  lastId() {
    return this.db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  }

  // ========== 年级 ==========
  getGrades() { return this.query('SELECT * FROM grades ORDER BY sort_order, id') }
  addGrade(name, sortOrder = 0) {
    this.run('INSERT INTO grades (name, sort_order) VALUES (?, ?)', [name, sortOrder])
    const id = this.lastId()
    this.save()
    return id
  }
  updateGrade(id, name, sortOrder) { this.run('UPDATE grades SET name=?, sort_order=? WHERE id=?', [name, sortOrder, id]); this.save() }
  deleteGrade(id) { this.run('DELETE FROM grades WHERE id=?', [id]); this.save() }

  // ========== 班级 ==========
  getClasses(gradeId) {
    if (gradeId) return this.query('SELECT * FROM classes WHERE grade_id=? ORDER BY id', [gradeId])
    return this.query(`
      SELECT c.*, g.name as grade_name FROM classes c
      JOIN grades g ON c.grade_id = g.id
      ORDER BY g.sort_order, c.id
    `)
  }
  addClass(gradeId, name) {
    this.run('INSERT INTO classes (grade_id, name) VALUES (?, ?)', [gradeId, name])
    const id = this.lastId()
    this.save()
    return id
  }
  updateClass(id, name) { this.run('UPDATE classes SET name=? WHERE id=?', [name, id]); this.save() }
  deleteClass(id) { this.run('DELETE FROM classes WHERE id=?', [id]); this.save() }

  // ========== 学生 ==========
  getStudents(classId) { return this.query('SELECT * FROM students WHERE class_id=? ORDER BY id', [classId]) }
  addStudent(classId, name, gender = '', weight = 1) {
    this.run('INSERT INTO students (class_id, name, gender, weight) VALUES (?, ?, ?, ?)', [classId, name, gender, weight])
    const id = this.lastId()
    this.save()
    return id
  }
  updateStudent(id, name, gender, weight) {
    if (weight !== undefined && weight !== null) {
      this.run('UPDATE students SET name=?, gender=?, weight=? WHERE id=?', [name, gender, weight, id])
    } else {
      this.run('UPDATE students SET name=?, gender=? WHERE id=?', [name, gender, id])
    }
    this.save()
  }
  updateStudentWeight(id, weight) {
    this.run('UPDATE students SET weight=? WHERE id=?', [weight, id])
    this.save()
  }
  deleteStudent(id) { this.run('DELETE FROM students WHERE id=?', [id]); this.save() }

  // ========== 学科（现在绑定年级） ==========
  // 按年级查学科
  getSubjects(gradeId) {
    if (gradeId) {
      return this.query('SELECT * FROM subjects WHERE grade_id=? ORDER BY id', [gradeId])
    }
    return this.query('SELECT * FROM subjects ORDER BY id')
  }
  addSubject(name, gradeId) {
    this.run('INSERT INTO subjects (name, grade_id) VALUES (?, ?)', [name, gradeId || null])
    const id = this.lastId()
    this.save()
    return id
  }
  updateSubject(id, name, gradeId) {
    this.run('UPDATE subjects SET name=?, grade_id=? WHERE id=?', [name, gradeId || null, id])
    this.save()
  }
  deleteSubject(id) { this.run('DELETE FROM subjects WHERE id=?', [id]); this.save() }

  // ========== 题目 ==========
  // options: { unit, category } —— 可选筛选
  getQuestions(subjectId, options = {}) {
    let sql = 'SELECT * FROM questions WHERE subject_id=?'
    const params = [subjectId]
    if (options.category) { sql += ' AND category=?'; params.push(options.category) }
    if (options.units && options.units.length) {
      sql += ` AND unit IN (${options.units.map(() => '?').join(',')})`
      params.push(...options.units)
    }
    sql += ' ORDER BY id'
    return this.query(sql, params)
  }

  // 获取某学科所有已用单元（去重）
  getUnits(subjectId, category = 'recit') {
    return this.query('SELECT DISTINCT unit FROM questions WHERE subject_id=? AND category=? AND unit != "" ORDER BY id', [subjectId, category])
      .map(r => r.unit)
  }

  addQuestion(subjectId, title, content, unit = '', category = 'recit') {
    this.run('INSERT INTO questions (subject_id, title, content, unit, category, weight) VALUES (?, ?, ?, ?, ?, 1)', [subjectId, title, content, unit, category])
    const id = this.lastId()
    this.save()
    return id
  }
  updateQuestion(id, title, content, unit, category) {
    this.run('UPDATE questions SET title=?, content=?, unit=?, category=? WHERE id=?', [title, content, unit || '', category || 'recit', id])
    this.save()
  }
  deleteQuestion(id) { this.run('DELETE FROM questions WHERE id=?', [id]); this.save() }

  // ========== 学生权重 + cooldown ==========
  updateStudentCooldown(id, cooldown) {
    this.run('UPDATE students SET cooldown=? WHERE id=?', [Math.max(0, cooldown), id])
    this.save()
  }
  // 每轮抽完后所有 cooldown -1（不低于 0）
  tickCooldowns(classId) {
    this.run('UPDATE students SET cooldown = MAX(0, cooldown - 1) WHERE class_id=? AND cooldown > 0', [classId])
    this.save()
  }

  // 加权随机抽 —— 自动跳过 cooldown > 0 的学生
  randomStudent(classId, skipCooldown = true) {
    let students = this.getStudents(classId)
    if (skipCooldown) students = students.filter(s => !s.cooldown)
    if (!students.length) return null
    return this.weightedPick(students, 'weight')
  }

  // 题目：按 subjectId 查 + 纯随机（不再按 weight 抽，统一 1）
  randomQuestion(subjectId, options = {}) {
    const questions = this.getQuestions(subjectId, options)
    if (!questions.length) return null
    return questions[Math.floor(Math.random() * questions.length)]
  }

  // 加权随机算法：累计权重 / Math.random()
  weightedPick(list, weightKey = 'weight') {
    // 权重最低 1，避免 0 权重导致总权重变小
    const items = list.map(x => ({ ...x, _w: Math.max(1, x[weightKey] || 1) }))
    const total = items.reduce((s, x) => s + x._w, 0)
    let r = Math.random() * total
    for (const item of items) {
      r -= item._w
      if (r <= 0) return item
    }
    return items[items.length - 1]
  }

  // ========== 模板应用 ==========
  // template 结构:
  //   { grades: [{name, sortOrder, classes, subjects}],
  //     questions: { "年级名": { "学科名": [{title, unit, content, category}] } } }
  applyTemplate(template) {
    const result = { grades: 0, classes: 0, subjects: 0, students: 0, questions: 0 }

    // 先清空（可选：让用户选覆盖/追加，这里先追加）
    if (template.clear) {
      this.run('DELETE FROM questions')
      this.run('DELETE FROM students')
      this.run('DELETE FROM subjects')
      this.run('DELETE FROM classes')
      this.run('DELETE FROM grades')
    }

    for (const g of template.grades) {
      const gradeId = this.addGrade(g.name, g.sortOrder || 0)
      result.grades++

      // 年级对应的学科
      const subjects = g.subjects || template.defaultSubjects || []
      // 存学科名→subjectId 映射，后面导入 questions 要用
      const subjectNameToId = {}
      for (const s of subjects) {
        const name = typeof s === 'string' ? s : s.name
        const sid = this.addSubject(name, gradeId)
        subjectNameToId[name] = sid
        result.subjects++
      }

      // 导入该年级的 questions
      if (template.questions && template.questions[g.name]) {
        const gradeQs = template.questions[g.name]
        for (const [subjectName, qList] of Object.entries(gradeQs)) {
          const sid = subjectNameToId[subjectName]
          if (!sid) continue
          for (const q of qList) {
            this.addQuestion(sid, q.title || '', q.content || '', q.unit || '', q.category || 'recit')
            result.questions++
          }
        }
      }

      // 年级下的班级
      const classes = g.classes || []
      for (const c of classes) {
        let className, studentNames = []
        if (typeof c === 'string') {
          className = c
        } else {
          className = c.name
          studentNames = c.students || []
        }
        const classId = this.addClass(gradeId, className)
        result.classes++

        for (const stu of studentNames) {
          const name = typeof stu === 'string' ? stu : stu.name
          const gender = stu.gender || ''
          const weight = stu.weight || 1
          this.addStudent(classId, name, gender, weight)
          result.students++
        }
      }
    }
    return result
  }
}

module.exports = AppDatabase
