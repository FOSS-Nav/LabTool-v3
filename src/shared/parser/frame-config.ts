/**
 * LabTool-V3 协议帧配置加载/保存
 *
 * 兼容 V2 的 .txt 配置格式（CSV，每行：name,type,default,scale）：
 * ```
 * Frame_Header,uint8_t(hex),0xEB,------
 * bmi-wx,float,-0.2593994,------
 * Check_Sum,uint8,0,------
 * ```
 *
 * 我们的 FrameField 还会额外记录 isPlot1/2/3；
 * 加载 .txt 时这三个字段默认为 false；UI 上可重新勾选后保存。
 */

import { DataKind, Endian, FieldRole, FrameField } from '../types'
import { dataKindFromName } from '../types'
import { SCALE_NONE } from './datatype'

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `f_${Date.now().toString(36)}_${idCounter}`
}

/** 把 defaultValue 字符串解析成数值（用于保存时的 defaultValue 列回填） */
function defaultValueForKind(kind: DataKind, v: number | string): string {
  if (kind === DataKind.Uint8 || kind === DataKind.Char) {
    const n = typeof v === 'string' ? parseInt(v, 16) : (v as number)
    if (Number.isFinite(n) && n >= 0 && n <= 255) return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`
  }
  return String(v)
}

/** 解析 V2 CSV 文本为 FrameField[] */
export function parseFrameConfigCsv(text: string): FrameField[] {
  const lines = text.split(/\r?\n/)
  const fields: FrameField[] = []
  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, '').trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(',')
    if (parts.length < 2) continue
    const [name, typeName, defaultStr, scaleStr] = parts

    let role: FieldRole = 'Data'
    if (name === 'Frame_Header') role = 'Frame_Header'
    else if (name === 'Frame_Tail') role = 'Frame_Tail'
    else if (name === 'Time_Stamp') role = 'Time_Stamp'
    else if (name === 'Check_Sum') role = 'Check_Sum'

    const kind = dataKindFromName(typeName)
    if (kind === null) {
      // V2 写法 "uint8_t(hex)" 也已兼容，若仍解析失败则降级为 uint8
      fields.push({
        id: nextId(),
        name: name.trim(),
        type: DataKind.Uint8,
        defaultValue: defaultStr?.trim() ?? '0',
        scale: SCALE_NONE,
        role,
        isPlot1: false,
        isPlot2: false,
        isPlot3: false
      })
      continue
    }

    let scale = SCALE_NONE
    if (scaleStr !== undefined && scaleStr.trim() !== '/' && scaleStr.trim() !== '------') {
      const n = Number(scaleStr)
      if (Number.isFinite(n)) scale = n
    }

    fields.push({
      id: nextId(),
      name: name.trim(),
      type: kind,
      defaultValue: defaultStr?.trim() ?? '0',
      scale,
      role,
      isPlot1: false,
      isPlot2: false,
      isPlot3: false
    })
  }
  return fields
}

/** 把 FrameField[] 序列化为 V2 风格 CSV 文本 */
export function serializeFrameConfigCsv(
  fields: FrameField[],
  endian: Endian
): string {
  const lines: string[] = []
  lines.push(`# endian=${endian === Endian.Little ? 'little' : 'big'}`)
  for (const f of fields) {
    const typeName =
      f.role === 'Frame_Header' ? 'uint8_t(hex)' : dataKindName(f.type)
    const def = defaultValueForKind(f.type, f.defaultValue)
    const scale = f.scale === SCALE_NONE ? '/' : String(f.scale)
    lines.push(`${f.name},${typeName},${def},${scale}`)
  }
  return lines.join('\n')
}

function dataKindName(kind: DataKind): string {
  switch (kind) {
    case DataKind.Char: return 'char'
    case DataKind.Uint8: return 'uint8_t'
    case DataKind.Int16: return 'short'
    case DataKind.Uint16: return 'uint16_t'
    case DataKind.Int32: return 'int'
    case DataKind.Uint32: return 'uint32_t'
    case DataKind.Float32: return 'float'
    case DataKind.Float64: return 'double'
    case DataKind.ThreeByteInt: return '3bytesToInt'
    case DataKind.TwoByteInt: return '2bytesToInt'
    default: return 'uint8_t'
  }
}

/** 解析 defaultValue 字符串为 number（hex 或 dec） */
export function parseDefaultByte(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  let n: number
  if (/^0x/i.test(t)) n = parseInt(t.slice(2), 16)
  else if (/^[0-9a-fA-F]+$/.test(t) && t.length <= 2) n = parseInt(t, 16)
  else n = parseInt(t, 10)
  if (!Number.isFinite(n) || n < 0 || n > 255) return null
  return n
}

/** 解析 scale 字符串为 number；非法 → SCALE_NONE */
export function parseScale(s: string): number {
  const t = s.trim()
  if (!t || t === '/' || t === '------') return SCALE_NONE
  const n = Number(t)
  return Number.isFinite(n) ? n : SCALE_NONE
}
