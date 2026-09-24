/**
 * LabTool-V3 共享类型定义
 * 主进程 / preload / 渲染进程共用
 * 与 V2 (Qt) mydatatype.h + mainwindow.h 数据结构一一对应。
 */

/* ============================================================
 * 1. 数据类型 & 字节序
 * 对应 V2 mydatatype.h myChar.._2bytesToInt 十个常量
 * ============================================================ */

export enum DataKind {
  Char = 0,
  Uint8 = 1,
  Int16 = 2,
  Uint16 = 3,
  Int32 = 4,
  Uint32 = 5,
  Float32 = 6,
  Float64 = 7,
  ThreeByteInt = 8, // STIM300 专用
  TwoByteInt = 9    // MSI310F 专用
}

/** 字节序 - 对应 V2 updateEndianMode */
export enum Endian {
  Little = 0,
  Big = 1
}

/** 协议帧字段类型名（中英映射，与 V2 myDataTypeList 保持一致） */
export const DataTypeName: Record<DataKind, string> = {
  [DataKind.Char]: 'char',
  [DataKind.Uint8]: 'uint8_t',
  [DataKind.Int16]: 'int16',
  [DataKind.Uint16]: 'uint16_t',
  [DataKind.Int32]: 'int32',
  [DataKind.Uint32]: 'uint32_t',
  [DataKind.Float32]: 'float32',
  [DataKind.Float64]: 'float64',
  [DataKind.ThreeByteInt]: '3bytesToInt',
  [DataKind.TwoByteInt]: '2bytesToInt'
}

/** 由字符串反向解析类型（不区分大小写） */
export function dataKindFromName(name: string): DataKind | null {
  const n = name.trim().toLowerCase()
  for (const k of Object.values(DataKind)) {
    if (typeof k !== 'number') continue
    if (DataTypeName[k as DataKind] === n) return k as DataKind
  }
  // 兼容 V2 写法 'uint8_t(hex)'
  if (n.startsWith('uint8_t')) return DataKind.Uint8
  // 兼容 V2 旧命名（V3 已统一为 {类型}{位宽}，如 short→int16, int→int32, float→float32, double→float64）
  switch (n) {
    case 'short': return DataKind.Int16
    case 'int': return DataKind.Int32
    case 'float': return DataKind.Float32
    case 'double': return DataKind.Float64
    default: return null
  }
}

/* ============================================================
 * 2. 协议帧描述
 * 对应 V2 mainwindow.h 中 frameHeaderNum/frameDataType/...
 * 字段的 UI 编辑模型：一行 = 一个字段
 * ============================================================ */

/** 字段种类 - 对应 V2 的特殊名称 */
export type FieldRole =
  | 'Frame_Header'
  | 'Frame_Tail'
  | 'Time_Stamp'
  | 'Check_Sum'
  | 'Data'

/** 协议帧的一行字段（与 V2 表格行对应） */
export interface FrameField {
  id: string              // 唯一 id（用于 React key）
  name: string            // 字段名（"dataName"）
  type: DataKind          // 数据类型
  defaultValue: string    // 默认值（hex / 数值字符串）
  scale: number           // 标度因数；9999.99 = 不使用
  role: FieldRole         // 该行承担的角色
  isPlot1: boolean        // 是否在曲线图1中绘制
  isPlot2: boolean        // 是否在曲线图2中绘制
  isPlot3: boolean        // 是否在曲线图3中绘制
}

/** 协议帧描述（整张表） */
export interface FrameDescriptor {
  fields: FrameField[]
  endian: Endian
  /** 自动计算的派生量（解析阶段使用） */
  derived?: {
    frameLen: number           // 一帧字节数
    headerLen: number          // 帧头字节数
    dataTypeLen: number        // 数据区字段数
    headerBytes: number[]      // 帧头字节序列
    checksumPos: number        // 校验位在 dataTypeLen 中的索引；-1 = 无
    timestampPos: number       // 时间戳在 dataTypeLen 中的索引；-1 = 无
  }
}

/* ============================================================
 * 3. 解析结果
 * 对应 V2 parseOrSaveDataTask 中 outStr 的每帧产物
 * ============================================================ */

export interface ParsedField {
  name: string
  raw: number         // 未应用 scale 的原始数值
  value: number       // 应用 scale 后的最终值（保留 double 精度）
  scale: number
}

export interface ParsedFrame {
  /** 帧序号（recv_frameCounter） */
  frameIndex: number
  /** 时间戳（若有，从 Time_Stamp 字段提取） */
  timestamp?: number
  /** 解析得到的字段（不含 Frame_Header/Frame_Tail/Check_Sum） */
  fields: ParsedField[]
  /** 原始字节（用于落盘 .bin） */
  raw: Uint8Array
}

/* ============================================================
 * 4. 串口配置
 * 对应 V2 mySerialPort openSerialPortx 五个参数
 * ============================================================ */

export interface SerialConfig {
  portName: string
  baudRate: number
  dataBits: 5 | 6 | 7 | 8
  /** V2 语义：0=None, 2=Even, 3=Odd —— 与 Electron serialport 一致 */
  parity: 0 | 2 | 3
  /** V2 语义：1=One, 3=1.5, 2=Two —— 反直觉但保持兼容 */
  stopBits: 1 | 3 | 2
}

export enum DeviceType {
  IMU = 'IMU',
  GNSS = 'GNSS'
}

export enum SerialStatus {
  Closed = 'closed',
  Opening = 'opening',
  Open = 'open',
  Error = 'error'
}

