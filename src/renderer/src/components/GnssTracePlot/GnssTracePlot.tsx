/**
 * LabTool-V3 GNSS 轨迹图
 * 对应 V2 ui->plot_trace（QCustomPlot + 单 graph）
 *
 * 视图规则：
 *   - 原点 = 第 1 个轨迹点（即 trace[0]，由 updateTrace 在 shared/gnss/trace.ts 中锁定）
 *   - 视角始终跟随最新点：最新点固定显示在画布中央
 *   - 其余轨迹以"相对最新点的偏移"绘制；原点位于画布外侧表示已经走过的距离
 *
 * 缩放：
 *   - 默认 auto：自适应把整段轨迹（含起点）放进画布
 *   - 手动模式：滚轮 / 按钮 / 滑块均可调节 ppm（像素 / 米），并把状态锁住
 *   - "自动" 按钮回到 auto 模式
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useT } from '../../i18n'
import './GnssTracePlot.css'

/* ============================================================
 * 缩放参数（对数刻度，便于在大量级之间切换）
 *   ppm = pixels per meter
 *   1 / ppm = meters per pixel
 * ============================================================ */
const MIN_PPM = 0.02   // 50 m / px —— 看大范围
const MAX_PPM = 500    // 2 mm / px —— 看细节
const DEFAULT_PPM = 1  // 1 m / px
const SLIDER_STEPS = 1000
const ZOOM_STEP = 1.25 // 每次 +/- 25% 缩放
const WHEEL_STEP = 1.1 // 滚轮每档 10%

function clampPpm(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_PPM
  return Math.max(MIN_PPM, Math.min(MAX_PPM, v))
}

/** 把 ppm 映射到滑块 0..SLIDER_STEPS（对数） */
export function ppmToSlider(ppm: number): number {
  const minLog = Math.log(MIN_PPM)
  const maxLog = Math.log(MAX_PPM)
  const v = clampPpm(ppm)
  const log = Math.log(v)
  return Math.round(((log - minLog) / (maxLog - minLog)) * SLIDER_STEPS)
}

/** 把滑块 0..SLIDER_STEPS 反向映射回 ppm */
export function sliderToPpm(s: number): number {
  const t = Math.max(0, Math.min(SLIDER_STEPS, s)) / SLIDER_STEPS
  const minLog = Math.log(MIN_PPM)
  const maxLog = Math.log(MAX_PPM)
  return Math.exp(minLog + (maxLog - minLog) * t)
}

/** 自动适配 ppm：保证（相对最新点的）整段轨迹放进画布 */
function computeAutoPpm(
  trace: { east: number; north: number }[],
  w: number,
  h: number
): number {
  if (trace.length === 0 || w <= 0 || h <= 0) return DEFAULT_PPM
  const last = trace[trace.length - 1]
  let eMin = Infinity, eMax = -Infinity, nMin = Infinity, nMax = -Infinity
  for (const p of trace) {
    const e = p.east - last.east
    const n = p.north - last.north
    if (e < eMin) eMin = e
    if (e > eMax) eMax = e
    if (n < nMin) nMin = n
    if (n > nMax) nMax = n
  }
  // 留 10% 边距
  const padX = (eMax - eMin) * 0.1 || 1
  const padY = (nMax - nMin) * 0.1 || 1
  const rangeE = eMax - eMin + 2 * padX
  const rangeN = nMax - nMin + 2 * padY
  const ppmE = w / rangeE
  const ppmN = h / rangeN
  return clampPpm(Math.min(ppmE, ppmN))
}

/** 格式化 ppm 为人读：大于 1 显示 "X px/m"，小于 1 显示 "Y m/px" */
function formatPpm(ppm: number): string {
  if (ppm >= 1) {
    return `${ppm.toFixed(ppm >= 10 ? 0 : 1)} px/m`
  }
  const mPerPx = 1 / ppm
  if (mPerPx >= 1000) return `${(mPerPx / 1000).toFixed(2)} km/px`
  if (mPerPx >= 1) return `${mPerPx.toFixed(2)} m/px`
  return `${(mPerPx * 100).toFixed(1)} cm/px`
}

/* ============================================================
 * 主组件
 * ============================================================ */

