/**
 * LabTool-V3 跨进程 API 类型
 * 主进程 / preload / 渲染端共用，不引用任何运行时模块。
 */

import type {
  DeviceType,
  FrameDescriptor,
  GnssMeasType,
  GnssVec8,
  ParsedFrame,
  SerialConfig,
  SerialStatus
} from '../shared'

export interface SerialStatusPayload {
  device: DeviceType
  status: SerialStatus
  config?: SerialConfig
  error?: string
}

export interface FrameParsedPayload {
  frames: ParsedFrame[]
  lastGnss: GnssVec8 | null
}

export interface GnssParsedPayload {
  vec: GnssVec8
  raw: string
}

export interface AppErrorPayload {
  device?: DeviceType
  message: string
}

export interface RecorderStatePayload {
  isRecording: boolean
  txtPath?: string
  binPath?: string
  bytesWritten: number
  linesWritten: number
}

export interface LabtoolAPI {
  /* 串口 */
  listPorts(): Promise<string[]>
  openIMU(config: SerialConfig, desc: FrameDescriptor): Promise<{ ok: boolean; error?: string }>
  openGNSS(config: SerialConfig): Promise<{ ok: boolean; error?: string }>
  closeIMU(): Promise<{ ok: boolean }>
  closeGNSS(): Promise<{ ok: boolean }>
  onSerialStatus(cb: (p: SerialStatusPayload) => void): () => void

  /* 协议帧 */
  setDescriptor(desc: FrameDescriptor): Promise<{ ok: boolean }>
  loadConfig(): Promise<{ ok: boolean; content?: string; path?: string; canceled?: boolean; error?: string }>
  saveConfig(content: string): Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>

  /* GNSS */
  setGnssMeasType(meas: GnssMeasType): Promise<{ ok: boolean }>

  /* 数据事件 */
  onFrames(cb: (p: FrameParsedPayload) => void): () => void
  onGnss(cb: (p: GnssParsedPayload) => void): () => void
  onGnssRaw(cb: (p: { line: string }) => void): () => void

  /* 落盘 */
  startRecorder(txtPath: string, fieldNames: string[], alignGnss: boolean): Promise<{ ok: boolean; error?: string }>
  stopRecorder(): Promise<{ ok: boolean; state: RecorderStatePayload }>

  /* 错误 */
  onError(cb: (p: AppErrorPayload) => void): () => void
}

declare global {
  interface Window {
    labtool: LabtoolAPI
  }
}
