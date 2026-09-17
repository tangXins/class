const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

/**
 * Windows SAPI TTS via PowerShell
 * 不依赖额外 npm 包，直接调用系统语音合成
 */
class TtsManager {
  constructor() {
    this.powershell = 'powershell.exe'
    this.tempDir = path.join(require('electron').app.getPath('temp'), 'tts-cache')
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true })
    this._voicesCache = null
  }

  /**
   * 朗读文本
   * @param {string} text 文本
   * @param {object} opts { lang: 'en'|'zh' 按语言挑选语音, rate: -10~10 语速 }
   */
  speak(text, opts = {}) {
    if (!text || text.trim().length === 0) return false
    const script = this.buildScript(text, opts)
    if (!script) return false
    try {
      const p = spawn(this.powershell, ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
        windowsHide: true,
        stdio: 'ignore'
      })
      p.unref()
      return true
    } catch (e) {
      console.error('TTS error:', e.message)
      return false
    }
  }

  /**
   * 朗读文本并等待系统语音真正播完（听写场景需要精确时序）
   */
  awaitSpeak(text, opts = {}) {
    if (!text || text.trim().length === 0) return Promise.resolve(false)
    const script = this.buildScript(text, opts)
    if (!script) return Promise.resolve(false)
    return new Promise((resolve) => {
      try {
        const p = spawn(this.powershell, ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
          windowsHide: true,
          stdio: 'ignore'
        })
        p.on('close', () => resolve(true))
        p.on('error', () => resolve(false))
        // 超时兜底，防止进程异常挂起（单词最多 8 秒）
        setTimeout(() => resolve(false), 12000)
      } catch { resolve(false) }
    })
  }

  // 构造 PowerShell 朗读脚本（供 speak / awaitSpeak 复用）
  buildScript(text, opts = {}) {
    // 转义单引号
    const safeText = text.replace(/'/g, "''").substring(0, 500)
    const rate = Number.isInteger(opts.rate) ? Math.max(-10, Math.min(10, opts.rate)) : 0

    // 需要英语语音时，按 Culture 挑选（未安装英语语音则抛错并回退默认语音）
    let selectLine = ''
    if (opts.lang === 'en') {
      selectLine = "try { $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet, [System.Speech.Synthesis.VoiceAge]::NotSet, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-US')) } catch {}"
    }

    // 用 Speak（同步）确保语音播完；加 Start-Sleep 保活进程
    return `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = ${rate}; ${selectLine} $s.Speak('${safeText}'); Start-Sleep -Milliseconds 300`
  }

  /**
   * 真实枚举系统已安装语音（异步，结果缓存）
   * 返回 [{ culture: 'zh-CN'|'en-US', name }]
   */
  getInstalledVoices() {
    if (this._voicesCache) return Promise.resolve(this._voicesCache)
    return new Promise((resolve) => {
      let settled = false
      const done = (v) => {
        if (settled) return
        settled = true
        this._voicesCache = v
        resolve(v)
      }
      const script = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.GetInstalledVoices() | ForEach-Object { $v = $_.VoiceInfo; Write-Output ("{0}|{1}" -f $v.Culture.Name, $v.Name) }`
      try {
        const p = spawn(this.powershell, ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
          windowsHide: true
        })
        let out = ''
        p.stdout.on('data', d => { out += d.toString() })
        p.on('error', () => done([]))
        p.on('close', () => {
          const voices = out.split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(line => {
              const i = line.indexOf('|')
              return i > 0 ? { culture: line.slice(0, i), name: line.slice(i + 1) } : null
            })
            .filter(Boolean)
          done(voices)
        })
        // 超时兜底，避免渲染进程一直等
        setTimeout(() => done(this._voicesCache || []), 8000)
      } catch { done([]) }
    })
  }

  // 向后兼容：同步返回最近一次枚举结果
  listVoices() {
    return this._voicesCache || []
  }
}

module.exports = TtsManager
