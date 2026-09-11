/**
 * LabTool-V3 主线程调度器
 *
 * 对应 V2 MainWindow::slot_taskScheduler + runTimer (10ms)：
 *   - 周期性把 SerialManager 解析出来的帧 / GNSS 推送给 renderer
 *   - 维护"最近一次 GNSS"用于 IMU/GNSS 时间对齐落盘
 *
 * V2 用 Qt 的 QTimer；这里用 Node 的 setInterval（精度足够 10ms 场景）。
 */

import { BrowserWindow } from 'electron'
import { GnssVec8, ParsedFrame } from '../../shared'
import { Recorder } from '../recorder/recorder'
import { SerialManager } from '../serial/manager'
import { DataEvent, LogEvent } from '../ipc/channels'

export interface SchedulerDeps {
  manager: SerialManager
  recorder: Recorder
  /** 推送目标窗口（dev 模式下仅有一个 main window） */
  getWindow(): BrowserWindow | null
}

export class TaskScheduler {
  private timer?: NodeJS.Timeout
  private counter = 0
  private readonly periodMs: number
  private readonly deps: SchedulerDeps

  constructor(deps: SchedulerDeps, periodMs = 10) {
    this.deps = deps
    this.periodMs = periodMs
  }

  start(): void {
    if (this.timer) return
    this.counter = 0
    this.timer = setInterval(() => this.tick(), this.periodMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  /** 主 tick —— 由 setInterval 触发 */
  private tick(): void {
    this.counter += 1
    // V2：每 1 秒更新一次状态栏时间
    if (this.counter % 100 === 0) {
      // 不在此处推送时间字符串：渲染端可本地维护计时
    }
  }

  /** 由 SerialManager 的 'imu:frames' 事件回调调用 */
  pushImuFrames(frames: ParsedFrame[]): void {
    if (frames.length === 0) return
    // 落盘
    this.deps.recorder.writeImuBatch(frames)
    // 推送给渲染端
    const win = this.deps.getWindow()
    win?.webContents.send(DataEvent.FrameParsed, {
      frames,
      lastGnss: this.lastGnssForRenderer
    })
  }

  /** 由 SerialManager 的 'gnss:merged' 事件回调调用 */
  pushGnssMerged(vec: GnssVec8, raw: string[]): void {
    this.deps.recorder.markGnssUpdated(vec)
    this.lastGnssForRenderer = vec
    const win = this.deps.getWindow()
    win?.webContents.send(DataEvent.GnssParsed, { vec, raw: raw[raw.length - 1] ?? '' })
  }

  private lastGnssForRenderer: GnssVec8 | null = null
}
