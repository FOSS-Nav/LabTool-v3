/**
 * LabTool-V3 串口管理器
 *
 * 对应 V2 mySerialPort::mySerialPort 的能力，但合并到一个类里管理两路：
 *   - IMU 串口：连续字节流，按 FrameDescriptor 切帧
 *   - GNSS 串口：ASCII 行流，按 $ / # 起始 + \n 结束切句
 *
 * 注意：本文件只能在 Electron 主进程里执行（依赖 Node serialport 包）。
 */

import { EventEmitter } from 'node:events'
import { SerialPort } from 'serialport'
import {
  DeviceType,
  FrameDescriptor,
  FrameDecoder,
  GnssMeasType,
  GnssPosMsg,
  GnssVelMsg,
  SerialConfig,
  SerialStatus
} from '../../shared'
import { createTraceState, updateTrace } from '../../shared/gnss/trace'
import { mergeGnssVec8 } from '../../shared/gnss/parser'

interface DeviceState {
  port?: SerialPort
  status: SerialStatus
  config?: SerialConfig
  /** IMU: 帧解码器；GNSS: undefined */
  decoder?: FrameDecoder
  /** GNSS 行缓冲 */
  lineBuf: string
  /** GNSS 量测类型（velpos / onlypos）—— 旧 API 兼容 */
  measType: GnssMeasType
  /** GNSS 位置报文（GPGGA / BESTPOS） */
  posMsg: GnssPosMsg
  /** GNSS 速度报文（GPVTG / BESTVEL） */
  velMsg: GnssVelMsg
  /** GNSS 本地投影状态（origin 锁定 + 滑动窗口） */
  trace: ReturnType<typeof createTraceState>
}

export interface SerialEvents {
  'imu:status': [status: SerialStatus, config?: SerialConfig, error?: string]
  'gnss:status': [status: SerialStatus, config?: SerialConfig, error?: string]
  /** 一批帧已解出 */
  'imu:frames': [
    frames: ReturnType<FrameDecoder['push']>['frames']
  ]
  /** 一批 GNSS 行已合并为 8 维向量 + 本地投影 east/north */
  'gnss:merged': [
    vec: ReturnType<typeof mergeGnssVec8>,
    raw: string[],
    east: number,
    north: number
  ]
  /** IMU 串口原始字节流（每个 chunk 一次） */
  'imu:raw': [buf: Buffer]
  'gnss:raw': [line: string]
  /** 串口助手：状态变化 */
  'assistant:status': [status: SerialStatus, config?: SerialConfig, error?: string]
  /** 串口助手：接收到的字节 */
  'assistant:data': [buf: Buffer]
  'error': [device: DeviceType, message: string]
}

export declare interface SerialManager {
  on<K extends keyof SerialEvents>(event: K, listener: (...args: SerialEvents[K]) => void): this
  emit<K extends keyof SerialEvents>(event: K, ...args: SerialEvents[K]): boolean
}

export class SerialManager extends EventEmitter {
  private imu: DeviceState = {
    status: SerialStatus.Closed,
    lineBuf: '',
    measType: GnssMeasType.VelPos,
    posMsg: GnssPosMsg.GPGGA,
    velMsg: GnssVelMsg.GPVTG,
    trace: createTraceState()
  }
  private gnss: DeviceState = {
    status: SerialStatus.Closed,
    lineBuf: '',
    measType: GnssMeasType.VelPos,
    posMsg: GnssPosMsg.GPGGA,
    velMsg: GnssVelMsg.GPVTG,
    trace: createTraceState()
  }
  private assistant: DeviceState = {
    status: SerialStatus.Closed,
    lineBuf: '',
    measType: GnssMeasType.VelPos,
    posMsg: GnssPosMsg.GPGGA,
    velMsg: GnssVelMsg.GPVTG,
    trace: createTraceState()
  }

  /** 列出可用串口名 */
  static async listPorts(): Promise<string[]> {
    try {
      const ports = await SerialPort.list()
      return ports.map((p) => p.path)
    } catch (e) {
      return []
    }
  }

