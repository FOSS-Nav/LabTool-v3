/**
 * LabTool-V3 三联曲线图
 *
 * 布局：
 *   ┌─ 工具条（固定高度）────────────────────────────────┐
 *   ├─ 图1 ──────────────────────────────────────────────┤
 *   ├─ 图2 ──────────────────────────────────────────────┤
 *   └─ 图3 ──────────────────────────────────────────────┘
 *
 * - 3 个子图高度自适应容器（flex: 1）
 * - Y 轴固定 size 80 防止长数字显示不全
 * - 横轴可选：帧计数 / 时间戳
 *   - 当帧格式中无 Time_Stamp 字段时，时间轴选项被禁用
 * - 字段→图位分配在 DataDisplay 面板中配置（每 slot 最多 3 条线）
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useStore, selectPlottable } from '../../store'
import { ParsedFrame } from '@shared'
import { useT } from '../../i18n'
import './CurvePlot.css'

const COLORS = ['#ff5252', '#4a9eff', '#26d4ad']

/** Y 轴刻度格式化：避免过多数字位数 */
function formatYTick(v: number): string {
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-3 && v !== 0)) return v.toExponential(2)
  if (Number.isInteger(v)) return v.toString()
  return v.toFixed(4).replace(/\.?0+$/, '')
}

/* ============================================================
 * 1. 单个绘图槽
 * ============================================================ */

interface PlotSlotProps {
  slot: 1 | 2 | 3
  series: { index: number; name: string }[]
  frames: ParsedFrame[]
  xMode: 'count' | 'timestamp'
  hasTimestamp: boolean
  height: number
}

function PlotSlot({ slot, series, frames, xMode, hasTimestamp, height }: PlotSlotProps): JSX.Element {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  const data = useMemo<uPlot.AlignedData>(() => {
    const xs: number[] = []
    const ys: number[][] = [series[0] ? [] : [], series[1] ? [] : [], series[2] ? [] : []]
    for (const f of frames) {
      const x = xMode === 'timestamp' && hasTimestamp && f.timestamp !== undefined
        ? f.timestamp
        : f.frameIndex
      xs.push(x)
      for (let i = 0; i < 3; i++) {
        if (!series[i]) {
          ys[i].push(NaN)
          continue
        }
        const field = f.fields[series[i].index]
        ys[i].push(field ? field.value : NaN)
      }
    }
    return [xs, ...ys] as unknown as uPlot.AlignedData
  }, [frames, series, xMode, hasTimestamp])

  useEffect(() => {
    if (!ref.current) return
    if (plotRef.current) {
      plotRef.current.setData(data)
      plotRef.current.setSize({ width: ref.current.clientWidth, height: height })
      return
    }
    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height: height,
      pxAlign: false,
      cursor: { drag: { x: true, y: false } },
      scales: { x: { time: false } },
      axes: [
        {
          stroke: '#9ba1ad',
          grid: { stroke: '#2a3140', width: 1 },
          ticks: { stroke: '#3a4150' }
        },
        {
          stroke: '#9ba1ad',
          grid: { stroke: '#2a3140', width: 1 },
          ticks: { stroke: '#3a4150' },
          size: 80,
          gap: 6,
          values: (_u: uPlot, splits: number[]) => splits.map((v) => formatYTick(v))
        }
      ],
      series: [
        { label: xMode === 'timestamp' ? t('curve.xAxis.time') : t('curve.xAxis.frame') },
        ...series.map((s, i) => ({
          label: s.name,
          stroke: COLORS[i % COLORS.length],
          width: 1.4,
          points: { show: false }
        }))
      ],
      legend: { show: true }
    }
    plotRef.current = new uPlot(opts, data, ref.current)

    const ro = new ResizeObserver(() => {
      if (ref.current && plotRef.current) {
        plotRef.current.setSize({
          width: ref.current.clientWidth,
          height: height
        })
      }
    })
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      plotRef.current?.destroy()
      plotRef.current = null
    }
  }, [data, series, xMode, t, height])

  if (series.length === 0) {
    return (
      <div className="cp-slot">
        <div className="cp-slot-header">
          <span className="cp-slot-label">📈 {t('curve.slot', { slot })}</span>
          <span className="cp-slot-empty">{t('curve.noField')}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="cp-slot">
      <div className="cp-slot-header">
        <span className="cp-slot-label">📈 {t('curve.slot', { slot })}</span>
        <span className="cp-slot-fields">{series.map((s) => s.name).join(' · ')}</span>
      </div>
      <div ref={ref} className="cp-canvas" />
    </div>
  )
}

