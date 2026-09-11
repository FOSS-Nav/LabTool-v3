/**
 * LabTool-V3 三联曲线图
 * 对应 V2 mycurveplot.cpp 三个 QCustomPlot 组件
 *
 * 使用 uPlot（10x faster than QCustomPlot）实现三组子图：
 *   - 横轴：帧计数 / 时间戳
 *   - 纵轴：每个子图最多 3 条曲线（由 FrameEditor 中 isPlot1/2/3 决定）
 */

import { useEffect, useMemo, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useStore, selectPlottable } from '../../store'
import { ParsedFrame } from '@shared'
import { useT } from '../../i18n'
import './CurvePlot.css'

interface PlotSlotProps {
  slot: 1 | 2 | 3
  series: { index: number; name: string }[]
  frames: ParsedFrame[]
  xMode: 'count' | 'timestamp'
}

const COLORS = ['#ff5252', '#4a9eff', '#26d4ad']

function PlotSlot({ slot, series, frames, xMode }: PlotSlotProps): JSX.Element {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  /* 构造 uPlot 数据：[xs, ys1, ys2, ys3] */
  const data = useMemo<uPlot.AlignedData>(() => {
    const xs: number[] = []
    const ys: number[][] = [series[0] ? [] : [], series[1] ? [] : [], series[2] ? [] : []]
    for (const f of frames) {
      const x = xMode === 'timestamp' && f.timestamp !== undefined ? f.timestamp : f.frameIndex
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
  }, [frames, series, xMode])

  /* 创建 / 更新 plot */
  useEffect(() => {
    if (!ref.current) return
    if (plotRef.current) {
      plotRef.current.setData(data)
      return
    }
    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height: ref.current.clientHeight,
      pxAlign: false,
      cursor: { drag: { x: true, y: false } },
      scales: {
        x: { time: false }
      },
      axes: [
        {
          stroke: '#9ba1ad',
          grid: { stroke: '#2a3140', width: 1 },
          ticks: { stroke: '#3a4150' }
        },
        {
          stroke: '#9ba1ad',
          grid: { stroke: '#2a3140', width: 1 },
          ticks: { stroke: '#3a4150' }
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
          height: ref.current.clientHeight
        })
      }
    })
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      plotRef.current?.destroy()
      plotRef.current = null
    }
  }, [data, series, xMode, t])

  if (series.length === 0) {
    return <div className="cp-empty">{t('curve.empty')}</div>
  }
  return <div ref={ref} className="cp-canvas" />
}

interface Props {
  xMode: 'count' | 'timestamp'
}

export function CurvePlot({ xMode }: Props): JSX.Element {
  const fields = useStore((s) => s.fields)
  const recentFrames = useStore((s) => s.recentFrames)
  const plottable = useStore(selectPlottable)

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

  return (
    <div className="curve-plot">
      <PlotSlot slot={1} series={seriesByPlot[1]} frames={recentFrames} xMode={xMode} />
      <PlotSlot slot={2} series={seriesByPlot[2]} frames={recentFrames} xMode={xMode} />
      <PlotSlot slot={3} series={seriesByPlot[3]} frames={recentFrames} xMode={xMode} />
    </div>
  )
}
