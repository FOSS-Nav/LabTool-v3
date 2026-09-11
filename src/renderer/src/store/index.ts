/**
 * LabTool-V3 渲染端 Zustand 全局 Store
 *
 * 设计为单一 store，避免多 store 互相 import 的耦合；
 * 按域划分 selector，组件用 useStore(s => s.xxx) 订阅。
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import {
  DataKind,
  Endian,
  FieldRole,
  FrameField,
  ParsedFrame,
  GnssVec8,
  SerialConfig,
  SerialStatus
} from '@shared'
import { DeviceType } from '@shared'
import type { Locale } from '../i18n'

/* ============================================================
 * UI 配置：主题 + 语言
 * 持久化到 localStorage（key: labtool-v3-ui）
 * ============================================================ */

export type ThemeMode = 'light' | 'dark' | 'system'

interface UISlice {
  theme: ThemeMode
  locale: Locale
  /** 由 system 模式解析后的实际生效主题 */
  resolvedTheme: 'light' | 'dark'

  setTheme(m: ThemeMode): void
  setLocale(l: Locale): void
}

const STORAGE_KEY = 'labtool-v3-ui'

interface UIPersisted {
  theme?: ThemeMode
  locale?: Locale
}

function loadPersisted(): UIPersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as UIPersisted
  } catch {
    return {}
  }
}

function savePersisted(s: { theme: ThemeMode; locale: Locale }): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: s.theme, locale: s.locale })
    )
  } catch {
    /* ignore */
  }
}

/* ============================================================
 * 协议帧编辑器
 * ============================================================ */
interface FrameSlice {
  fields: FrameField[]
  endian: Endian
  /** 编辑模式：true=可编辑表格；false=已确认，按当前字段解析 */
  confirmed: boolean

  load(fields: FrameField[], endian: Endian): void
  setEndian(e: Endian): void

  addRow(role?: FieldRole): void
  insertRow(at: number, role?: FieldRole): void
  deleteRow(at: number): void
  updateField(id: string, patch: Partial<FrameField>): void
  setPlotFlag(id: string, slot: 1 | 2 | 3, value: boolean): void

  confirm(): FrameField[]
  toggleConfirm(): void

  /** 加载 V2 风格 CSV 文本（由 preload 提供） */
  parseFromCsv(text: string): void
  /** 序列化为 V2 风格 CSV 文本（用于保存） */
  toCsv(): string
}

const seedFields = (): FrameField[] => [
  {
    id: nanoid(8),
    name: 'Frame_Header',
    type: DataKind.Uint8,
    defaultValue: '0xEB',
    scale: 9999.99,
    role: 'Frame_Header',
    isPlot1: false,
    isPlot2: false,
    isPlot3: false
  },
  {
    id: nanoid(8),
    name: 'Frame_Header',
    type: DataKind.Uint8,
    defaultValue: '0x90',
    scale: 9999.99,
    role: 'Frame_Header',
    isPlot1: false,
    isPlot2: false,
    isPlot3: false
  },
  {
    id: nanoid(8),
    name: 'Time_Stamp',
    type: DataKind.Uint32,
    defaultValue: '0',
    scale: 9999.99,
    role: 'Time_Stamp',
    isPlot1: false,
    isPlot2: false,
    isPlot3: false
  },
  {
    id: nanoid(8),
    name: 'data1',
    type: DataKind.Float32,
    defaultValue: '0',
    scale: 9999.99,
    role: 'Data',
    isPlot1: false,
    isPlot2: false,
    isPlot3: false
  },
  {
    id: nanoid(8),
    name: 'Check_Sum',
    type: DataKind.Uint8,
    defaultValue: '0',
    scale: 9999.99,
    role: 'Check_Sum',
    isPlot1: false,
    isPlot2: false,
    isPlot3: false
  }
]

/* ============================================================
 * 串口配置
 * ============================================================ */
interface SerialSlice {
  imu: {
    status: SerialStatus
    config?: SerialConfig
    availablePorts: string[]
    error?: string
  }
  gnss: {
    status: SerialStatus
    config?: SerialConfig
    active: boolean
    measType: number
    error?: string
  }

  setAvailablePorts(ports: string[]): void
  setImuConfig(cfg: SerialConfig): void
  setImuStatus(s: SerialStatus, error?: string): void
  setGnssConfig(cfg: SerialConfig): void
  setGnssStatus(s: SerialStatus, error?: string): void
  setGnssActive(on: boolean): void
  setGnssMeasType(t: number): void
}

/* ============================================================
 * 数据缓存
 * ============================================================ */
