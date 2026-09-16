; ============================================================
; 班级管理大师 · 单文件便携引导器
; 策略：单 exe 分发，首次运行解压到 %LOCALAPPDATA%\ClassManager\runtime-<版本>，
;       完成标记(.runtime-version)存在则视为完整，之后直接启动（约 0.7 秒）；
;       解压中断会留下无标记的半残目录，下次启动自动删除重来；
;       新版本写入新的 runtime 目录并清理旧版本。
;       注入 PORTABLE_EXECUTABLE_DIR，main.js 据此把数据目录放在引导 exe 旁边。
; 注意：
;   - 不要用 SetCompressor /SOLID：electron-builder 自带 NSIS 的 solid 块
;     在本机运行时会中途回滚，普通 lzma 稳定且体积基本一致。
;   - 不要用 Rename 搬目录：该发行版 Rename 目录失败，直接解压到正式目录。
; 编译参数（make-portable.ps1 传入）：
;   SRCDIR/VERSION/OUTDIR/OUTFILE/ICON
; ============================================================
Unicode true
ManifestDPIAware true
SetCompressor lzma
RequestExecutionLevel user
SilentInstall silent

!define RUNTIME_BASE "$LOCALAPPDATA\ClassManager"
!define RUNTIME_DIR  "$LOCALAPPDATA\ClassManager\runtime-${VERSION}"
!define APP_EXE      "班级管理大师.exe"
!define READY_MARK   ".runtime-version"

Name "班级管理大师"
OutFile "${OUTDIR}\${OUTFILE}"
Icon "${ICON}"

Section ""
  ; ---- 完整解压过（完成标记存在）→ 直接启动 ----
  IfFileExists "${RUNTIME_DIR}\${READY_MARK}" launch

  ; ---- 首次运行 / 新版本 / 上次解压中断：解压 ----
  Banner::show "$\r$\n班级管理大师首次启动准备中，请稍候……$\r$\n$\r$\n正在解压运行文件，约需 10～30 秒（仅第一次需要）$\r$\n"
  Pop $0

  ; 清掉半残目录后直接解压到正式目录（标记文件最后写入）
  RMDir /r "${RUNTIME_DIR}"
  SetOutPath "${RUNTIME_DIR}"
  File /r "${SRCDIR}\*.*"

  ; 完成标记：版本号；存在即代表解压完整
  FileOpen $9 "${RUNTIME_DIR}\${READY_MARK}" w
  FileWrite $9 "${VERSION}$\r$\n"
  FileClose $9

  ; 清理其他旧版本 runtime 目录
  FindFirst $0 $1 "${RUNTIME_BASE}\runtime-*"
  cleanupLoop:
    StrCmp $1 "" cleanupDone
    StrCmp $1 "runtime-${VERSION}" cleanupNext
    RMDir /r "${RUNTIME_BASE}\$1"
    cleanupNext:
    FindNext $0 $1
    Goto cleanupLoop
  cleanupDone:
  FindClose $0

  Banner::destroy

  launch:
  ; 便携数据目录跟随引导 exe 所在位置（与绿色版/.portable 行为一致）
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_DIR", "$EXEDIR").r0'

  ExecWait '"${RUNTIME_DIR}\${APP_EXE}"' $2
  SetErrorLevel $2
SectionEnd
