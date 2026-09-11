/**
 * LabTool-V3 状态栏
 * 对应 V2 ui->label_showTiming + label_showRecvFrameNum + label_showFileInfo
 */

import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { useT } from '../../i18n'
import './StatusBar.css'

interface Props {
  xMode: 'count' | 'timestamp'
  setXMode(m: 'count' | 'timestamp'): void
  errorMsg?: string | null
  onClearError(): void
}

export function StatusBar({ xMode, setXMode, errorMsg, onClearError }: Props): JSX.Element {
  const t = useT()
  const frameCounter = useStore((s) => s.frameCounter)
  const recInfo = useStore((s) => s.recInfo)
  const recording = useStore((s) => s.recording)
  const setRecording = useStore((s) => s.setRecording)
  const fields = useStore((s) => s.fields)

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const ti = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(ti)
  }, [])

  const hh = Math.floor(elapsed / 3600).toString().padStart(2, '0')
  const mm = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const ss = (elapsed % 60).toString().padStart(2, '0')

  async function handleRecordToggle(): Promise<void> {
    if (recording) {
      const r = await window.labtool.stopRecorder()
      if (r.ok) setRecording(false)
    } else {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const dataFieldNames = fields.filter((f) => f.role === 'Data').map((f) => f.name)
      const alignGnss = useStore.getState().gnss.active
      const r = await window.labtool.startRecorder(
        `${ts}.txt`,
        dataFieldNames,
        alignGnss
      )
      if (r.ok) setRecording(true, { txtPath: `${ts}.txt`, binPath: `${ts}.bin` })
    }
  }

  return (
    <div className="status-bar">
      <span className="sb-item sb-clock">⏱ {hh}:{mm}:{ss}</span>
      <span className="sb-divider" />
      <span className="sb-item sb-frame">{t('status.frame')}: {frameCounter}</span>
      <span className="sb-divider" />
      <label className="sb-xmode">
        {t('status.xAxis')}：
        <select value={xMode} onChange={(e) => setXMode(e.target.value as 'count' | 'timestamp')}>
          <option value="count">{t('status.xAxis.count')}</option>
          <option value="timestamp">{t('status.xAxis.timestamp')}</option>
        </select>
      </label>
      <span className="sb-spacer" />
      {errorMsg && (
        <span className="sb-error" onClick={onClearError}>⚠ {errorMsg} (×)</span>
      )}
      <span className="sb-divider" />
      <span className="sb-recinfo">
        {recording ? (
          <>
            <span className="sb-rec-dot" />
            {t('status.recording')} ·{' '}
            {t('status.recInfo', {
              lines: recInfo.lines,
              kb: (recInfo.bytes / 1024).toFixed(1)
            })}
          </>
        ) : (
          t('status.notRecording')
        )}
      </span>
      <button
        className={'sb-rec-btn ' + (recording ? 'stop' : 'start')}
        onClick={() => void handleRecordToggle()}
      >
        {recording ? t('status.recStop') : t('status.recStart')}
      </button>
    </div>
  )
}
