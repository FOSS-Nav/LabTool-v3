/**
 * LabTool-V3 GNSS 实时数据表
 * 对应 V2 GNSSDataDisplayUpdate：8 个 LCD 数字
 * 用一个紧凑的两列表格替代，缺失/未收到显示 "X"。
 *
 * 显示策略：
 *   - 速度：Ve/Vn/Vu + 航向（heading/trueHeading）—— 由 lastVel 提供
 *   - 位置：Lat / Lng / Alt —— 由 lastPos 提供
 *   - DOP：HDOP（两种位置报文都有）；VDOP 仅 BESTPOS
 *   - 其它：卫星数 / 定位质量（GPGGA）；状态 / 时间戳（BESTPOS）
 */

import { useStore } from '../../store'
import { useT } from '../../i18n'
import './GnssDataTable.css'

/* ============================================================
 * 单元格渲染辅助
 * ============================================================ */
function fmt(n: number | undefined, fixed: number, unit = ''): string {
  if (n === undefined || !Number.isFinite(n)) return 'X'
  // 速度非常接近 0 时显示 "0"，否则按精度
  const s = Math.abs(n) < 1e-9 ? '0' : n.toFixed(fixed)
  return unit ? `${s} ${unit}` : s
}

function fmtRaw(s: string | undefined): string {
  if (!s) return 'X'
  return s
}

function fmtInt(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return 'X'
  return String(Math.trunc(n))
}

/* ============================================================
 * 行定义
 * ============================================================ */
interface Row {
  key: string
  label: string
  render: () => string
}

export function GnssDataTable(): JSX.Element {
  const t = useT()
  const vec = useStore((s) => s.lastGnss)
  const pos = useStore((s) => s.lastGnssPos)
  const vel = useStore((s) => s.lastGnssVel)

  /* 速度行：优先用 lastVel（GPVTG/BESTVEL），回退到 vec */
  const speedRows: Row[] = [
    {
      key: 've',
      label: t('gnss.tbl.ve'),
      render: () => fmt(vec?.ve, 4, t('gnss.unit.mps'))
    },
    {
      key: 'vn',
      label: t('gnss.tbl.vn'),
      render: () => fmt(vec?.vn, 4, t('gnss.unit.mps'))
    },
    {
      key: 'vu',
      label: t('gnss.tbl.vu'),
      render: () => fmt(vec?.vu, 4, t('gnss.unit.mps'))
    },
    {
      key: 'heading',
      label: t('gnss.tbl.heading'),
      render: () => {
        if (vel?.kind === 'GPVTG') return fmt(vel.trueHeading, 2, '°')
        if (vel?.kind === 'BESTVEL') return fmt(vel.heading, 2, '°')
        return 'X'
      }
    },
    {
      key: 'speed',
      label: t('gnss.tbl.speed'),
      render: () => {
        if (vel?.kind === 'GPVTG') return fmt(vel.speedKmh, 2, 'km/h')
        if (vel?.kind === 'BESTVEL') return fmt(vel.velocityH, 2, t('gnss.unit.mps'))
        return 'X'
      }
    }
  ]

  /* 位置行：lat / lng / alt */
  const posRows: Row[] = [
    {
      key: 'lat',
      label: t('gnss.tbl.lat'),
      render: () => fmt(pos?.latitude, 8, '°')
    },
    {
      key: 'lng',
      label: t('gnss.tbl.lng'),
      render: () => fmt(pos?.longitude, 8, '°')
    },
    {
      key: 'alt',
      label: t('gnss.tbl.alt'),
      render: () => fmt(pos?.altitude, 2, 'm')
    },
    {
      key: 'time',
      label: t('gnss.tbl.utcTime'),
      render: () => {
        if (pos?.kind === 'GPGGA') return fmtRaw(pos.utcTime)
        if (pos?.kind === 'BESTPOS') return fmtRaw(pos.timestamp)
        return 'X'
      }
    }
  ]

  /* DOP 行 */
  const dopRows: Row[] = [
    {
      key: 'hdop',
      label: t('gnss.tbl.hdop'),
      render: () => fmt(pos?.hdop, 2)
    },
    {
      key: 'vdop',
      label: t('gnss.tbl.vdop'),
      render: () => (pos?.kind === 'BESTPOS' ? fmt(pos.vdop, 2) : 'X')
    },
    {
      key: 'sat',
      label: t('gnss.tbl.satellites'),
      render: () => (pos?.kind === 'GPGGA' ? fmtInt(pos.numSatellites) : 'X')
    },
    {
      key: 'fix',
      label: t('gnss.tbl.fixQuality'),
      render: () => (pos?.kind === 'GPGGA' ? fmtInt(pos.fixQuality) : 'X')
    },
    {
      key: 'status',
      label: t('gnss.tbl.status'),
      render: () => (pos?.kind === 'BESTPOS' ? fmtInt(pos.status) : 'X')
    }
  ]

  return (
    <div className="gnss-data-table">
      <div className="gdt-header">
        <span className="gdt-title">{t('gnss.tbl.title')}</span>
        <span className="gdt-tags">
          {pos && (
            <span className={'gdt-tag ' + (pos.kind === 'BESTPOS' ? 'nov' : 'nmea')}>
              POS: {pos.kind}
            </span>
          )}
          {vel && (
            <span className={'gdt-tag ' + (vel.kind === 'BESTVEL' ? 'nov' : 'nmea')}>
              VEL: {vel.kind}
            </span>
          )}
        </span>
      </div>
      <div className="gdt-body">
        <Section title={t('gnss.tbl.section.speed')} rows={speedRows} />
        <Section title={t('gnss.tbl.section.position')} rows={posRows} />
        <Section title={t('gnss.tbl.section.dop')} rows={dopRows} />
      </div>
    </div>
  )
}

/* ============================================================
 * 小节：一个分组 + N 行
 * ============================================================ */
function Section({ title, rows }: { title: string; rows: Row[] }): JSX.Element {
  return (
    <div className="gdt-section">
      <div className="gdt-section-title">{title}</div>
      <table className="gdt-tbl">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="gdt-k">{r.label}</td>
              <td className="gdt-v">{r.render()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
