/**
 * LabTool-V3 预加载脚本
 *
 * 暴露一个类型安全的 window.labtool 给渲染端。
 * 所有方法都是 IPC 调用的薄包装，调用返回 Promise。
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import {
  GnssMeasType,
  GnssPosMsg,
  GnssVelMsg,
  FrameDescriptor,
  SerialConfig
} from '../shared'
import {
  CH,
  AssistantEvent,
  DataEvent,
  FrameInvoke,
  GnssInvoke,
  LogEvent,
  RecorderInvoke,
  SerialEvent
} from '../main/ipc/channels'
import type {
  AppErrorPayload,
  FrameParsedPayload,
  GnssParsedPayload,
  LabtoolAPI,
  RecorderStatePayload,
  SerialStatusPayload
} from './types'
import './types'

const labtool: LabtoolAPI = {
  /* 串口 */
  listPorts(): Promise<string[]> {
    return ipcRenderer.invoke(CH.SerialListPorts)
  },
  openIMU(config: SerialConfig, desc: FrameDescriptor): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(`${CH.SerialOpen}:imu`, { config, desc })
  },
  openGNSS(config: SerialConfig): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(`${CH.SerialOpen}:gnss`, { config })
  },
  closeIMU(): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(`${CH.SerialClose}:imu`)
  },
  closeGNSS(): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(`${CH.SerialClose}:gnss`)
  },
  onSerialStatus(cb: (p: SerialStatusPayload) => void): () => void {
    const h = (_: IpcRendererEvent, p: SerialStatusPayload): void => cb(p)
    ipcRenderer.on(SerialEvent.StatusChanged, h)
    return () => ipcRenderer.off(SerialEvent.StatusChanged, h)
  },

  /* 协议帧 */
  setDescriptor(desc: FrameDescriptor): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(FrameInvoke.SetDescriptor, { desc })
  },
  loadConfig(): Promise<{ ok: boolean; content?: string; path?: string; canceled?: boolean; error?: string }> {
    return ipcRenderer.invoke(FrameInvoke.LoadConfig)
  },
  saveConfig(content: string): Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }> {
    return ipcRenderer.invoke(FrameInvoke.SaveConfig, { content })
  },

  /* GNSS */
  setGnssMeasType(meas: GnssMeasType): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(GnssInvoke.SetMeasType, { meas })
  },
  setGnssPosMsg(m: GnssPosMsg): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(GnssInvoke.SetPosMsg, { m })
  },
  setGnssVelMsg(m: GnssVelMsg): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(GnssInvoke.SetVelMsg, { m })
  },

  /* 数据事件 */
  onFrames(cb: (p: FrameParsedPayload) => void): () => void {
    const h = (_: IpcRendererEvent, p: FrameParsedPayload): void => cb(p)
    ipcRenderer.on(DataEvent.FrameParsed, h)
    return () => ipcRenderer.off(DataEvent.FrameParsed, h)
  },
  onGnss(cb: (p: GnssParsedPayload) => void): () => void {
    const h = (_: IpcRendererEvent, p: GnssParsedPayload): void => cb(p)
    ipcRenderer.on(DataEvent.GnssParsed, h)
    return () => ipcRenderer.off(DataEvent.GnssParsed, h)
  },
  onGnssRaw(cb: (p: { line: string }) => void): () => void {
    const h = (_: IpcRendererEvent, p: { line: string }): void => cb(p)
    ipcRenderer.on(DataEvent.GnssRaw, h)
    return () => ipcRenderer.off(DataEvent.GnssRaw, h)
  },

  /* 落盘 */
  startRecorder(args: {
    baseName: string
    outDir: string
    enableGnss: boolean
    imuChannelBytes: 4 | 8
    imuFieldCount: number
    imuFieldNames: string[]
  }): Promise<{ ok: boolean; state?: RecorderStatePayload; error?: string }> {
    return ipcRenderer.invoke(RecorderInvoke.Start, args)
  },
  stopRecorder(): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(RecorderInvoke.Stop)
  },
  getRecorderState(): Promise<RecorderStatePayload | null> {
    return ipcRenderer.invoke(RecorderInvoke.GetState)
  },

  /* 串口助手 */
  openAssistant(config: import('../shared').SerialConfig): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(CH.AssistantOpen, { config })
  },
  closeAssistant(): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(CH.AssistantClose)
  },
  writeAssistant(data: string): Promise<{ ok: boolean; written?: number; error?: string }> {
    return ipcRenderer.invoke(CH.AssistantWrite, { data })
  },
  getAssistantState(): Promise<{ status: import('../shared').SerialStatus; config?: import('../shared').SerialConfig }> {
    return ipcRenderer.invoke(CH.AssistantGetState)
  },
  onAssistantStatus(cb: (p: import('./types').AssistantStatusPayload) => void): () => void {
    const h = (_: IpcRendererEvent, p: import('./types').AssistantStatusPayload): void => cb(p)
    ipcRenderer.on(AssistantEvent.Status, h)
    return () => ipcRenderer.off(AssistantEvent.Status, h)
  },
  onAssistantData(cb: (p: import('./types').AssistantDataPayload) => void): () => void {
    const h = (_: IpcRendererEvent, p: import('./types').AssistantDataPayload): void => cb(p)
    ipcRenderer.on(AssistantEvent.Data, h)
    return () => ipcRenderer.off(AssistantEvent.Data, h)
  },

  /* 错误 */
  onError(cb: (p: AppErrorPayload) => void): () => void {
    const h = (_: IpcRendererEvent, p: AppErrorPayload): void => cb(p)
    ipcRenderer.on(LogEvent.AppError, h)
    return () => ipcRenderer.off(LogEvent.AppError, h)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('labtool', labtool)
  } catch (e) {
    console.error(e)
  }
} else {
  // @ts-ignore (fallback)
  window.labtool = labtool
}

export type { LabtoolAPI }
