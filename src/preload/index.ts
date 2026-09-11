/**
 * LabTool-V3 预加载脚本
 *
 * 暴露一个类型安全的 window.labtool 给渲染端。
 * 所有方法都是 IPC 调用的薄包装，调用返回 Promise。
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import {
  GnssMeasType,
  FrameDescriptor,
  SerialConfig
} from '../shared'
import {
  CH,
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
  startRecorder(txtPath: string, fieldNames: string[], alignGnss: boolean): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(RecorderInvoke.Start, { txtPath, fieldNames, alignGnss })
  },
  stopRecorder(): Promise<{ ok: boolean; state: RecorderStatePayload }> {
    return ipcRenderer.invoke(RecorderInvoke.Stop)
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
