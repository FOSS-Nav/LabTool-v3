/**
 * LabTool-V3 IPC 通道集中管理
 *
 * 约定：
 *   - 控制通道以 `:` 结尾命名（renderer → main invoke）
 *   - 事件通道以 `:` 开头命名（main → renderer send/on）
 *
 * 与 src/shared/types.ts IpcChannel 保持同步；
 * 该文件只允许 main/preload 引用。
 */

import { IpcChannel } from '../../shared/types'

export const CH = IpcChannel

/* 串口 */
export const SerialInvoke = {
  ListPorts: CH.SerialListPorts,
  OpenIMU: `${CH.SerialOpen}:imu`,
  OpenGNSS: `${CH.SerialOpen}:gnss`,
  CloseIMU: `${CH.SerialClose}:imu`,
  CloseGNSS: `${CH.SerialClose}:gnss`
} as const

/* 协议帧 */
export const FrameInvoke = {
  SetDescriptor: CH.FrameSet,
  LoadConfig: CH.FrameConfigLoad,
  SaveConfig: CH.FrameConfigSave
} as const

/* GNSS */
export const GnssInvoke = {
  SetMeasType: CH.GnssMeasTypeSet
} as const

/* 落盘 */
export const RecorderInvoke = {
  Start: CH.RecorderStart,
  Stop: CH.RecorderStop
} as const

/* 事件 */
export const SerialEvent = {
  StatusChanged: CH.SerialStatusChanged
} as const
export const DataEvent = {
  FrameParsed: CH.FrameParsed,
  GnssParsed: CH.GnssParsed,
  GnssRaw: CH.GnssRaw
} as const
export const LogEvent = {
  Recorder: CH.RecorderLog,
  AppError: CH.AppError
} as const
