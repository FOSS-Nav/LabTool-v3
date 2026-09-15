/**
 * LabTool-V3 数据表格显示
 * 对应 V2 refreshTableTask + ui->tableWidget 第三列
 *
 * 每行 Data 字段后增加 3 个绘图选项（Plot1/2/3），每 slot 最多 3 条线
 */

import { useState } from 'react'
import { useStore } from '../../store'
import { useT } from '../../i18n'
import './DataDisplay.css'

const MAX_PER_SLOT = 3

export function DataDisplay(): JSX.Element {
  const t = useT()
  const fields = useStore((s) => s.fields)
  const tableValues = useStore((s) => s.tableValues)
  const frameCounter = useStore((s) => s.frameCounter)
  const setPlotFlag = useStore((s) => s.setPlotFlag)
  const getSlotCount = useStore((s) => s.getSlotCount)
  const [error, setError] = useState<string | null>(null)

  // 读取最新计数（响应式）
  const c1 = useStore((s) => s.getSlotCount(1))
  const c2 = useStore((s) => s.getSlotCount(2))
  const c3 = useStore((s) => s.getSlotCount(3))
  void getSlotCount // 显式引用以避免 lint

  const slotCount = (slot: 1 | 2 | 3): number => {
    if (slot === 1) return c1
    if (slot === 2) return c2
    return c3
  }

  function tryToggle(fieldId: string, slot: 1 | 2 | 3, currentChecked: boolean) {
    if (currentChecked) {
      setPlotFlag(fieldId, slot, false)
      setError(null)
      return
    }
    // 勾选方向：检查容量
    if (slotCount(slot) >= MAX_PER_SLOT) {
      setError(
        t('display.slotFull', {
          slot,
          max: MAX_PER_SLOT
        })
      )
      // 3 秒后自动清除
      setTimeout(() => setError(null), 3000)
      return
    }
    setPlotFlag(fieldId, slot, true)
    setError(null)
  }

  return (
    <div className="data-display">
      <div className="dd-header">
        <span className="dd-title">{t('display.title')}</span>
        <span className="dd-counter">{t('display.frameCount')}：{frameCounter}</span>
      </div>
      {error && <div className="dd-error">⚠ {error}</div>}
      <div className="dd-table-wrap">
        <table className="dd-table">
          <thead>
            <tr>
              <th style={{ width: 130 }}>{t('frame.name')}</th>
              <th style={{ width: 80 }}>{t('display.type')}</th>
              <th>{t('display.value')}</th>
              <th style={{ width: 220 }} className="dd-plot-col">
                {t('display.plotAssignment')}
                <span className="dd-plot-counter">
                  {c1}/{MAX_PER_SLOT} · {c2}/{MAX_PER_SLOT} · {c3}/{MAX_PER_SLOT}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => {
              const v = tableValues[f.name]
              const display = v === undefined ? '—' :
                typeof v === 'number' ? formatNumber(v) : String(v)
              const isData = f.role === 'Data'
              return (
                <tr key={f.id}>
                  <td className="dd-name">{f.name}</td>
                  <td className="dd-type">{t('frame.role.' + f.role.toLowerCase())}</td>
                  <td className="dd-value">{display}</td>
                  <td className="dd-plot-cell">
                    {isData ? (
                      <div className="dd-plot-options">
                        {[1, 2, 3].map((slot) => {
                          const checked = slot === 1 ? f.isPlot1 : slot === 2 ? f.isPlot2 : f.isPlot3
                          const full = slotCount(slot as 1 | 2 | 3) >= MAX_PER_SLOT && !checked
                          return (
                            <label
                              key={slot}
                              className={'dd-plot-chip' + (checked ? ' on' : '') + (full ? ' full' : '')}
                              title={t('display.plotChip', { slot, field: f.name })}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => tryToggle(f.id, slot as 1 | 2 | 3, checked)}
                              />
                              <span className="dd-plot-chip-label">P{slot}</span>
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="dd-plot-na">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-3 && v !== 0)) return v.toExponential(4)
  if (Number.isInteger(v)) return v.toString()
  return v.toFixed(6).replace(/\.?0+$/, '')
}
