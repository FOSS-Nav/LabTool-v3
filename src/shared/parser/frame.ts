/**
 * LabTool-V3 协议帧描述符 & 帧解码状态机
 *
 * 两个核心抽象：
 *  1. compileDescriptor(fields, endian) -> FrameDescriptor
 *     把 UI 中的"字段行"编译成字节级描述（frameLen/headerBytes/...）。
 *     与 V2 on_confirmDataFrame_btn_clicked 中的逻辑等价。
 *  2. FrameDecoder（类，持有状态）
 *     流式接收字节，按帧头对齐、截取整帧、调用 parser 返回 ParsedFrame。
 *     与 V2 mySerialPort::slot_recvSerialPortxData 中的状态机等价。
 */

import {
  DataKind,
  Endian,
  FieldRole,
  FrameDescriptor,
  FrameField,
  ParsedField,
  ParsedFrame
} from '../types'
import { byteSizeOf, isFloatKind, precisionFor, readField, SCALE_NONE } from './datatype'

/* ============================================================
 * 1. 编译 UI 表格为字节级描述
 * ============================================================ */

export function compileDescriptor(
  fields: FrameField[],
  endian: Endian
): FrameDescriptor {
  let frameLen = 0
  let headerLen = 0
  let dataTypeLen = 0
  const headerBytes: number[] = []
  let checksumPos = -1
  let timestampPos = -1

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    if (f.role === 'Frame_Header') {
      const v = parseHexByte(f.defaultValue)
      if (v === null) {
        throw new Error(`帧头值非法: "${f.defaultValue}"`)
      }
      headerBytes.push(v)
      headerLen++
      frameLen += 1
    } else if (f.role === 'Frame_Tail') {
      const v = parseHexByte(f.defaultValue)
      if (v === null) {
        throw new Error(`帧尾值非法: "${f.defaultValue}"`)
      }
      if (i !== fields.length - 1) {
        throw new Error('帧尾必须位于最后一行')
      }
      frameLen += 1
    } else {
      // 数据区
      if (f.role === 'Time_Stamp') {
        // V2 仅支持 uint8/uint16/uint32/float 四种时间戳
        if (
          f.type !== DataKind.Uint8 &&
          f.type !== DataKind.Uint16 &&
          f.type !== DataKind.Uint32 &&
          f.type !== DataKind.Float32
        ) {
          throw new Error(`时间戳类型不支持: ${f.type}`)
        }
        timestampPos = dataTypeLen
      } else if (f.role === 'Check_Sum') {
        if (f.type !== DataKind.Uint8 && f.type !== DataKind.Uint32) {
          throw new Error('校验和类型仅支持 uint8/uint32')
        }
        checksumPos = dataTypeLen
      }
      dataTypeLen++
      frameLen += byteSizeOf(f.type)
    }
  }

  return {
    fields,
    endian,
    derived: {
      frameLen,
      headerLen,
      dataTypeLen,
      headerBytes,
      checksumPos,
      timestampPos
    }
  }
}

function parseHexByte(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  let n: number
  if (/^0x/i.test(t)) {
    n = parseInt(t.slice(2), 16)
  } else if (/^[0-9a-fA-F]+$/.test(t) && t.length <= 2) {
    n = parseInt(t, 16)
  } else {
    // 退路：当作十进制
    n = parseInt(t, 10)
  }
  if (!Number.isFinite(n) || n < 0 || n > 255) return null
  return n
}

/* ============================================================
 * 2. 帧解码状态机
 * ============================================================ */

export interface DecodedBatch {
  /** 完整解析得到的帧（按顺序） */
  frames: ParsedFrame[]
  /** 残留未对齐的字节（不足一帧的部分，下次再拼） */
  residual: Uint8Array
}

export class FrameDecoder {
  private desc: FrameDescriptor
  private frameCounter = 0
  /** 已对齐的字节缓冲区 */
  private buffer: Uint8Array = new Uint8Array(0)
  /** 当前帧头匹配进度（仅在未对齐时使用） */
  private headerCounter = 0

  constructor(desc: FrameDescriptor) {
    this.desc = desc
  }

  /** 重新加载描述符（用户编辑完表格后调用） */
  reset(desc?: FrameDescriptor): void {
    if (desc) this.desc = desc
    this.frameCounter = 0
    this.buffer = new Uint8Array(0)
    this.headerCounter = 0
  }