/** GNSS 量测类型 - 对应 V2 GNSSMeasType（保留兼容；新代码请用 PosMsg/VelMsg） */
export enum GnssMeasType {
  OnlyPos = 0,
  VelPos = 1
}

/** 位置报文选择 - 对应 V2 GPGGA / BESTPOS */
export enum GnssPosMsg {
  GPGGA = 'GPGGA',
  BESTPOS = 'BESTPOS'
}

/** 速度报文选择 - 对应 V2 GPVTG / BESTVEL */
export enum GnssVelMsg {
  GPVTG = 'GPVTG',
  BESTVEL = 'BESTVEL'
}

/* ============================================================
 * 5. GNSS 报文解析结果
 * 对应 V2 gnss_parse.h 中四个结构体
 * ============================================================ */

export interface GpggaData {
  utcTime: string
  latitude: number
  latitudeDirection: 'N' | 'S'
  longitude: number
  longitudeDirection: 'E' | 'W'
  fixQuality: number
  numSatellites: number
  hdop: number
  altitude: number
  geoidHeight: number
}

export interface GpvtgData {
  trueHeading: number
  magneticHeading: number
  speedKnots: number
  speedKmh: number
}

export interface NovAVData {
  week: number
  second: number
  velocityH: number
  heading: number
  velocityU: number
}

export interface NovAPData {
  latitude: number
  longitude: number
  height: number
  hdop: number
  vdop: number
  status: number
  timestamp: string
}

/** 8 个标量 - 与 V2 gnss_vp[8] 布局一致 */
export interface GnssVec8 {
  /** [0]东向速度 m/s */
  ve: number
  /** [1]北向速度 m/s */
  vn: number
  /** [2]天向速度 m/s */
  vu: number
  /** [3]纬度 deg */
  lat: number
  /** [4]经度 deg */
  lng: number
  /** [5]高度 m */
  alt: number
  /** [6]时间（UTC 秒） */
  time: number
  /** [7]HDOP */
  hdop: number
}

/* ============================================================
 * 6. IPC 通道常量
 * 由 main 进程 + preload + renderer 共同引用
 * ============================================================ */

export const IpcChannel = {
  // 控制（renderer → main）
  SerialListPorts: 'serial:list-ports',
  SerialOpen: 'serial:open',
  SerialClose: 'serial:close',
  FrameSet: 'frame:set',
  GnssMeasTypeSet: 'gnss:meas-type',
  GnssPosMsgSet: 'gnss:pos-msg',
  GnssVelMsgSet: 'gnss:vel-msg',
  RecorderStart: 'recorder:start',
  RecorderStop: 'recorder:stop',
  RecorderGetState: 'recorder:get-state',
  AssistantOpen: 'assistant:open',
  AssistantClose: 'assistant:close',
  AssistantWrite: 'assistant:write',
  AssistantGetState: 'assistant:get-state',
  FrameConfigLoad: 'frame-config:load',
  FrameConfigSave: 'frame-config:save',

  // 事件（main → renderer）
  SerialStatusChanged: 'serial:status-changed',
  FrameParsed: 'frame:parsed',
  GnssParsed: 'gnss:parsed',
  GnssRaw: 'gnss:raw',
  AssistantStatus: 'assistant:status',
  AssistantData: 'assistant:data',
  RecorderLog: 'recorder:log',
  AppError: 'app:error'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

/* ============================================================
 * 7. 跨进程消息载荷
 * ============================================================ */

export interface SerialOpenedPayload {
  device: DeviceType
  config: SerialConfig
}

export interface SerialErrorPayload {
  device: DeviceType
  message: string
}

export interface FrameParsedPayload {
  frames: ParsedFrame[]
  /** 来自 GNSS 的对齐串，用于保存 txt 的"时间对齐"功能 */
  lastGnss?: GnssVec8 | null
}

/** 最近一次收到的某类报文原始解析结果（用于表格 / 详情） */
export interface GnssLastPos {
  kind: 'GPGGA' | 'BESTPOS'
  utcTime: string
  latitude: number
  longitude: number
  altitude: number
  hdop: number
  /** GPGGA only */
  fixQuality?: number
  numSatellites?: number
  geoidHeight?: number
  latitudeDirection?: 'N' | 'S'
  longitudeDirection?: 'E' | 'W'
  /** BESTPOS only */
  vdop?: number
  status?: number
  timestamp?: string
}

export interface GnssLastVel {
  kind: 'GPVTG' | 'BESTVEL'
  /** GPVTG only */
  trueHeading?: number
  magneticHeading?: number
  speedKnots?: number
  speedKmh?: number
  /** BESTVEL only */
  velocityH?: number
  heading?: number
  velocityU?: number
  week?: number
  second?: number
}

export interface GnssParsedPayload {
  raw: string
  vec: GnssVec8
  /** 本地投影坐标（用于轨迹图） */
  east: number
  north: number
  /** 最近一次收到的位置报文（用于数据表：HDOP/VDOP/Sat/Status/Timestamp 等） */
  lastPos?: GnssLastPos
  /** 最近一次收到的速度报文（用于数据表：heading/velocityH 等） */
  lastVel?: GnssLastVel
}

export interface RecorderLogPayload {
  level: 'info' | 'warn' | 'error'
  message: string
}

/* ============================================================
 * 8. 端序/类型枚举的扩展工具
 * ============================================================ */

export function isHeaderField(role: FieldRole): boolean {
  return role === 'Frame_Header'
}

export function isPlottableField(role: FieldRole): boolean {
  return role === 'Data'
}
