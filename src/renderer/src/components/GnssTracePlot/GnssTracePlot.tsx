/**
 * LabTool-V3 GNSS 轨迹图
 * 对应 V2 ui->plot_trace（QCustomPlot + 单 graph）
 *
 * 用 Canvas 2D 直接画散点（O(n) 即可，没必要引 uPlot）。
 * 与 V2 一致：east 在 X 轴、north 在 Y 轴，origin 在第一点。
 */

import { useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { useT } from '../../i18n'
import './GnssTracePlot.css'

export function GnssTracePlot(): JSX.Element {
  const t = useT()
  const trace = useStore((s) => s.gnssTrace)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // 读 CSS 变量以适配主题
    const styles = getComputedStyle(document.documentElement)
    const bgPrimary = styles.getPropertyValue('--bg-primary').trim() || '#0f1117'
    const gridColor = styles.getPropertyValue('--border').trim() || '#1f2530'
    const hintColor = styles.getPropertyValue('--text-secondary').trim() || '#5a6270'
    const accent = styles.getPropertyValue('--accent').trim() || '#4a9eff'
    const success = styles.getPropertyValue('--success').trim() || '#26d4ad'
    const danger = styles.getPropertyValue('--danger').trim() || '#ff5252'

    // 背景
    ctx.fillStyle = bgPrimary
    ctx.fillRect(0, 0, w, h)

    // 坐标网格
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * w
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      const y = (i / 10) * h
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    if (trace.length === 0) {
      ctx.fillStyle = hintColor
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t('trace.empty'), w / 2, h / 2)
      return
    }

    // 计算范围
    let eMin = Infinity, eMax = -Infinity, nMin = Infinity, nMax = -Infinity
    for (const p of trace) {
      if (p.east < eMin) eMin = p.east
      if (p.east > eMax) eMax = p.east
      if (p.north < nMin) nMin = p.north
      if (p.north > nMax) nMax = p.north
    }
    if (eMin === eMax) { eMin -= 1; eMax += 1 }
    if (nMin === nMax) { nMin -= 1; nMax += 1 }
    const padX = (eMax - eMin) * 0.1
    const padY = (nMax - nMin) * 0.1
    eMin -= padX; eMax += padX
    nMin -= padY; nMax += padY
    const sx = w / (eMax - eMin)
    const sy = h / (nMax - nMin)
    const scale = Math.min(sx, sy)

    const cx = w / 2 - ((eMax + eMin) / 2) * scale
    const cy = h / 2 + ((nMax + nMin) / 2) * scale

    // 轨迹线
    ctx.strokeStyle = accent + '88'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < trace.length; i++) {
      const p = trace[i]
      const x = cx + p.east * scale
      const y = cy - p.north * scale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // 当前点
    const last = trace[trace.length - 1]
    const lx = cx + last.east * scale
    const ly = cy - last.north * scale
    ctx.fillStyle = danger
    ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 历史轨迹点
    ctx.fillStyle = success
    for (let i = 0; i < trace.length - 1; i++) {
      const p = trace[i]
      const x = cx + p.east * scale
      const y = cy - p.north * scale
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill()
    }

    // 标注原点
    const ox = cx + 0
    const oy = cy - 0
    ctx.strokeStyle = hintColor
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(ox, 0); ctx.lineTo(ox, h)
    ctx.moveTo(0, oy); ctx.lineTo(w, oy)
    ctx.stroke()
    ctx.setLineDash([])

    // 标签
    ctx.fillStyle = hintColor
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(t('trace.east'), 6, 14)
    ctx.fillText(t('trace.north'), 6, 28)
    ctx.textAlign = 'right'
    ctx.fillText(`${t('trace.points')} ${trace.length}`, w - 6, 14)
  }, [trace, t])

  return (
    <div className="gnss-trace-plot">
      <div className="gtp-header">
        <span className="gtp-title">{t('trace.title')}</span>
      </div>
      <canvas ref={ref} className="gtp-canvas" />
    </div>
  )
}
