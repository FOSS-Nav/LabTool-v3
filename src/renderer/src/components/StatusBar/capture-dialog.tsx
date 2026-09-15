/**
 * LabTool-Test 捕获数据对话框
 *
 * 使用普通 inline 渲染（不依赖 React Portal），由 App.tsx 在 captureDialogOpen 时挂载。
 */

import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import './capture-dialog.css'

interface Props {
  onClose(name: string | null): void
}

export function CaptureDialog({ onClose }: Props): JSX.Element {
  const t = useT()
  const defaultName = 'data-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const [name, setName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e?: { preventDefault?: () => void }): void {
    if (e && e.preventDefault) e.preventDefault()
    const v = name.trim()
    if (!v) return
    const cleaned = v.replace(/\.(txt|bin)$/i, '')
    onClose(cleaned)
  }

  return (
    <div className="cd-mask" onClick={() => onClose(null)}>
      <div className="cd-window" onClick={(e) => e.stopPropagation()}>
        <div className="cd-title">● {t('capture.title')}</div>
        <form onSubmit={handleSubmit}>
          <div className="cd-body">
            <p className="cd-hint">{t('capture.hint')}</p>
            <div className="cd-files">
              <div><code>&lt;NAME&gt;_IMU_HEX.bin</code> — {t('capture.f.imuHex')}</div>
              <div><code>&lt;NAME&gt;_GNSS.txt</code> — {t('capture.f.gnssTxt')}</div>
              <div><code>&lt;NAME&gt;_IMU[_GNSS].bin</code> — {t('capture.f.imuBin')}</div>
              <div><code>&lt;NAME&gt;_IMU[_GNSS].txt</code> — {t('capture.f.imuTxt')}</div>
              <div className="cd-files-hint">{t('capture.f.imuGnss')}</div>
            </div>
            <label className="cd-label">
              {t('capture.baseName')}
              <input
                ref={inputRef}
                className="cd-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                spellCheck={false}
              />
            </label>
          </div>
          <div className="cd-footer">
            <button type="button" className="cd-btn" onClick={() => onClose(null)}>
              {t('capture.cancel')}
            </button>
            <button type="submit" className="cd-btn primary">
              {t('capture.start')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
