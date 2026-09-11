/**
 * LabTool-V3 协议帧编辑器
 * 对应 V2 mainwindow.cpp 中：
 *   - 协议帧表格 (7 列)
 *   - 插入帧头/帧尾/时间戳/校验和 行
 *   - "确认数据帧" 按钮 → 编译 FrameDescriptor 并发给主进程
 *   - 加载/保存 .txt 配置
 */

import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { DataKind, DataTypeName, Endian, FrameDescriptor, compileDescriptor } from '@shared'
import { useT } from '../../i18n'
import './FrameEditor.css'

interface Props {
  onError(msg: string): void
}

export function FrameEditor({ onError }: Props): JSX.Element {
  const t = useT()
  const fields = useStore((s) => s.fields)
  const endian = useStore((s) => s.endian)
  const confirmed = useStore((s) => s.confirmed)

  const addRow = useStore((s) => s.addRow)
  const insertRow = useStore((s) => s.insertRow)
  const deleteRow = useStore((s) => s.deleteRow)
  const updateField = useStore((s) => s.updateField)
  const setPlotFlag = useStore((s) => s.setPlotFlag)
  const setEndian = useStore((s) => s.setEndian)
  const confirm = useStore((s) => s.confirm)
  const toggleConfirm = useStore((s) => s.toggleConfirm)
  const toCsv = useStore((s) => s.toCsv)
  const parseFromCsv = useStore((s) => s.parseFromCsv)

  const [derivedPreview, setDerivedPreview] = useState<{
    frameLen: number
    headerLen: number
    checksumPos: number
    timestampPos: number
  } | null>(null)

  // 预览：实时显示当前表格的 frameLen / 帧头等
  useEffect(() => {
    try {
      const d = compileDescriptor(fields, endian).derived!
      setDerivedPreview({
        frameLen: d.frameLen,
        headerLen: d.headerLen,
        checksumPos: d.checksumPos,
        timestampPos: d.timestampPos
      })
    } catch (e) {
      setDerivedPreview(null)
      // 不在每次输入时弹错误，hover 提示即可
    }
  }, [fields, endian])

  // 通知主进程切换描述符（仅在已确认状态下）
  useEffect(() => {
    if (!confirmed) return
    try {
      const desc: FrameDescriptor = {
        fields,
        endian,
        derived: compileDescriptor(fields, endian).derived
      }
      void window.labtool.setDescriptor(desc)
    } catch (e) {
      onError((e as Error).message)
    }
  }, [confirmed, fields, endian, onError])

  /* ============================================================
   * 操作
   * ============================================================ */
  function handleConfirm(): void {
    try {
      const d = compileDescriptor(fields, endian)
      if (!d.derived || d.derived.frameLen === 0) {
        onError(t('frame.frameLen') + ': 0')
        return
      }
      confirm()
    } catch (e) {
      onError((e as Error).message)
    }
  }

  async function handleLoad(): Promise<void> {
    const r = await window.labtool.loadConfig()
    if (r.canceled) return
    if (!r.ok || !r.content) {
      onError(r.error ?? '加载失败')
      return
    }
    parseFromCsv(r.content)
  }

  async function handleSave(): Promise<void> {
    const content = toCsv()
    const r = await window.labtool.saveConfig(content)
    if (r.canceled) return
    if (!r.ok) onError(r.error ?? '保存失败')
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  return (
    <div className="frame-editor">
      <div className="fe-toolbar">
        <button className="fe-btn" disabled={confirmed} onClick={() => insertRow(0, 'Frame_Header')}>
          {t('frame.insertHeader')}
        </button>
        <button className="fe-btn" disabled={confirmed} onClick={() => insertRow(0, 'Time_Stamp')}>
          {t('frame.insertTimestamp')}
        </button>
        <button className="fe-btn" disabled={confirmed} onClick={() => addRow('Check_Sum')}>
          {t('frame.appendChecksum')}
        </button>
        <button className="fe-btn" disabled={confirmed} onClick={() => addRow()}>
          {t('frame.addData')}
        </button>
        <button className="fe-btn danger" disabled={confirmed} onClick={() => {
          const idx = fields.length - 1
          if (idx >= 0) deleteRow(idx)
        }}>
          {t('frame.deleteLast')}
        </button>
        <span className="fe-divider" />
        <button className="fe-btn" disabled={confirmed} onClick={handleLoad}>{t('frame.loadConfig')}</button>
        <button className="fe-btn" disabled={confirmed} onClick={handleSave}>{t('frame.saveConfig')}</button>
        <span className="fe-divider" />
        <label className="fe-endian">
          {t('frame.endian')}：
          <select
            value={endian}
            disabled={confirmed}
            onChange={(e) => setEndian(Number(e.target.value) as Endian)}
          >
            <option value={Endian.Little}>{t('frame.endian.little')}</option>
            <option value={Endian.Big}>{t('frame.endian.big')}</option>
          </select>
        </label>
        <span className="fe-spacer" />
        <button
          className={'fe-btn primary ' + (confirmed ? 'active' : '')}
          onClick={confirmed ? toggleConfirm : handleConfirm}
        >
          {confirmed ? t('frame.edit') : t('frame.confirm')}
        </button>
      </div>

      <div className="fe-table-wrap">
        <table className="fe-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th style={{ width: 140 }}>{t('frame.name')}</th>
              <th style={{ width: 120 }}>{t('frame.role')}</th>
              <th style={{ width: 130 }}>{t('frame.type')}</th>
              <th style={{ width: 110 }}>{t('frame.default')}</th>
              <th style={{ width: 100 }}>{t('frame.scale')}</th>
              <th style={{ width: 36 }}>{t('frame.plot1')}</th>
              <th style={{ width: 36 }}>{t('frame.plot2')}</th>
              <th style={{ width: 36 }}>{t('frame.plot3')}</th>
              {!confirmed && <th style={{ width: 36 }}>{t('frame.del')}</th>}
            </tr>
          </thead>
          <tbody>
            {fields.map((f, idx) => {
              const isSpecialRow = f.role !== 'Data'
              return (
                <tr key={f.id} className={isSpecialRow ? 'fe-row-special' : ''}>
                  <td className="fe-cell-num">{idx}</td>
                  <td>
                    <input
                      className="fe-input"
                      disabled={confirmed || f.role !== 'Data'}
                      value={f.name}
                      onChange={(e) => updateField(f.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="fe-input"
                      disabled={confirmed}
                      value={f.role}
                      onChange={(e) => updateField(f.id, { role: e.target.value as typeof f.role })}
                    >
                      <option value="Frame_Header">{t('frame.role.header')}</option>
                      <option value="Time_Stamp">{t('frame.role.timestamp')}</option>
                      <option value="Data">{t('frame.role.data')}</option>
                      <option value="Check_Sum">{t('frame.role.checksum')}</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="fe-input"
                      disabled={confirmed}
                      value={f.type}
                      onChange={(e) => updateField(f.id, { type: Number(e.target.value) as DataKind })}
                    >
                      {Object.entries(DataTypeName).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="fe-input"
                      disabled={confirmed}
                      value={f.defaultValue}
                      onChange={(e) => updateField(f.id, { defaultValue: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="fe-input"
                      disabled={confirmed}
                      value={f.scale === 9999.99 ? '/' : String(f.scale)}
                      onChange={(e) => {
                        const v = e.target.value.trim()
                        if (v === '/' || v === '') updateField(f.id, { scale: 9999.99 })
                        else {
                          const n = Number(v)
                          if (Number.isFinite(n)) updateField(f.id, { scale: n })
                        }
                      }}
                    />
                  </td>
                  <td className="fe-cell-plot">
                    <input
                      type="checkbox"
                      disabled={confirmed || f.role !== 'Data'}
                      checked={f.isPlot1}
                      onChange={(e) => setPlotFlag(f.id, 1, e.target.checked)}
                    />
                  </td>
                  <td className="fe-cell-plot">
                    <input
                      type="checkbox"
                      disabled={confirmed || f.role !== 'Data'}
                      checked={f.isPlot2}
                      onChange={(e) => setPlotFlag(f.id, 2, e.target.checked)}
                    />
                  </td>
                  <td className="fe-cell-plot">
                    <input
                      type="checkbox"
                      disabled={confirmed || f.role !== 'Data'}
                      checked={f.isPlot3}
                      onChange={(e) => setPlotFlag(f.id, 3, e.target.checked)}
                    />
                  </td>
                  {!confirmed && (
                    <td className="fe-cell-del">
                      <button className="fe-btn-icon" onClick={() => deleteRow(idx)} title={t('frame.del')}>×</button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="fe-status">
        <span>{t('frame.frameLen')}: {derivedPreview?.frameLen ?? '—'} {t('frame.frameLenUnit')}</span>
        <span>{t('frame.headerLen')}: {derivedPreview?.headerLen ?? '—'} {t('frame.frameLenUnit')}</span>
        <span>
          {t('frame.timestampPos')}: {derivedPreview?.timestampPos === -1 ? t('frame.timestampAbsent') : derivedPreview?.timestampPos ?? '—'}
        </span>
        <span>
          {t('frame.checksumPos')}: {derivedPreview?.checksumPos === -1 ? t('frame.timestampAbsent') : derivedPreview?.checksumPos ?? '—'}
        </span>
        <span className="fe-spacer" />
        <span className={confirmed ? 'fe-confirmed' : 'fe-pending'}>
          {confirmed ? t('frame.confirmed') : t('frame.unconfirmed')}
        </span>
      </div>
    </div>
  )
}