interface DataSlice {
  /** 最近 N 帧的解析结果（环形缓冲） */
  recentFrames: ParsedFrame[]
  /** 表格显示用：最后一帧的字段值 */
  tableValues: Record<string, number | string>
  /** 帧计数器 */
  frameCounter: number

  /** GNSS 最新值 */
  lastGnss: GnssVec8 | null
  /** GNSS 轨迹本地投影 */
  gnssTrace: { east: number; north: number }[]

  /** 落盘 */
  recording: boolean
  recInfo: { txtPath?: string; binPath?: string; bytes: number; lines: number }
  setRecording(on: boolean, info?: { txtPath?: string; binPath?: string }): void
  updateRecInfo(p: Partial<{ bytes: number; lines: number }>): void

  pushFrames(frames: ParsedFrame[]): void
  pushGnss(vec: GnssVec8): void
  pushGnssTrace(p: { east: number; north: number }): void
}

/* ============================================================
 * 聚合
 * ============================================================ */
export type Store = FrameSlice & SerialSlice & DataSlice & UISlice

const RECENT_MAX = 256
const TRACE_MAX = 3600

const initialSerial: SerialSlice = {
  imu: { status: SerialStatus.Closed, availablePorts: [] },
  gnss: { status: SerialStatus.Closed, active: false, measType: 1 },
  setAvailablePorts: () => {},
  setImuConfig: () => {},
  setImuStatus: () => {},
  setGnssConfig: () => {},
  setGnssStatus: () => {},
  setGnssActive: () => {},
  setGnssMeasType: () => {}
}

const initialData: DataSlice = {
  recentFrames: [],
  tableValues: {},
  frameCounter: 0,
  lastGnss: null,
  gnssTrace: [],
  recording: false,
  recInfo: { bytes: 0, lines: 0 },
  setRecording: () => {},
  updateRecInfo: () => {},
  pushFrames: () => {},
  pushGnss: () => {},
  pushGnssTrace: () => {}
}

import { compileDescriptor, listPlottable, parseFrameConfigCsv, serializeFrameConfigCsv } from '@shared'

