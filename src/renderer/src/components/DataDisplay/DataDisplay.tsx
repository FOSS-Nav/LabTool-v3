/**
 * LabTool-V3 数据表格显示
 * 对应 V2 refreshTableTask + ui->tableWidget 第三列
 * 显示每行字段最新解析值。
 */

import { useStore } from '../../store'
import { useT } from '../../i18n'
import './DataDisplay.css'

export function DataDisplay(): JSX.Element {
  const t = useT()
  const fields = useStore((s) => s.fields)
  const tableValues = useStore((s) => s.tableValues)
  const frameCounter = useStore((s) => s.frameCounter)

  return (
    <div className="data-display">
      <div className="dd-header">
        <span className="dd-title">{t('display.title')}</span>
        <span className="dd-counter">{t('display.frameCount')}：{frameCounter}</span>
      </div>
      <div className="dd-table-wrap">
        <table className="dd-table">
          <thead>
            <tr>
              <th style={{ width: 130 }}>{t('frame.name')}</th>
              <th style={{ width: 80 }}>{t('display.type')}</th>
              <th>{t('display.value')}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => {
              const v = tableValues[f.name]
              const display = v === undefined ? '—' :
                typeof v === 'number' ? formatNumber(v) : String(v)
              return (
                <tr key={f.id}>
                  <td className="dd-name">{f.name}</td>
                  <td className="dd-type">{t('frame.role.' + f.role.toLowerCase())}</td>
                  <td className="dd-value">{display}</td>
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
