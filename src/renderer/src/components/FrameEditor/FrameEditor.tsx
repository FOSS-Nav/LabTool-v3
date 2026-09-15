/**
 * LabTool-V3 协议帧编辑器
 *
 * 操作模式：
 *   - 点击某行 → 选中（高亮）
 *   - 工具栏「在选中行下方插入」「删除选中行」基于选中索引操作
 *   - 未选中时，工具栏默认按钮「添加数据」「删除末行」可用
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
  const setEndian = useStore((s) => s.setEndian)
  const confirm = useStore((s) => s.confirm)
  const toggleConfirm = useStore((s) => s.toggleConfirm)
  const toCsv = useStore((s) => s.toCsv)
  const parseFromCsv = useStore((s) => s.parseFromCsv)

  /** 当前选中的行索引（null 表示未选中） */
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  // 选中索引若超出范围（删行后），自动归零
  useEffect(() => {
    if (selectedIdx !== null && selectedIdx >= fields.length) {
      setSelectedIdx(fields.length > 0 ? fields.length - 1 : null)
    }
  }, [fields.length, selectedIdx])

  const [derivedPreview, setDerivedPreview] = useState<{
    frameLen: number
    headerLen: number
    checksumPos: number
    timestampPos: number
  } | null>(null)

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
    }
  }, [fields, endian])

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
    setSelectedIdx(null)
  }

  async function handleSave(): Promise<void> {
    const content = toCsv()
    const r = await window.labtool.saveConfig(content)
    if (r.canceled) return
    if (!r.ok) onError(r.error ?? '保存失败')
  }

  function handleInsertBelow(): void {
    if (selectedIdx === null) return
    insertRow(selectedIdx + 1, 'Data')
    // 选中新插入的行
    setSelectedIdx(selectedIdx + 1)
  }

  function handleDeleteSelected(): void {
    if (selectedIdx === null) return
    deleteRow(selectedIdx)
    // 选中索引由 effect 调整
  }

  function handleRowClick(idx: number): void {
    setSelectedIdx((cur) => (cur === idx ? null : idx))
  }

  return (
    <div className="frame-editor">
      <div className="fe-toolbar">
        <button className="fe-btn" disabled={confirmed} onClick={() => { insertRow(0, 'Frame_Header'); setSelectedIdx(0) }}>
          {t('frame.insertHeader')}
        </button>
        <button className="fe-btn" disabled={confirmed} onClick={() => { insertRow(0, 'Time_Stamp'); setSelectedIdx(0) }}>
          {t('frame.insertTimestamp')}
        </button>
        <button className="fe-btn" disabled={confirmed} onClick={() => addRow('Check_Sum')}>
          {t('frame.appendChecksum')}
        </button>
        <button className="fe-btn" disabled={confirmed} onClick={() => addRow()}>
          {t('frame.addData')}
        </button>
        <span className="fe-divider" />
        {/* 基于选中行的操作 */}
        <button
          className="fe-btn"
          disabled={confirmed || selectedIdx === null}
          onClick={handleInsertBelow}
          title={t('frame.insertBelowHint')}
        >
          ↓ {t('frame.insertBelow')}
        </button>
        <button
          className="fe-btn danger"
          disabled={confirmed || selectedIdx === null}
          onClick={handleDeleteSelected}
          title={t('frame.deleteSelectedHint')}
        >
          × {t('frame.deleteSelected')}
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
        {selectedIdx !== null && (
          <span className="fe-selection-info">
            {t('frame.selectedIdx', { idx: selectedIdx + 1, total: fields.length })}
          </span>
        )}
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
              {!confirmed && <th style={{ width: 36 }}>{t('frame.del')}</th>}
            </tr>
          </thead>
          <tbody>
            {fields.map((f, idx) => {
              const isSpecialRow = f.role !== 'Data'
              const isSelected = selectedIdx === idx
              return (
                <tr
                  key={f.id}
                  className={
                    (isSpecialRow ? 'fe-row-special' : '') +
                    (isSelected ? ' fe-row-selected' : '')
                  }
                  onClick={() => handleRowClick(idx)}
                >
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
                  {!confirmed && (
                    <td className="fe-cell-del">
                      <button
                        className="fe-btn-icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteRow(idx)
                        }}
                        title={t('frame.del')}
                      >×</button>
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