  /** IMU 串口打开 */
  async openIMU(config: SerialConfig, desc: FrameDescriptor): Promise<void> {
    await this.closeDevice('imu')
    this.imu.decoder = new FrameDecoder(desc)
    this.imu.status = SerialStatus.Opening
    this.emit('imu:status', this.imu.status, config)
    const port = new SerialPort({
      path: config.portName,
      baudRate: config.baudRate,
      dataBits: config.dataBits,
      parity: this.mapParity(config.parity),
      stopBits: this.mapStopBits(config.stopBits),
      autoOpen: false
    })
    this.imu.port = port
    this.imu.config = config
    port.on('data', (buf) => this.onImuData(buf))
    port.on('error', (err) => this.onError('imu', err))
    port.on('close', () => this.onClose('imu'))
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((err) => (err ? reject(err) : resolve()))
      })
      this.imu.status = SerialStatus.Open
      this.emit('imu:status', this.imu.status, config)
    } catch (e) {
      this.imu.status = SerialStatus.Error
      this.emit('imu:status', this.imu.status, config, (e as Error).message)
      throw e
    }
  }

  /** GNSS 串口打开 */
  async openGNSS(config: SerialConfig): Promise<void> {
    await this.closeDevice('gnss')
    this.imu.status = SerialStatus.Opening
    this.emit('gnss:status', SerialStatus.Opening, config)
    const port = new SerialPort({
      path: config.portName,
      baudRate: config.baudRate,
      dataBits: config.dataBits,
      parity: this.mapParity(config.parity),
      stopBits: this.mapStopBits(config.stopBits),
      autoOpen: false
    })
    this.gnss.port = port
    this.gnss.config = config
    this.gnss.lineBuf = ''
    port.on('data', (buf) => this.onGnssData(buf))
    port.on('error', (err) => this.onError('gnss', err))
    port.on('close', () => this.onClose('gnss'))
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((err) => (err ? reject(err) : resolve()))
      })
      this.gnss.status = SerialStatus.Open
      this.emit('gnss:status', this.gnss.status, config)
    } catch (e) {
      this.gnss.status = SerialStatus.Error
      this.emit('gnss:status', this.gnss.status, config, (e as Error).message)
      throw e
    }
  }

  async closeIMU(): Promise<void> {
    await this.closeDevice('imu')
  }

  async closeGNSS(): Promise<void> {
    await this.closeDevice('gnss')
  }

  /** 切换 IMU 描述符（用户重新编辑表格后调用） */
  setIMUDescriptor(desc: FrameDescriptor): void {
    if (this.imu.decoder) this.imu.decoder.reset(desc)
    else this.imu.decoder = new FrameDecoder(desc)
  }

  setGnssMeasType(t: GnssMeasType): void {
    this.gnss.measType = t
  }

  setGnssPosMsg(m: GnssPosMsg): void {
    this.gnss.posMsg = m
  }

  setGnssVelMsg(m: GnssVelMsg): void {
    this.gnss.velMsg = m
  }

  /** 全关 */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.closeDevice('imu'),
      this.closeDevice('gnss'),
      this.closeAssistant()
    ])
  }

  /* ============================================================
   * 串口助手（独立于 IMU/GNSS 的第三个端口，不解析任何协议）
   * ============================================================ */

  /** 打开助手串口 */
  async openAssistant(config: SerialConfig): Promise<void> {
    await this.closeAssistant()
    this.assistant.status = SerialStatus.Opening
    this.emit('assistant:status', this.assistant.status, config)
    const port = new SerialPort({
      path: config.portName,
      baudRate: config.baudRate,
      dataBits: config.dataBits,
      parity: this.mapParity(config.parity),
      stopBits: this.mapStopBits(config.stopBits),
      autoOpen: false
    })
    this.assistant.port = port
    this.assistant.config = config
    this.assistant.lineBuf = ''
    port.on('data', (buf) => {
      this.emit('assistant:data', buf)
    })
    port.on('error', (err) => {
      this.assistant.status = SerialStatus.Error
      this.emit('assistant:status', this.assistant.status, this.assistant.config, err.message)
    })
    port.on('close', () => {
      this.assistant.status = SerialStatus.Closed
      this.assistant.port = undefined
      this.emit('assistant:status', this.assistant.status)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((err) => (err ? reject(err) : resolve()))
      })
      this.assistant.status = SerialStatus.Open
      this.emit('assistant:status', this.assistant.status, config)
    } catch (e) {
      this.assistant.status = SerialStatus.Error
      this.emit('assistant:status', this.assistant.status, this.assistant.config, (e as Error).message)
      throw e
    }
  }

  /** 关闭助手串口 */
  async closeAssistant(): Promise<void> {
    const dev = this.assistant
    if (dev.port && dev.port.isOpen) {
      await new Promise<void>((resolve) => {
        dev.port!.close(() => resolve())
      })
    }
    dev.port = undefined
    dev.status = SerialStatus.Closed
    dev.config = undefined
    dev.lineBuf = ''
    this.emit('assistant:status', dev.status)
  }

  /** 助手串口写入 */
  writeAssistant(data: Buffer | string): number {
    const dev = this.assistant
    if (!dev.port || !dev.port.isOpen) return 0
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
    dev.port.write(buf)
    return buf.length
  }

  /** 助手状态查询 */
  getAssistantState(): { status: SerialStatus; config?: SerialConfig } {
    return { status: this.assistant.status, config: this.assistant.config }
  }

  /* ============================================================
   * 内部
   * ============================================================ */

  private async closeDevice(which: 'imu' | 'gnss'): Promise<void> {
    const dev = which === 'imu' ? this.imu : this.gnss
    if (dev.port && dev.port.isOpen) {
      await new Promise<void>((resolve) => {
        dev.port!.close(() => resolve())
      })
    }
    dev.port = undefined
    dev.status = SerialStatus.Closed
    dev.config = undefined
    if (which === 'gnss') {
      // 重置 GNSS 本地投影原点（下次打开时重新锁定第 1 个有效点）
      dev.lineBuf = ''
      dev.trace.lat0 = 0
      dev.trace.lng0 = 0
      dev.trace.clRNh = 0
      dev.trace.locked = false
      dev.trace.east.length = 0
      dev.trace.north.length = 0
    }
    this.emit(`${which}:status` as const, dev.status)
  }

  private mapParity(p: 0 | 2 | 3): 'none' | 'even' | 'odd' {
    if (p === 2) return 'even'
    if (p === 3) return 'odd'
    return 'none'
  }

  private mapStopBits(s: 1 | 3 | 2): 1 | 1.5 | 2 {
    if (s === 3) return 1.5
    if (s === 2) return 2
    return 1
  }

  private onImuData(buf: Buffer): void {
    // 1) 总是先发出原始字节（用于落盘 IMU_HEX.bin）
    this.emit('imu:raw', buf)
    // 2) 再走状态机切帧
    if (!this.imu.decoder) return
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    const { frames } = this.imu.decoder.push(u8)
    if (frames.length > 0) this.emit('imu:frames', frames)
  }

  private onGnssData(buf: Buffer): void {
    const text = buf.toString('utf8')
    this.gnss.lineBuf += text
    let idx = this.gnss.lineBuf.indexOf('\n')
    const lines: string[] = []
    while (idx >= 0) {
      let line = this.gnss.lineBuf.slice(0, idx)
      this.gnss.lineBuf = this.gnss.lineBuf.slice(idx + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      line = line.trim()
      if (line.length > 0) {
        lines.push(line)
        this.emit('gnss:raw', line)
      }
      idx = this.gnss.lineBuf.indexOf('\n')
    }
    if (lines.length > 0) {
      const vec = mergeGnssVec8(lines)
      // 计算本地投影：以首个有效 GPGGA/BESTPOS 为原点（共享给渲染端，确保一致）
      const projected = updateTrace(this.gnss.trace, vec.lat, vec.lng)
      this.emit('gnss:merged', vec, lines, projected.east, projected.north)
    }
  }

  private onError(which: 'imu' | 'gnss', err: Error): void {
    const dev = which === 'imu' ? this.imu : this.gnss
    dev.status = SerialStatus.Error
    this.emit(`${which}:status` as const, dev.status, dev.config, err.message)
    this.emit('error', which === 'imu' ? DeviceType.IMU : DeviceType.GNSS, err.message)
  }

  private onClose(which: 'imu' | 'gnss'): void {
    const dev = which === 'imu' ? this.imu : this.gnss
    dev.status = SerialStatus.Closed
    dev.port = undefined
    this.emit(`${which}:status` as const, dev.status)
  }
}