export function GnssTracePlot(): JSX.Element {
  const t = useT()
  const trace = useStore((s) => s.gnssTrace)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  /** 'auto' = 自动适配整段轨迹；'manual' = 使用 manualPpm */
  const [zoomMode, setZoomMode] = useState<'auto' | 'manual'>('auto')
  const [manualPpm, setManualPpm] = useState<number>(DEFAULT_PPM)

  /* ---------------- 容器尺寸（用于 ResizeObserver + 自适应） ---------------- */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = (): void => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.max(0, Math.floor(r.width)), h: Math.max(0, Math.floor(r.height)) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ---------------- 缩放按钮逻辑 ---------------- */
  function applyManualFactor(factor: number): void {
    const base = zoomMode === 'auto' ? computeAutoPpm(trace, size.w, size.h) : manualPpm
    setManualPpm(clampPpm(base * factor))
    setZoomMode('manual')
  }
  function zoomIn(): void { applyManualFactor(ZOOM_STEP) }
  function zoomOut(): void { applyManualFactor(1 / ZOOM_STEP) }
  function resetZoom(): void { setZoomMode('auto') }
  function onSliderChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setManualPpm(sliderToPpm(Number(e.target.value)))
    setZoomMode('manual')
  }

  /* ---------------- 滚轮缩放 ---------------- */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (ev: WheelEvent): void => {
      // 仅在画布区域内滚动时才拦截
      ev.preventDefault()
      const factor = ev.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP
      applyManualFactor(factor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomMode, manualPpm, trace, size])

  /* ---------------- 当前生效的 ppm ---------------- */
  const effectivePpm = useMemo<number>(
    () => (zoomMode === 'auto' ? computeAutoPpm(trace, size.w, size.h) : manualPpm),
    [zoomMode, manualPpm, trace, size]
  )

  /* ---------------- 绘制 ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = size
    if (w <= 0 || h <= 0) return

    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
    }
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

    /* 空状态 */
    if (trace.length === 0) {
      ctx.fillStyle = hintColor
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t('trace.empty'), w / 2, h / 2)
      drawCornerInfo(ctx, w, h, hintColor, t, { ppm: effectivePpm, mode: zoomMode, n: 0 })
      return
    }

    const last = trace[trace.length - 1]
    const ppm = effectivePpm
    // 把"最新点"放在画布中心
    const cx = w / 2
    const cy = h / 2
    const toX = (e: number): number => cx + (e - last.east) * ppm
    const toY = (n: number): number => cy - (n - last.north) * ppm

    /* 选一个"整齐"的网格步长（米）：1, 2, 5, 10, 20, 50, ... */
    const targetPx = 80
    const metersPerStepRaw = targetPx / ppm
    const exp10 = Math.pow(10, Math.floor(Math.log10(metersPerStepRaw)))
    const m = metersPerStepRaw / exp10
    const stepMeters = (m < 2 ? 1 : m < 5 ? 2 : 5) * exp10

    /* 网格：以"最新点为中心 + 整段 step"的网格 */
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    ctx.beginPath()
    // 起点偏移：网格线应当经过原点（first point）
    // 我们用最新点画网格，再叠一个特殊轴在原点
    const xStart = Math.floor((-cx) / (stepMeters * ppm)) * stepMeters + last.east
    for (let e = xStart; ; e += stepMeters) {
      const x = toX(e)
      if (x > w + stepMeters * ppm) break
      ctx.moveTo(x, 0); ctx.lineTo(x, h)
    }
    const yStart = Math.floor((-cy) / (stepMeters * ppm)) * stepMeters + last.north
    for (let n = yStart; ; n += stepMeters) {
      const y = toY(n)
      if (y < -stepMeters * ppm) break
      ctx.moveTo(0, y); ctx.lineTo(w, y)
    }
    ctx.stroke()

    /* 标注网格步长（左下角） */
    ctx.fillStyle = hintColor
    ctx.font = '10px Consolas, monospace'
    ctx.textAlign = 'left'
    const stepLabel =
      stepMeters >= 1000
        ? `${(stepMeters / 1000).toFixed(stepMeters % 1000 === 0 ? 0 : 1)} km`
        : `${stepMeters.toFixed(0)} m`
    ctx.fillText(`grid: ${stepLabel}`, 6, h - 6)

    /* 在轨迹起点（first point = (0,0)）画十字轴 + "起始" */
    const ox = toX(0)
    const oy = toY(0)
    ctx.save()
    ctx.strokeStyle = hintColor
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(ox, 0); ctx.lineTo(ox, h)
    ctx.moveTo(0, oy); ctx.lineTo(w, oy)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // 起点圆点（绿色，区别于历史点）—— 只有 ≥ 2 个点时才画，避免和"当前"重合
    if (trace.length >= 2 && ox >= 0 && ox <= w && oy >= 0 && oy <= h) {
      ctx.fillStyle = success
      ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.fillStyle = hintColor
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(t('trace.origin'), ox + 7, oy - 6)
    }

    /* 历史轨迹点 + 连线（不含最新点） */
    if (trace.length > 1) {
      // 连线
      ctx.strokeStyle = accent + '99'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let i = 0; i < trace.length - 1; i++) {
        const p = trace[i]
        const x = toX(p.east)
        const y = toY(p.north)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      // 历史点（小圆）
      ctx.fillStyle = success
      for (let i = 0; i < trace.length - 1; i++) {
        const p = trace[i]
        ctx.beginPath()
        ctx.arc(toX(p.east), toY(p.north), 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    /* 当前点：固定在 (cx, cy) */
    ctx.fillStyle = danger
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // 当前点光环
    ctx.strokeStyle = danger + '55'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke()

    /* 当前点标签 */
    ctx.fillStyle = hintColor
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(t('trace.now'), cx, cy + 22)

    /* 信息条 */
    drawCornerInfo(ctx, w, h, hintColor, t, {
      ppm: effectivePpm,
      mode: zoomMode,
      n: trace.length,
      lastEast: last.east,
      lastNorth: last.north
    })
  }, [trace, t, size, effectivePpm, zoomMode])

  /* ---------------- 渲染 ---------------- */
  const sliderValue = zoomMode === 'auto'
    ? ppmToSlider(computeAutoPpm(trace, size.w, size.h))
    : ppmToSlider(manualPpm)

  return (
    <div className="gnss-trace-plot">
      <div className="gtp-header">
        <span className="gtp-title">{t('trace.title')}</span>
        <span className="gtp-subtitle">{t('trace.followLatest')}</span>
      </div>

      <div className="gtp-canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="gtp-canvas" />

        {/* 右上角：缩放面板 */}
        <div className="gtp-zoom-panel" role="group" aria-label={t('trace.zoom')}>
          <button
            type="button"
            className={'gtp-zbtn' + (zoomMode === 'auto' ? ' active' : '')}
            title={t('trace.zoomAuto')}
            onClick={resetZoom}
          >
            ⊡
          </button>
          <div className="gtp-zrow">
            <button
              type="button"
              className="gtp-zbtn"
              title={t('trace.zoomIn')}
              onClick={zoomIn}
            >
              ＋
            </button>
            <input
              className="gtp-zslider"
              type="range"
              min={0}
              max={SLIDER_STEPS}
              step={1}
              value={sliderValue}
              onChange={onSliderChange}
              title={t('trace.zoomSlider')}
            />
            <button
              type="button"
              className="gtp-zbtn"
              title={t('trace.zoomOut')}
              onClick={zoomOut}
            >
              －
            </button>
          </div>
          <span className="gtp-zscale" title={t('trace.zoomScale')}>
            {formatPpm(effectivePpm)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * 工具：在画布上画信息条
 * ============================================================ */
function drawCornerInfo(
  ctx: CanvasRenderingContext2D,
  w: number,
  _h: number,
  hint: string,
  t: (k: string) => string,
  info: {
    ppm: number
    mode: 'auto' | 'manual'
    n: number
    lastEast?: number
    lastNorth?: number
  }
): void {
  ctx.fillStyle = hint
  ctx.font = '11px Consolas, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(
    `${t('trace.points')} ${info.n}   ${info.mode === 'auto' ? t('trace.zoomAutoShort') : t('trace.zoomManualShort')}`,
    w - 6,
    14
  )
  if (info.lastEast !== undefined && info.lastNorth !== undefined) {
    ctx.fillText(
      `E ${info.lastEast >= 0 ? '+' : ''}${info.lastEast.toFixed(2)}   N ${info.lastNorth >= 0 ? '+' : ''}${info.lastNorth.toFixed(2)}`,
      w - 6,
      28
    )
  }
}