export const useStore = create<Store>()(
  subscribeWithSelector((set, get) => ({
    /* ---------------- FrameSlice ---------------- */
    fields: seedFields(),
    endian: Endian.Little,
    confirmed: false,

    load: (fields, endian) => set({ fields, endian, confirmed: false }),
    setEndian: (e) => set({ endian: e }),

    addRow: (role = 'Data') =>
      set((s) => ({
        fields: [
          ...s.fields,
          {
            id: nanoid(8),
            name: role === 'Data' ? 'data' + (s.fields.length + 1) : role,
            type: role === 'Data' ? DataKind.Float32 : role === 'Time_Stamp' ? DataKind.Uint32 : DataKind.Uint8,
            defaultValue: '0',
            scale: 9999.99,
            role,
            isPlot1: false,
            isPlot2: false,
            isPlot3: false
          }
        ]
      })),

    insertRow: (at, role = 'Data') =>
      set((s) => {
        const next = [...s.fields]
        next.splice(at, 0, {
          id: nanoid(8),
          name: role === 'Data' ? 'data' + (s.fields.length + 1) : role,
          type: role === 'Data' ? DataKind.Float32 : role === 'Time_Stamp' ? DataKind.Uint32 : DataKind.Uint8,
          defaultValue: '0',
          scale: 9999.99,
          role,
          isPlot1: false,
          isPlot2: false,
          isPlot3: false
        })
        return { fields: next }
      }),

    deleteRow: (at) =>
      set((s) => ({ fields: s.fields.filter((_, i) => i !== at) })),

    updateField: (id, patch) =>
      set((s) => ({
        fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f))
      })),

    setPlotFlag: (id, slot, value) =>
      set((s) => {
        const k = (`isPlot${slot}` as const) as 'isPlot1' | 'isPlot2' | 'isPlot3'
        return {
          fields: s.fields.map((f) => (f.id === id ? { ...f, [k]: value } : f))
        }
      }),

    confirm: () => {
      // 实际编译工作留给渲染层调用 compileDescriptor；这里只是 UI 状态翻转
      set({ confirmed: true })
      return get().fields
    },

    toggleConfirm: () => set((s) => ({ confirmed: !s.confirmed })),

    parseFromCsv: (text) => {
      const fields = parseFrameConfigCsv(text)
      const m = /^#\s*endian\s*=\s*(little|big)/im.exec(text)
      const endian = m && m[1] === 'big' ? Endian.Big : Endian.Little
      set({ fields, endian, confirmed: false })
    },

    toCsv: () => serializeFrameConfigCsv(get().fields, get().endian),

    /* ---------------- SerialSlice ---------------- */
    ...initialSerial,
    setAvailablePorts: (ports) =>
      set((s) => ({ imu: { ...s.imu, availablePorts: ports } })),
    setImuConfig: (cfg) =>
      set((s) => ({ imu: { ...s.imu, config: cfg } })),
    setImuStatus: (status, error) =>
      set((s) => ({ imu: { ...s.imu, status, error } })),
    setGnssConfig: (cfg) =>
      set((s) => ({ gnss: { ...s.gnss, config: cfg } })),
    setGnssStatus: (status, error) =>
      set((s) => ({ gnss: { ...s.gnss, status, error } })),
    setGnssActive: (on) =>
      set((s) => ({ gnss: { ...s.gnss, active: on } })),
    setGnssMeasType: (t) =>
      set((s) => ({ gnss: { ...s.gnss, measType: t } })),

    /* ---------------- DataSlice ---------------- */
    ...initialData,
    setRecording: (on, info) =>
      set((s) => ({
        recording: on,
        recInfo: {
          txtPath: info?.txtPath ?? s.recInfo.txtPath,
          binPath: info?.binPath ?? s.recInfo.binPath,
          bytes: on ? 0 : s.recInfo.bytes,
          lines: on ? 0 : s.recInfo.lines
        }
      })),
    updateRecInfo: (p) => set((s) => ({ recInfo: { ...s.recInfo, ...p } })),

    pushFrames: (frames) =>
      set((s) => {
        if (frames.length === 0) return s
        const merged = s.recentFrames.concat(frames)
        const trimmed = merged.length > RECENT_MAX ? merged.slice(merged.length - RECENT_MAX) : merged
        const last = frames[frames.length - 1]
        const tableValues: Record<string, number | string> = {}
        for (const f of last.fields) tableValues[f.name] = f.value
        return {
          recentFrames: trimmed,
          frameCounter: last.frameIndex + 1,
          tableValues
        }
      }),

    pushGnss: (vec) => set({ lastGnss: vec }),
    pushGnssTrace: (p) =>
      set((s) => {
        const next = s.gnssTrace.length >= TRACE_MAX ? s.gnssTrace.slice(s.gnssTrace.length - TRACE_MAX + 1) : s.gnssTrace.slice()
        next.push(p)
        return { gnssTrace: next }
      }),

    /* ---------------- UISlice ---------------- */
    theme: (loadPersisted().theme ?? 'dark') as ThemeMode,
    locale: (loadPersisted().locale ?? 'zh-CN') as Locale,
    resolvedTheme: 'dark' as 'light' | 'dark',

    setTheme: (m) => {
      set({ theme: m })
      const s = useStore.getState()
      savePersisted({ theme: m, locale: s.locale })
      applyThemeToDOM(m, s.theme === 'system' ? s.resolvedTheme : resolveTheme(m))
    },
    setLocale: (l) => {
      set({ locale: l })
      const s = useStore.getState()
      savePersisted({ theme: s.theme, locale: l })
    }
  }))
)

/* ============================================================
 * 主题应用：操作 <html data-theme="...">
 * 跟随系统时监听 prefers-color-scheme
 * ============================================================ */

function resolveTheme(m: ThemeMode): 'light' | 'dark' {
  if (m === 'light' || m === 'dark') return m
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyThemeToDOM(mode: ThemeMode, resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  if (mode === 'system') {
    html.setAttribute('data-theme', 'system')
    html.setAttribute('data-resolved-theme', resolved)
  } else {
    html.setAttribute('data-theme', mode)
    html.setAttribute('data-resolved-theme', resolved)
  }
}

/** 在应用挂载时初始化主题，并响应系统主题变化 */
export function initTheme(): () => void {
  const apply = (): void => {
    const s = useStore.getState()
    const resolved = resolveTheme(s.theme)
    useStore.setState({ resolvedTheme: resolved })
    applyThemeToDOM(s.theme, resolved)
  }
  apply()

  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const onChange = (): void => {
    if (useStore.getState().theme === 'system') apply()
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/* ============================================================
 * Selector 工具
 * ============================================================ */
export const selectPlottable = (s: Store) =>
  listPlottable({
    fields: s.fields,
    endian: s.endian,
    derived: compileDescriptorSafe(s)
  })

function compileDescriptorSafe(s: Store) {
  try {
    return compileDescriptor(s.fields, s.endian).derived!
  } catch {
    return {
      frameLen: 0,
      headerLen: 0,
      dataTypeLen: 0,
      headerBytes: [],
      checksumPos: -1,
      timestampPos: -1
    }
  }
}
