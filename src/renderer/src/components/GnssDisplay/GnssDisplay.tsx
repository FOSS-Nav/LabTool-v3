/**
 * LabTool-V3 GNSS 数据显示
 * 对应 V2 GNSSDataDisplayUpdate：8 个 LCD 数字
 */

import { useStore } from '../../store'
import { useT } from '../../i18n'
import './GnssDisplay.css'

interface LcdProps {
  label: string
  value: string
  unit?: string
}

function Lcd({ label, value, unit }: LcdProps): JSX.Element {
  return (
    <div className="gd-lcd">
      <span className="gd-lcd-label">{label}</span>
      <span className="gd-lcd-value">{value}</span>
      {unit && <span className="gd-lcd-unit">{unit}</span>}
    </div>
  )
}

export function GnssDisplay(): JSX.Element {
  const t = useT()
  const g = useStore((s) => s.lastGnss)
  const trace = useStore((s) => s.gnssTrace)

  const fmt = (n: number | undefined, fixed = 6): string => {
    if (n === undefined || !Number.isFinite(n)) return '——'
    return n.toFixed(fixed)
  }

  return (
    <div className="gnss-display">
      <div className="gd-header">
        <span className="gd-title">{t('gnss.title')}</span>
        <span className="gd-count">{t('gnss.traceCount')}：{trace.length}</span>
      </div>
      <div className="gd-lcd-grid">
        <Lcd label={t('gnss.ve')} value={fmt(g?.ve, 4)} unit={t('gnss.unit.mps')} />
        <Lcd label={t('gnss.vn')} value={fmt(g?.vn, 4)} unit={t('gnss.unit.mps')} />
        <Lcd label={t('gnss.vu')} value={fmt(g?.vu, 4)} unit={t('gnss.unit.mps')} />
        <Lcd label={t('gnss.utcTime')} value={g?.time ? g.time.toFixed(2) : '——'} unit={t('gnss.unit.s')} />
        <Lcd label={t('gnss.lat')} value={fmt(g?.lat, 10)} unit={t('gnss.unit.deg')} />
        <Lcd label={t('gnss.lng')} value={fmt(g?.lng, 10)} unit={t('gnss.unit.deg')} />
        <Lcd label={t('gnss.alt')} value={fmt(g?.alt, 3)} unit={t('gnss.unit.m')} />
        <Lcd label={t('gnss.hdop')} value={fmt(g?.hdop, 3)} />
      </div>
    </div>
  )
}