  /**
   * 推入一段字节，返回已解码出的完整帧。
   * 算法：尾部追加 buffer -> 按 frameLen 切片 -> 校验帧头 -> 解析。
   */
  push(chunk: Uint8Array): DecodedBatch {
    const derived = this.desc.derived!
    const frameLen = derived.frameLen
    const headerBytes = derived.headerBytes

    // 拼接
    const next = new Uint8Array(this.buffer.length + chunk.length)
    next.set(this.buffer, 0)
    next.set(chunk, this.buffer.length)
    this.buffer = next

    const frames: ParsedFrame[] = []
    let cursor = 0
    let alignedStart = 0

    // 阶段一：在未对齐区域做帧头搜索
    if (this.headerCounter > 0 || !this.isAtHeaderBoundary(this.buffer, 0, headerBytes)) {
      const idx = this.findHeaderFrom(this.buffer, this.headerCounter, headerBytes)
      if (idx < 0) {
        // 整段都没匹配上帧头，只保留 (frameLen - 1) 字节作为下次匹配窗口
        const keep = Math.max(0, this.buffer.length - (frameLen - 1))
        this.buffer = this.buffer.slice(keep)
        this.headerCounter = 0
        return { frames, residual: new Uint8Array(0) }
      }
      this.headerCounter = 0
      alignedStart = idx
    }

    cursor = alignedStart

    // 阶段二：从对齐点开始，按 frameLen 切片逐帧解析
    while (cursor + frameLen <= this.buffer.length) {
      // 校验帧头（防御性，正常情况下首帧已对齐）
      if (!this.matchHeader(this.buffer, cursor, headerBytes)) {
        // 帧头不匹配：跳过这 1 字节，重新搜索
        cursor += 1
        const nextIdx = this.findHeaderFrom(this.buffer, cursor, headerBytes)
        if (nextIdx < 0) {
          break
        }
        cursor = nextIdx
        continue
      }

      const raw = this.buffer.slice(cursor, cursor + frameLen)
      const frame = this.parseFrame(raw)
      if (frame) {
        frames.push(frame)
        this.frameCounter++
      }
      cursor += frameLen
    }

    // 残留字节保留下来，等下次 push 拼接
    const residual = this.buffer.slice(cursor)
    this.buffer = residual

    return { frames, residual }
  }

  /** 当前缓冲区开头是否对齐到帧头 */
  private isAtHeaderBoundary(buf: Uint8Array, off: number, header: number[]): boolean {
    if (header.length === 0) return true
    if (buf.length - off < header.length) return false
    return this.matchHeader(buf, off, header)
  }

  private matchHeader(buf: Uint8Array, off: number, header: number[]): boolean {
    for (let i = 0; i < header.length; i++) {
      if (buf[off + i] !== header[i]) return false
    }
    return true
  }

  /** 在 buf[start..] 中查找完整的帧头序列；返回匹配起点，未找到返回 -1 */
  private findHeaderFrom(buf: Uint8Array, start: number, header: number[]): number {
    if (header.length === 0) return start
    outer: for (let i = start; i + header.length <= buf.length; i++) {
      for (let j = 0; j < header.length; j++) {
        if (buf[i + j] !== header[j]) continue outer
      }
      return i
    }
    return -1
  }

  /** 解析一帧（已确认对齐） */
  private parseFrame(raw: Uint8Array): ParsedFrame | null {
    const derived = this.desc.derived!
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = derived.headerLen
    const fields: ParsedField[] = []
    let timestamp: number | undefined

    for (let i = 0; i < this.desc.fields.length; i++) {
      const f = this.desc.fields[i]
      if (f.role === 'Frame_Header' || f.role === 'Frame_Tail') continue

      const size = byteSizeOf(f.type)
      const rawVal = readField(view, off, f.type, this.desc.endian)
      off += size

      // SCALE_NONE (9999.99) 表示"不使用标度"，与 V2 中 `scale > 9999.99 不使用` 一致；
      // 这里必须用严格小于，否则 SCALE_NONE 自身会被当作有效 scale 乘进去（导致 uint8 显示成上万）。
      const useScale = f.scale < SCALE_NONE && Number.isFinite(f.scale) && f.scale !== 0
      const value = useScale ? rawVal * f.scale : rawVal

      if (f.role === 'Time_Stamp') {
        timestamp = value
      }

      // V2 不把 Time_Stamp/Check_Sum 写入 outStr，这里同样排除
      if (f.role === 'Check_Sum') continue

      fields.push({ name: f.name, raw: rawVal, value, scale: f.scale })
    }

    return {
      frameIndex: this.frameCounter,
      timestamp,
      fields,
      raw
    }
  }
}

/* ============================================================
 * 3. 工具：根据 FrameDescriptor 产生 V2 风格的"绘图选项目标"
 *    仅 role=Data 的字段可被选为曲线。
 * ============================================================ */

export interface PlottableInfo {
  /** 在 fields 数组中的索引（含 Frame_Header 等） */
  tableRow: number
  /** 在 ParsedFrame.fields 中的索引（仅 Data） */
  dataIndex: number
  name: string
}

export function listPlottable(desc: FrameDescriptor): PlottableInfo[] {
  const out: PlottableInfo[] = []
  let dataIndex = 0
  for (let i = 0; i < desc.fields.length; i++) {
    const f = desc.fields[i]
    if (f.role === 'Data') {
      out.push({ tableRow: i, dataIndex, name: f.name })
      dataIndex++
    }
  }
  return out
}
