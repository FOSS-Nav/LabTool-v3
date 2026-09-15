/**
 * LabTool-V3 状态栏
 *
 * 显示时钟、帧计数；带「捕获数据」按钮：
 *   - 未捕获：显示「● 捕获数据」按钮（点击弹出对话框）
 *   - 捕获中：显示「⏹ 停止」按钮 + 文件路径
 *
 * 三个文件：
 *   <NAME>_IMU_HEX.bin  — IMU 原始字节
 *   <NAME>_GNSS.txt     — GNSS 原始 NMEA/NovAtel 文本
 *   <NAME>_IMU_GNSS.bin — 解析后同步数据（每帧 = seq + IMU floats + GNSS floats）
 *   - 若 GNSS 串口未打开：<NAME>_IMU.bin（无 GNSS 列）
 */

import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { useT } from '../../i18n'
import { CaptureDialog } from './capture-dialog'
import './StatusBar.css'

interface Props {
  errorMsg?: string | null
  onClearError(): void
}

export function StatusBar({ errorMsg, onClearError }: Props): JSX.Element {
  const t = useT()
  const frameCounter = useStore((s) => s.frameCounter)
  const recState = useStore((s) => s.recState)
  const setRecording = useStore((s) => s.setRecording)
  const setRecState = useStore((s) => s.setRecState)
  const fields = useStore((s) => s.fields)
  const gnssStatus = useStore((s) => s.gnss.status)

  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    const ti = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(ti)
  }, [])

  // 启动时拉取一次主进程状态
  useEffect(() => {
    void window.labtool.getRecorderState().then((s) => {
      if (s) {
        setRecState(s)
        setRecording(s)
      }
    })
  }, [setRecState, setRecording])

  const hh = Math.floor(elapsed / 3600).toString().padStart(2, '0')
  const mm = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const ss = (elapsed % 60).toString().padStart(2, '0')

  /** Data 行字段 */
  const dataFields = fields.filter((f) => f.role === 'Data')
  const imuFieldCount = dataFields.length
  const imuFieldNames = dataFields.map((f) => f.name)

  function handleOpenCapture(): void {
    setLocalError(null)
    setDialogOpen(true)
  }

  async function handleDialogClose(name: string | null): Promise<void> {
    setDialogOpen(false)
    if (!name) return  // 用户取消
    setBusy(true)
    try {
      const r = await window.labtool.startRecorder({
        baseName: name,
        outDir: '.',
        enableGnss: gnssStatus === 'open',
        imuChannelBytes: 4,
        imuFieldCount,
        imuFieldNames
      })
      if (!r.ok) {
        setLocalError(r.error ?? '启动失败')
        return
      }
      if (r.state) setRecording(r.state)
    } finally {
      setBusy(false)
    }
  }

  async function handleStopCapture(): Promise<void> {
    setBusy(true)
    try {
      await window.labtool.stopRecorder()
      setRecording(null)
    } finally {
      setBusy(false)
    }
  }

  const recording = !!recState
  const displayError = localError ?? errorMsg

  return (
    <>
      <div className="status-bar">
        <span className="sb-item sb-clock">⏱ {hh}:{mm}:{ss}</span>
        <span className="sb-divider" />
        <span className="sb-item sb-frame">{t('status.frame')}: {frameCounter}</span>
        <span className="sb-spacer" />
        {displayError && (
          <span className="sb-error" onClick={() => { setLocalError(null); onClearError() }}>
            ⚠ {displayError} (×)
          </span>
        )}
        <span className="sb-divider" />
        {recording ? (
          <span className="sb-recinfo sb-recinfo-active">
            <span className="sb-rec-dot" />
            <span className="sb-rec-paths">
              {recState!.imuHexPath.split(/[\\/]/).pop()}
              {recState!.gnssTxtPath ? ' · ' + recState!.gnssTxtPath.split(/[\\/]/).pop() : ''}
              {' · '}
              {recState!.parsedBinPath.split(/[\\/]/).pop()}
              {' · '}
              {recState!.parsedTxtPath.split(/[\\/]/).pop()}
              {'  '}
              <span className="sb-rec-counters">
                {recState!.imuHexBytes}B · {recState!.gnssTxtBytes}B · {recState!.parsedBinFrames}帧 · {recState!.parsedTxtBytes}B
              </span>
            </span>
          </span>
        ) : (
          <span className="sb-recinfo">{t('status.notRecording')}</span>
        )}
        {recording ? (
          <button
            className="sb-rec-btn stop"
            onClick={() => void handleStopCapture()}
            disabled={busy}
          >
            ⏹ {t('status.recStop')}
          </button>
        ) : (
          <button
            className="sb-rec-btn start"
            onClick={handleOpenCapture}
            disabled={busy}
          >
            ● {t('status.recStart')}
          </button>
        )}
      </div>
      {dialogOpen && <CaptureDialog onClose={(name) => void handleDialogClose(name)} />}
    </>
  )
}