/* ============================================================
 * 2. 容器
 * ============================================================ */

const SLOT_GAP = 4  // 像素

export function CurvePlot(): JSX.Element {
  const t = useT()
  const fields = useStore((s) => s.fields)
  const recentFrames = useStore((s) => s.recentFrames)
  const plottable = useStore(selectPlottable)
  const stackRef = useRef<HTMLDivElement>(null)
  const [slotHeight, setSlotHeight] = useState(220)

  // 帧格式中是否有 Time_Stamp 字段
  const hasTimestamp = fields.some((f) => f.role === 'Time_Stamp')
  // 用户在 CurvePlot 内部选择横轴
  const [xMode, setXMode] = useState<'count' | 'timestamp'>('count')
  const prevHasTs = useRef(hasTimestamp)
  useEffect(() => {
    if (prevHasTs.current && !hasTimestamp && xMode === 'timestamp') {
      setXMode('count')
    }
    prevHasTs.current = hasTimestamp
  }, [hasTimestamp, xMode])

  // 收集每个 plot 槽的曲线
  const seriesByPlot = useMemo(() => {
    const map: Record<1 | 2 | 3, { index: number; name: string }[]> = { 1: [], 2: [], 3: [] }
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i]
      if (f.role !== 'Data') continue
      const dataIdx = plottable.find((p) => p.tableRow === i)?.dataIndex
      if (dataIdx === undefined) continue
      if (f.isPlot1) map[1].push({ index: dataIdx, name: f.name })
      if (f.isPlot2) map[2].push({ index: dataIdx, name: f.name })
      if (f.isPlot3) map[3].push({ index: dataIdx, name: f.name })
    }
    return map
  }, [fields, plottable])

  /* 容器尺寸变化 → 重新计算每个子图高度
   * ResizeObserver 在窗口缩放时自动触发
   * 高度 = (stack高度 - 2 * gap) / 3
   */
  useEffect(() => {
    if (!stackRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const h = e.contentRect.height
        const per = Math.max(80, (h - 2 * SLOT_GAP) / 3)
        setSlotHeight(per)
      }
    })
    ro.observe(stackRef.current)
    const initial = stackRef.current.clientHeight
    if (initial > 0) {
      setSlotHeight(Math.max(80, (initial - 2 * SLOT_GAP) / 3))
    }
    return () => ro.disconnect()
  }, [])

  return (
    <div className="curve-plot">
      <div className="cp-toolbar">
        <span className="cp-toolbar-label">📈 {t('curve.title')}</span>
        <span className="cp-toolbar-sep" />
        <label className="cp-xmode">
          {t('curve.xAxis')}:
          <select
            value={xMode}
            onChange={(e) => setXMode(e.target.value as 'count' | 'timestamp')}
          >
            <option value="count">{t('curve.xAxis.count')}</option>
            <option value="timestamp" disabled={!hasTimestamp}>
              {t('curve.xAxis.time')}{!hasTimestamp ? ` (${t('curve.xAxis.needTs')})` : ''}
            </option>
          </select>
        </label>
        <span className="cp-toolbar-sep" />
        <span className="cp-toolbar-hint">
          {hasTimestamp
            ? t('curve.timeAvailable')
            : t('curve.timeUnavailable')}
        </span>
      </div>

      <div className="cp-stack" ref={stackRef}>
        <PlotSlot slot={1} series={seriesByPlot[1]} frames={recentFrames} xMode={xMode} hasTimestamp={hasTimestamp} height={slotHeight} />
        <PlotSlot slot={2} series={seriesByPlot[2]} frames={recentFrames} xMode={xMode} hasTimestamp={hasTimestamp} height={slotHeight} />
        <PlotSlot slot={3} series={seriesByPlot[3]} frames={recentFrames} xMode={xMode} hasTimestamp={hasTimestamp} height={slotHeight} />
      </div>
    </div>
  )
}
