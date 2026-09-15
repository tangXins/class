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
  }

  speak(text) {
    if (!text || text.trim().length === 0) return
    // 转义单引号
    const safeText = text.replace(/'/g, "''").substring(0, 500)

    // 用 Speak（同步）确保语音播完；加 Start-Sleep 保活进程
    const script = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 0; $s.Speak('${safeText}'); Start-Sleep -Milliseconds 300`

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

  listVoices() {
    // Windows SAPI 默认提供 1-3 个语音，这里简化返回
    return [
      { name: 'Microsoft Huihui (zh-CN)', lang: 'zh-CN' },
      { name: 'Microsoft Yaoyao (zh-CN)', lang: 'zh-CN' },
      { name: 'Microsoft Kangkang (zh-CN)', lang: 'zh-CN' }
    ]
  }
}

module.exports = TtsManager
