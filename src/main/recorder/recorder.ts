/**
 * LabTool-V3 数据落盘
 *
 * 对应 V2 mainwindow.cpp 中：
 *   - txtFile (解析后文本)
 *   - txtFileHex (原始 .bin)
 *   - 头部 %列名 + 每帧一行
 *   - 若 GNSS 串口打开且本帧 GNSS 更新过，把 GNSS 8 维追加到行尾；
 *     否则追加 "0.0 0.0 ..." 占位。
 *
 * 设计：写文件是异步的，但每次 append 调用立即把数据 push 到 Buffer，
 *       由 setImmediate 在下一拍写盘；保证 UI 节奏不被打断。
 */

import { createWriteStream, mkdirSync, WriteStream } from 'node:fs'
import { dirname } from 'node:path'
import { ParsedField, ParsedFrame, GnssVec8 } from '../../shared'
import { precisionFor, SCALE_NONE } from '../../shared/parser/datatype'

export interface RecorderOptions {
  /** txt 路径（不含扩展名也可，函数自动加 .txt 与 .bin） */
  txtPath: string
  /** bin 路径；默认 txtPath 去掉 .txt 加 .bin */
  binPath?: string
  /** 字段表头（按字段顺序写出 %name） */
  fieldNames: string[]
  /** 是否启用 GNSS 时间对齐（追加 8 维） */
  alignGnss: boolean
}

export interface RecorderState {
  isRecording: boolean
  txtPath?: string
  binPath?: string
  bytesWritten: number
  linesWritten: number
}

export class Recorder {
  private txtStream?: WriteStream
  private binStream?: WriteStream
  private opts?: RecorderOptions
  private bytesWritten = 0
  private linesWritten = 0
  /** 最近一次 GNSS 数据（用于时间对齐：当前 IMU 帧使用上一个更新过的 GNSS） */
  private lastGnss: GnssVec8 | null = null
  /** 本帧是否刚被 GNSS 更新过 */
  private gnssFresh = false

  start(opts: RecorderOptions): void {
    if (this.txtStream) throw new Error('recorder already started')
    const binPath = opts.binPath ?? opts.txtPath.replace(/\.txt$/i, '') + '.bin'
    mkdirSync(dirname(opts.txtPath), { recursive: true })
    mkdirSync(dirname(binPath), { recursive: true })
    this.txtStream = createWriteStream(opts.txtPath, { flags: 'w' })
    this.binStream = createWriteStream(binPath, { flags: 'w' })
    this.opts = opts
    this.bytesWritten = 0
    this.linesWritten = 0

    // V2 风格：首行 %name1 %name2 ...
    const header =
      opts.fieldNames.map((n) => `%${n}`).join(' ') +
      (opts.alignGnss ? ' %ve %vn %vu %lat %lng %alt %time %hdop' : '') +
      '\n'
    this.txtStream.write(header)
    this.linesWritten = 1
  }

  stop(): void {
    if (!this.txtStream) return
    this.txtStream.end()
    this.binStream?.end()
    this.txtStream = undefined
    this.binStream = undefined
    this.opts = undefined
  }

  /** 由 GNSS 串口线程调用，标记"本帧 GNSS 已更新" */
  markGnssUpdated(vec: GnssVec8): void {
    this.lastGnss = vec
    this.gnssFresh = true
  }

  /** 由调度器调用：写入一批 IMU 帧 */
  writeImuBatch(frames: ParsedFrame[]): void {
    if (!this.txtStream || !this.binStream || !this.opts) return
    const lines: string[] = []
    for (const f of frames) {
      // 落盘 .bin：原始字节
      this.binStream.write(f.raw)
      this.bytesWritten += f.raw.length

      // 落盘 .txt：已解析字段
      const parts: string[] = []
      for (const field of f.fields) {
        parts.push(this.formatField(field))
      }
      let line = parts.join(' ')

      if (this.opts.alignGnss) {
        if (this.gnssFresh && this.lastGnss) {
          line += ' ' + this.formatGnss(this.lastGnss)
          this.gnssFresh = false
        } else {
          line += ' 0 0 0 0 0 0 0 0'
        }
      }
      lines.push(line)
    }
    if (lines.length > 0) {
      this.txtStream.write(lines.join('\n') + '\n')
      this.linesWritten += lines.length
    }
  }

  state(): RecorderState {
    return {
      isRecording: !!this.txtStream,
      txtPath: this.opts?.txtPath,
      binPath: this.opts?.binPath ?? (this.opts ? this.opts.txtPath.replace(/\.txt$/i, '') + '.bin' : undefined),
      bytesWritten: this.bytesWritten,
      linesWritten: this.linesWritten
    }
  }

  /* ============================================================
   * 工具
   * ============================================================ */

  private formatField(f: ParsedField): string {
    // V2：scale > 9999 或 scale == 0 → 不乘
    if (f.scale === SCALE_NONE || !Number.isFinite(f.scale) || f.scale === 0) {
      // 直接使用原始 raw 转为字符串：整数直接、浮点用 precision
      if (Number.isInteger(f.raw)) return String(f.raw)
      // 估算精度（按 scale 是否是整数判断不靠谱，这里固定 7）
      return f.raw.toString()
    }
    // 应用 scale 后输出
    const v = f.value
    if (Number.isInteger(v)) return String(v)
    return v.toString()
  }

  private formatGnss(g: GnssVec8): string {
    return [
      g.ve.toString(),
      g.vn.toString(),
      g.vu.toString(),
      g.lat.toString(),
      g.lng.toString(),
      g.alt.toString(),
      g.time.toString(),
      g.hdop.toString()
    ].join(' ')
  }
}
