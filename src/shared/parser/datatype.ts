/**
 * LabTool-V3 数据类型基础解析器
 * 对应 V2 mydatatype.cpp：10 种基础类型的字节序无关读写。
 *
 * 设计要点：
 * - 全部纯函数，不持有状态（endian 由调用方传入）；
 * - 使用 DataView 以保证 strict 模式下的字节序正确；
 * - 与 V2 行为对齐（包括 3bytesToInt / 2bytesToInt 两种非标字段）。
 */

import { DataKind, Endian } from '../types'

/** 返回读取一个字段所需的字节数 */
export function byteSizeOf(kind: DataKind): number {
  switch (kind) {
    case DataKind.Char:
    case DataKind.Uint8:
      return 1
    case DataKind.Int16:
    case DataKind.Uint16:
    case DataKind.TwoByteInt:
      return 2
    case DataKind.Int32:
    case DataKind.Uint32:
    case DataKind.Float32:
    case DataKind.ThreeByteInt:
      return 4
    case DataKind.Float64:
      return 8
    default:
      return 0
  }
}

/**
 * 在视图上读取一个字段。
 * @param view 源数据视图
 * @param offset 字节偏移
 * @param kind 字段类型
 * @param endian 字节序
 * @returns 解析后的数值（已按 V2 语义返回 number）
 *
 * 注：JS 中所有 number 都是 float64，但 V2 用 union + (int)/(uint) 转换；
 *     这里返回 number 时大小与 V2 保持一致，符号由位运算/类型决定。
 */
export function readField(
  view: DataView,
  offset: number,
  kind: DataKind,
  endian: Endian
): number {
  const little = endian === Endian.Little
  switch (kind) {
    case DataKind.Char: {
      // V2: qint8(*pBuf)
      return view.getInt8(offset)
    }
    case DataKind.Uint8: {
      return view.getUint8(offset)
    }
    case DataKind.Int16: {
      return view.getInt16(offset, little)
    }
    case DataKind.Uint16: {
      return view.getUint16(offset, little)
    }
    case DataKind.Int32: {
      return view.getInt32(offset, little)
    }
    case DataKind.Uint32: {
      return view.getUint32(offset, little)
    }
    case DataKind.Float32: {
      return view.getFloat32(offset, little)
    }
    case DataKind.Float64: {
      return view.getFloat64(offset, little)
    }
    case DataKind.ThreeByteInt: {
      // V2: 24-bit 有符号整数，扩展到 32 位再算术右移 8 位
      //   little: buf[0]=0, buf[1..3] = 字节序列
      //   big:    buf[0]=字节序列, buf[3]=0
      let raw32: number
      if (little) {
        raw32 =
          (view.getUint8(offset + 0) << 24) >>> 0 |
          (view.getUint8(offset + 1) << 16) |
          (view.getUint8(offset + 2) << 8) |
          0
      } else {
        raw32 =
          (0 << 24) |
          (view.getUint8(offset + 0) << 16) |
          (view.getUint8(offset + 1) << 8) |
          view.getUint8(offset + 2)
      }
      // 算术右移 8 位得到 24-bit 符号扩展
      return raw32 >> 8
    }
    case DataKind.TwoByteInt: {
      // V2: 16-bit 有符号整数，按 endian 读取
      return view.getInt16(offset, little)
    }
    default:
      return 0
  }
}

/** 字段是否使用浮点格式化（V2 用 'g',7/'g',15 区分） */
export function isFloatKind(kind: DataKind): boolean {
  return kind === DataKind.Float32 || kind === DataKind.Float64
}

/** V2 格式串：float 用 'g',7；double 用 'g',15；其它用 'g',7 */
export function precisionFor(kind: DataKind): number {
  return kind === DataKind.Float64 ? 15 : 7
}

/** V2 写法：scale > 9999 表示不使用标度因数 */
export const SCALE_NONE = 9999.99
