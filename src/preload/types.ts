/**
 * LabTool-V3 跨进程 API 类型
 * 主进程 / preload / 渲染端共用，不引用任何运行时模块。
 */

import type {
  DeviceType,
  FrameDescriptor,
  GnssLastPos,
  GnssLastVel,
  GnssMeasType,
  GnssPosMsg,
  GnssVec8,
  GnssVelMsg,
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

export interface AssistantStatusPayload {
  status: SerialStatus
  config?: SerialConfig
  error?: string
}

export interface AssistantDataPayload {
  /** 原始字节，渲染端按 hex 或 ascii 显示 */
  data: number[]
  ts: number
}

export interface GnssParsedPayload {
  vec: GnssVec8
  raw: string
  east: number
  north: number
  /** 最近一次收到的位置报文原始结果 */
  lastPos?: GnssLastPos
  /** 最近一次收到的速度报文原始结果 */
  lastVel?: GnssLastVel
}

export interface AppErrorPayload {
  device?: DeviceType
  message: string
}

export interface RecorderStatePayload {
  isRecording: boolean
  baseName: string
  outDir: string
  imuHexPath: string
  gnssTxtPath: string | null
  parsedBinPath: string
  parsedTxtPath: string
  imuHexBytes: number
  gnssTxtBytes: number
  parsedBinFrames: number
  parsedTxtBytes: number
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
  setGnssPosMsg(m: GnssPosMsg): Promise<{ ok: boolean }>
  setGnssVelMsg(m: GnssVelMsg): Promise<{ ok: boolean }>

  /* 数据事件 */
  onFrames(cb: (p: FrameParsedPayload) => void): () => void
  onGnss(cb: (p: GnssParsedPayload) => void): () => void
  onGnssRaw(cb: (p: { line: string }) => void): () => void

  /* 落盘 */
  startRecorder(args: {
    baseName: string
    outDir: string
    enableGnss: boolean
    imuChannelBytes: 4 | 8
    imuFieldCount: number
    imuFieldNames: string[]
  }): Promise<{ ok: boolean; state?: RecorderStatePayload; error?: string }>
  stopRecorder(): Promise<{ ok: boolean }>
  getRecorderState(): Promise<RecorderStatePayload | null>

  /* 串口助手 */
  openAssistant(config: SerialConfig): Promise<{ ok: boolean; error?: string }>
  closeAssistant(): Promise<{ ok: boolean }>
  writeAssistant(data: string): Promise<{ ok: boolean; written?: number; error?: string }>
  getAssistantState(): Promise<{ status: SerialStatus; config?: SerialConfig }>
  onAssistantStatus(cb: (p: AssistantStatusPayload) => void): () => void
  onAssistantData(cb: (p: AssistantDataPayload) => void): () => void

  /* 错误 */
  onError(cb: (p: AppErrorPayload) => void): () => void
}

declare global {
  interface Window {
    labtool: LabtoolAPI
  }
}
