const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // ============ 数据库（与 db-handlers.js 注册的 channel 一一对应） ============
  // 年级
  getGrades: () => ipcRenderer.invoke('db:getGrades'),
  addGrade: (name, sortOrder) => ipcRenderer.invoke('db:addGrade', name, sortOrder),
  updateGrade: (id, name, sortOrder) => ipcRenderer.invoke('db:updateGrade', id, name, sortOrder),
  deleteGrade: (id) => ipcRenderer.invoke('db:deleteGrade', id),
  // 班级
  getClasses: (gradeId) => ipcRenderer.invoke('db:getClasses', gradeId),
  getAllClasses: () => ipcRenderer.invoke('db:getAllClasses'),
  addClass: (gradeId, name) => ipcRenderer.invoke('db:addClass', gradeId, name),
  updateClass: (id, name) => ipcRenderer.invoke('db:updateClass', id, name),
  deleteClass: (id) => ipcRenderer.invoke('db:deleteClass', id),
  // 学生
  getStudents: (classId) => ipcRenderer.invoke('db:getStudents', classId),
  addStudent: (classId, name, gender, weight) => ipcRenderer.invoke('db:addStudent', classId, name, gender, weight),
  updateStudent: (id, name, gender, weight) => ipcRenderer.invoke('db:updateStudent', id, name, gender, weight),
  updateStudentWeight: (id, weight) => ipcRenderer.invoke('db:updateStudentWeight', id, weight),
  deleteStudent: (id) => ipcRenderer.invoke('db:deleteStudent', id),
  // 学科
  getSubjects: (gradeId) => ipcRenderer.invoke('db:getSubjects', gradeId),
  addSubject: (name, gradeId) => ipcRenderer.invoke('db:addSubject', name, gradeId),
  updateSubject: (id, name, gradeId) => ipcRenderer.invoke('db:updateSubject', id, name, gradeId),
  deleteSubject: (id) => ipcRenderer.invoke('db:deleteSubject', id),
  // 题目
  getQuestions: (subjectId) => ipcRenderer.invoke('db:getQuestions', subjectId),
  addQuestion: (subjectId, title, content, weight) => ipcRenderer.invoke('db:addQuestion', subjectId, title, content, weight),
  updateQuestion: (id, title, content, weight) => ipcRenderer.invoke('db:updateQuestion', id, title, content, weight),
  deleteQuestion: (id) => ipcRenderer.invoke('db:deleteQuestion', id),
  // 抽背
  randomStudent: (classId) => ipcRenderer.invoke('db:randomStudent', classId),
  randomQuestion: (subjectId) => ipcRenderer.invoke('db:randomQuestion', subjectId),

  // ============ 模板 ============
  listTemplates: () => ipcRenderer.invoke('db:listTemplates'),
  applyTemplate: (file, clear) => ipcRenderer.invoke('db:applyTemplate', file, clear),

  // ============ TTS ============
  tts: {
    speak: (text) => ipcRenderer.invoke('tts:speak', text),
    listVoices: () => ipcRenderer.invoke('tts:listVoices')
  },

  // ============ 开机自启 ============
  autoLaunch: {
    set: (enable) => ipcRenderer.invoke('autoLaunch:set', enable),
    get: () => ipcRenderer.invoke('autoLaunch:get')
  },

  // ============ 应用配置 ============
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (cfg) => ipcRenderer.invoke('config:set', cfg)
  },

  // ============ Relay（云端连接） ============
  relay: {
    start: (url, name) => ipcRenderer.invoke('relay:start', url, name),
    stop: () => ipcRenderer.invoke('relay:stop'),
    status: () => ipcRenderer.invoke('relay:status'),
    refreshCode: () => ipcRenderer.invoke('relay:refreshCode'),
    listPaired: () => ipcRenderer.invoke('relay:listPaired'),
    removePaired: (clientKey) => ipcRenderer.invoke('relay:removePaired', clientKey),

    onMessage: (cb) => ipcRenderer.on('relay:message', (_e, d) => cb(d)),
    onConnected: (cb) => ipcRenderer.on('relay:connected', cb),
    onDisconnected: (cb) => ipcRenderer.on('relay:disconnected', cb),
    onRegistered: (cb) => ipcRenderer.on('relay:registered', (_e, d) => cb(d)),
    onPairCode: (cb) => ipcRenderer.on('relay:pairCode', (_e, d) => cb(d)),
    onError: (cb) => ipcRenderer.on('relay:error', (_e, d) => cb(d)),
    onServerError: (cb) => ipcRenderer.on('relay:serverError', (_e, d) => cb(d)),
    onReconnectFailed: (cb) => ipcRenderer.on('relay:reconnectFailed', cb),
    onPairedMobile: (cb) => ipcRenderer.on('relay:pairedMobile', (_e, d) => cb(d)),
    onPairedList: (cb) => ipcRenderer.on('relay:pairedList', (_e, d) => cb(d)),
    onRemovePairedOk: (cb) => ipcRenderer.on('relay:removePairedOk', (_e, d) => cb(d)),
    onUnpairedMobile: (cb) => ipcRenderer.on('relay:unpairedMobile', (_e, d) => cb(d))
  },

  // ============ 设置 ============
  settings: {
    info: () => ipcRenderer.invoke('settings:info'),
    openDir: () => ipcRenderer.invoke('settings:openDir'),
    backup: () => ipcRenderer.invoke('settings:backup'),
    restore: () => ipcRenderer.invoke('settings:restore'),
    resetData: () => ipcRenderer.invoke('settings:resetData'),
    version: () => ipcRenderer.invoke('settings:version')
  },

  // ============ 网络 ============
  net: {
    lanIp: () => ipcRenderer.invoke('net:lan-ip')
  }
})
