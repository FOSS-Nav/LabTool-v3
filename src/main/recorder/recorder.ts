/**
 * LabTool-V3 数据落盘
 *
 * 启动后按基名生成三个文件：
 *   <base>_IMU_HEX.bin   — IMU 串口原始字节（按字节顺序直接写）
 *   <base>_GNSS.txt      — GNSS 串口原始 NMEA/NovAtel 文本（按行追加）
 *   <base>_IMU_GNSS.bin  — 解析后的同步数据：每帧 = [u32 seq][IMU floats][GNSS floats]
 *
 *   - 帧序号：IMU 帧序号（u32 LE）
 *   - IMU floats：与 FrameEditor 解析方案一致，按字段顺序排列（默认 float32 LE）
 *   - GNSS floats：ve vn vu lat lng alt utc_time（7 × float32 LE）
 *
 *   - 若 GNSS 串口未打开：文件改名为 <base>_IMU.bin，仅写 [seq][IMU floats]
 *   - 若 GNSS 串口打开但暂未收到数据：GNSS 列全部写 0
 */

import { createWriteStream, mkdirSync, WriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { ParsedFrame, GnssVec8 } from '../../shared'

export interface RecorderOptions {
  /** 基名（不含扩展名） */
  baseName: string
  /** 保存目录（默认当前工作目录） */
  outDir?: string
  /** 是否启用 GNSS 同步（取决于 GNSS 串口是否打开） */
  enableGnss: boolean
  /** IMU 字段的字节宽度（4 或 8），从 frame.channelBytes 来 */
  imuChannelBytes: 4 | 8
  /** IMU 字段数（不含 Frame_Header / Time_Stamp / Check_Sum） */
  imuFieldCount: number
  /** IMU Data 字段名（用于 .txt 表头），按帧格式顺序 */
  imuFieldNames: string[]
  /** 标记基名是否带 GNSS（用于决定文件名后缀） */
  hasGnss: boolean
}

export interface RecorderState {
  isRecording: boolean
  baseName: string
  outDir: string
  imuHexPath: string
  gnssTxtPath: string | null
  /** 解析后 IMU 的 .bin 文件（带或不带 GNSS 列，文件名由 hasGnss 决定） */
  parsedBinPath: string
  /** 解析后 IMU 的 .txt 文件（人类可读） */
  parsedTxtPath: string
  /** 累计写入字节 / 帧数 */
  imuHexBytes: number
  gnssTxtBytes: number
  parsedBinFrames: number
  parsedTxtBytes: number
}

export class Recorder {
  private imuHexStream?: WriteStream
  private gnssTxtStream?: WriteStream | null
  /** 解析后的 IMU 帧的 .bin 流（带或不带 GNSS 列） */
  private imuBinStream?: WriteStream
  /** 解析后的 IMU 帧的 .txt 流（带或不带 GNSS 列） */
  private imuTxtStream?: WriteStream
  private opts?: RecorderOptions
  private imuHexBytes = 0
  private gnssTxtBytes = 0
  private imuBinFrames = 0
  private imuTxtBytes = 0
  private imuTxtHeaderWritten = false
  private lastGnss: GnssVec8 | null = null

  start(opts: RecorderOptions): void {
    if (this.imuHexStream) throw new Error('recorder already started')

    const outDir = opts.outDir ?? process.cwd()
    mkdirSync(outDir, { recursive: true })

    // 文件路径
    const imuHexPath = join(outDir, `${opts.baseName}_IMU_HEX.bin`)
    const imuBinPath = join(outDir, opts.hasGnss ? `${opts.baseName}_IMU_GNSS.bin` : `${opts.baseName}_IMU.bin`)
    const imuTxtPath = join(outDir, opts.hasGnss ? `${opts.baseName}_IMU_GNSS.txt` : `${opts.baseName}_IMU.txt`)
    const gnssTxtPath = opts.hasGnss ? join(outDir, `${opts.baseName}_GNSS.txt`) : null

    this.imuHexStream = createWriteStream(imuHexPath, { flags: 'w' })
    this.imuBinStream = createWriteStream(imuBinPath, { flags: 'w' })
    this.imuTxtStream = createWriteStream(imuTxtPath, { flags: 'w' })
    this.gnssTxtStream = gnssTxtPath ? createWriteStream(gnssTxtPath, { flags: 'w' }) : null
    this.opts = opts
    this.imuHexBytes = 0
    this.gnssTxtBytes = 0
    this.imuBinFrames = 0
    this.imuTxtBytes = 0
    this.imuTxtHeaderWritten = false
    this.lastGnss = null
  }

  stop(): void {
    this.imuHexStream?.end()
    this.imuBinStream?.end()
    this.imuTxtStream?.end()
    this.gnssTxtStream?.end()
    this.imuHexStream = undefined
    this.imuBinStream = undefined
    this.imuTxtStream = undefined
    this.gnssTxtStream = undefined
    this.opts = undefined
  }

  /** IMU 串口线程：每个字节到来时调用（原样写入 IMU_HEX.bin） */
  writeImuRawBytes(data: Buffer): void {
    if (!this.imuHexStream) return
    this.imuHexStream.write(data)
    this.imuHexBytes += data.length
  }

  /** GNSS 串口线程：每条 NMEA 文本到达时调用 */
  writeGnssText(line: string): void {
    if (!this.gnssTxtStream) return
    const buf = Buffer.from(line + '\r\n')
    this.gnssTxtStream.write(buf)
    this.gnssTxtBytes += buf.length
  }

  /** GNSS 合并向量（用于 IMU_GNSS.bin 同步） */
  updateLastGnss(vec: GnssVec8): void {
    this.lastGnss = vec
  }

  /** IMU 帧解析完成时调用：写入 .bin 和 .txt */
  writeImuFrame(frame: ParsedFrame): void {
    if (!this.imuBinStream || !this.imuTxtStream || !this.opts) return
    // 1) 写 .bin
    const buf = this.encodeParsedFrame(frame)
    this.imuBinStream.write(buf)
    this.imuBinFrames += 1
    // 2) 写 .txt（human-readable，列由 opts.imuFieldNames 和 hasGnss 决定）
    this.writeImuTxtLine(frame)
  }

  state(): RecorderState | null {
    if (!this.opts || !this.imuHexStream || !this.imuBinStream) return null
    const outDir = this.opts.outDir ?? process.cwd()
    const hasGnss = this.opts.hasGnss
    const base = `${this.opts.baseName}`
    return {
      isRecording: true,
      baseName: this.opts.baseName,
      outDir,
      imuHexPath: join(outDir, `${base}_IMU_HEX.bin`),
      gnssTxtPath: hasGnss ? join(outDir, `${base}_GNSS.txt`) : null,
      parsedBinPath: join(outDir, hasGnss ? `${base}_IMU_GNSS.bin` : `${base}_IMU.bin`),
      parsedTxtPath: join(outDir, hasGnss ? `${base}_IMU_GNSS.txt` : `${base}_IMU.txt`),
      imuHexBytes: this.imuHexBytes,
      gnssTxtBytes: this.gnssTxtBytes,
      parsedBinFrames: this.imuBinFrames,
      parsedTxtBytes: this.imuTxtBytes
    }
  }

  /* ============================================================
   * 内部：写 .txt 文件（人类可读）
   *   有 GNSS：seq + IMU 字段 + GNSS 7 维
   *   无 GNSS：seq + IMU 字段
   * ============================================================ */
  private writeImuTxtLine(frame: ParsedFrame): void {
    const opts = this.opts!
    if (!this.imuTxtStream) return
    if (!this.imuTxtHeaderWritten) {
      const cols = ['seq', ...opts.imuFieldNames]
      if (opts.hasGnss) cols.push('ve', 'vn', 'vu', 'lat', 'lng', 'alt', 'utc_time')
      this.imuTxtStream.write(cols.join(' ') + '\n')
      this.imuTxtHeaderWritten = true
    }
    const parts: string[] = [String(frame.frameIndex)]
    for (let i = 0; i < opts.imuFieldCount; i++) {
      const f = frame.fields[i]
      parts.push(this.formatValue(f ? f.value : NaN))
    }
    if (opts.hasGnss) {
      const g = this.lastGnss
      if (g) {
        parts.push(
          this.formatValue(g.ve ?? 0),
          this.formatValue(g.vn ?? 0),
          this.formatValue(g.vu ?? 0),
          this.formatValue(g.lat ?? 0),
          this.formatValue(g.lng ?? 0),
          this.formatValue(g.alt ?? 0),
          this.formatValue(g.time ?? 0)
        )
      } else {
        for (let i = 0; i < 7; i++) parts.push('0')
      }
    }
    const line = parts.join(' ') + '\n'
    this.imuTxtStream.write(line)
    this.imuTxtBytes += Buffer.byteLength(line)
  }

  private formatValue(v: number): string {
    if (!Number.isFinite(v)) return 'NaN'
    if (Number.isInteger(v)) return v.toString()
    return v.toString()
  }

  /* ============================================================
   * 内部：编码 .bin 帧（解析后的 IMU + GNSS）
   *   [u32 seq][IMU fields × float32/float64][GNSS × 7 float32]
   *   有 GNSS 时：seq + IMU + 7 个 GNSS float32
   *   无 GNSS 时：seq + IMU
   * ============================================================ */
  private encodeParsedFrame(frame: ParsedFrame): Buffer {
    const opts = this.opts!
    const chBytes = opts.imuChannelBytes
    const imuFieldCount = opts.imuFieldCount
    const gnssFieldCount = opts.hasGnss ? 7 : 0
    const totalBytes = 4 + imuFieldCount * chBytes + gnssFieldCount * 4
    const buf = Buffer.alloc(totalBytes)
    let off = 0
    // 帧序号（u32 LE）
    buf.writeUInt32LE(frame.frameIndex, off); off += 4
    // IMU 解析数据（应用 scale 后的 value）
    for (let i = 0; i < imuFieldCount; i++) {
      const f = frame.fields[i]
      if (!f) {
        if (chBytes === 4) buf.writeFloatLE(NaN, off)
        else buf.writeDoubleLE(NaN, off)
      } else {
        if (chBytes === 4) buf.writeFloatLE(f.value, off)
        else buf.writeDoubleLE(f.value, off)
      }
      off += chBytes
    }
    // GNSS 数据：ve vn vu lat lng alt time（仅 hasGnss=true 时）
    if (gnssFieldCount > 0) {
      const g = this.lastGnss
      if (g) {
        buf.writeFloatLE(g.ve ?? 0, off); off += 4
        buf.writeFloatLE(g.vn ?? 0, off); off += 4
        buf.writeFloatLE(g.vu ?? 0, off); off += 4
        buf.writeFloatLE(g.lat ?? 0, off); off += 4
        buf.writeFloatLE(g.lng ?? 0, off); off += 4
        buf.writeFloatLE(g.alt ?? 0, off); off += 4
        buf.writeFloatLE(g.time ?? 0, off); off += 4
      } else {
        for (let i = 0; i < 7; i++) {
          buf.writeFloatLE(0, off); off += 4
        }
      }
    }
    return buf
  }
}
