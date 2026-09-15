/**
 * LabTool-V3 主进程入口
 *
 * 启动顺序：
 *   1. 窗口创建
 *   2. 注册 IPC 处理器（与 SerialManager / Recorder / FrameConfig 联动）
 *   3. 启动 10ms 调度器
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  DeviceType,
  FrameDescriptor,
  GnssMeasType,
  GnssPosMsg,
  GnssVelMsg,
  IpcChannel,
  SerialConfig,
  SerialStatus
} from '../shared'
import { SerialManager } from './serial/manager'
import { Recorder } from './recorder/recorder'
import { TaskScheduler } from './runtime/scheduler'
import {
  CH,
  AssistantEvent,
  DataEvent,
  FrameInvoke,
  GnssInvoke,
  LogEvent,
  RecorderInvoke,
  SerialEvent,
  SerialInvoke
} from './ipc/channels'

let mainWindow: BrowserWindow | null = null
const manager = new SerialManager()
const recorder = new Recorder()
const scheduler = new TaskScheduler({
  manager,
  recorder,
  getWindow: () => mainWindow
})

/* ============================================================
 * 串口事件 → 渲染端
 * ============================================================ */
manager.on('imu:status', (status, config, error) => {
  mainWindow?.webContents.send(SerialEvent.StatusChanged, {
    device: DeviceType.IMU,
    status,
    config,
    error
  })
})
manager.on('gnss:status', (status, config, error) => {
  mainWindow?.webContents.send(SerialEvent.StatusChanged, {
    device: DeviceType.GNSS,
    status,
    config,
    error
  })
})
manager.on('imu:frames', (frames) => {
  scheduler.pushImuFrames(frames)
  // 落盘：每个解析后的 IMU 帧写一行到 IMU_GNSS.bin
  for (const f of frames) recorder.writeImuFrame(f)
})
manager.on('imu:raw', (buf) => {
  // 落盘：原始字节直接写 IMU_HEX.bin
  recorder.writeImuRawBytes(buf)
})
manager.on('gnss:merged', (vec, raw, east, north) => {
  // 把原始报文行也透传给 scheduler，用于数据表 lastPos/lastVel 详细字段提取
  scheduler.pushGnssMerged(vec, raw, east, north)
  // 落盘：更新最新的 GNSS 合并向量，供下次 IMU 帧同步时使用
  recorder.updateLastGnss(vec)
})
manager.on('gnss:raw', (line) => {
  recorder.writeGnssText(line)
  mainWindow?.webContents.send(DataEvent.GnssRaw, { line })
})
manager.on('assistant:status', (status, config, error) => {
  mainWindow?.webContents.send(AssistantEvent.Status, { status, config, error })
})
manager.on('assistant:data', (buf) => {
  // AssistantDataPayload = { data: number[]; ts: number }
  // 把 Buffer 转成普通 number[]，Electron IPC 才能安全跨进程传递
  const data = new Array<number>(buf.length)
  for (let i = 0; i < buf.length; i++) data[i] = buf[i]
  mainWindow?.webContents.send(AssistantEvent.Data, { data, ts: Date.now() })
})
manager.on('error', (device, message) => {
  mainWindow?.webContents.send(LogEvent.AppError, { device, message })
})

/* ============================================================
 * IPC 处理器
 * ============================================================ */
function registerIpc(): void {
  // 1) 列出可用串口
  ipcMain.handle(SerialInvoke.ListPorts, async () => {
    return SerialManager.listPorts()
  })

  // 2) 打开 IMU
  ipcMain.handle(
    SerialInvoke.OpenIMU,
    async (_evt, args: { config: SerialConfig; desc: FrameDescriptor }) => {
      try {
        await manager.openIMU(args.config, args.desc)
        scheduler.start()
        return { ok: true }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )

  // 3) 打开 GNSS
  ipcMain.handle(SerialInvoke.OpenGNSS, async (_evt, args: { config: SerialConfig }) => {
    try {
      await manager.openGNSS(args.config)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // 4) 关闭 IMU / GNSS
  ipcMain.handle(SerialInvoke.CloseIMU, async () => {
    await manager.closeIMU()
    return { ok: true }
  })
  ipcMain.handle(SerialInvoke.CloseGNSS, async () => {
    await manager.closeGNSS()
    return { ok: true }
  })

  // 5) 切换协议帧描述
  ipcMain.handle(FrameInvoke.SetDescriptor, async (_evt, args: { desc: FrameDescriptor }) => {
    manager.setIMUDescriptor(args.desc)
    return { ok: true }
  })

  // 6) 切换 GNSS 量测类型 / 位置报文 / 速度报文
  ipcMain.handle(GnssInvoke.SetMeasType, async (_evt, args: { meas: GnssMeasType }) => {
    manager.setGnssMeasType(args.meas)
    return { ok: true }
  })
  ipcMain.handle(GnssInvoke.SetPosMsg, async (_evt, args: { m: GnssPosMsg }) => {
    manager.setGnssPosMsg(args.m)
    return { ok: true }
  })
  ipcMain.handle(GnssInvoke.SetVelMsg, async (_evt, args: { m: GnssVelMsg }) => {
    manager.setGnssVelMsg(args.m)
    return { ok: true }
  })

  // 7) 开始/停止落盘
  ipcMain.handle(
    RecorderInvoke.Start,
    async (
      _evt,
      args: {
        baseName: string
        outDir: string
        enableGnss: boolean
        imuChannelBytes: 4 | 8
        imuFieldCount: number
        imuFieldNames: string[]
      }
    ) => {
      try {
        recorder.start({
          baseName: args.baseName,
          outDir: args.outDir,
          enableGnss: args.enableGnss,
          imuChannelBytes: args.imuChannelBytes,
          imuFieldCount: args.imuFieldCount,
          imuFieldNames: args.imuFieldNames,
          hasGnss: args.enableGnss
        })
        return { ok: true, state: recorder.state() }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )
  ipcMain.handle(RecorderInvoke.Stop, async () => {
    recorder.stop()
    return { ok: true }
  })
  ipcMain.handle(RecorderInvoke.GetState, async () => recorder.state())

  // 8) 串口助手（独立通道：原始字节透传）
  ipcMain.handle(SerialInvoke.OpenAssistant, async (_evt, args: { config: SerialConfig }) => {
    try {
      await manager.openAssistant(args.config)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
  ipcMain.handle(SerialInvoke.CloseAssistant, async () => {
    await manager.closeAssistant()
    return { ok: true }
  })
  ipcMain.handle(SerialInvoke.WriteAssistant, async (_evt, args: { data: string }) => {
    // data 是 hex 字符串（无空格）或文本（待实现：mode 字段）
    const hex = args.data.trim()
    if (!hex) return { ok: false, error: 'empty data' }
    let buf: Buffer
    if (/^[\dA-Fa-f\s]+$/.test(hex) && hex.replace(/\s/g, '').length % 2 === 0) {
      // 当作 hex 解析
      try {
        buf = Buffer.from(hex.replace(/\s/g, ''), 'hex')
      } catch (e) {
        return { ok: false, error: 'hex parse failed' }
      }
    } else {
      buf = Buffer.from(hex, 'utf8')
    }
    const n = manager.writeAssistant(buf)
    return { ok: true, written: n }
  })
  ipcMain.handle(SerialInvoke.GetAssistantState, async () => manager.getAssistantState())

  // 8) 协议帧配置加载/保存
  ipcMain.handle(FrameInvoke.SaveConfig, async (_evt, args: { content: string }) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!win) return { ok: false, error: 'no window' }
    const r = await dialog.showSaveDialog(win, {
      title: '保存协议帧配置',
      defaultPath: 'frameConfig.txt',
      filters: [{ name: '文本', extensions: ['txt'] }]
    })
    if (r.canceled || !r.filePath) return { ok: false, canceled: true }
    await fs.writeFile(r.filePath, args.content, 'utf8')
    return { ok: true, path: r.filePath }
  })

  ipcMain.handle(FrameInvoke.LoadConfig, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!win) return { ok: false, error: 'no window' }
    const r = await dialog.showOpenDialog(win, {
      title: '加载协议帧配置',
      filters: [{ name: '文本', extensions: ['txt'] }],
      properties: ['openFile']
    })
    if (r.canceled || r.filePaths.length === 0) return { ok: false, canceled: true }
    const content = await fs.readFile(r.filePaths[0], 'utf8')
    return { ok: true, content, path: r.filePaths[0] }
  })

  // 9) 通用日志桥（落盘调试 / 应用错误）
  ipcMain.on(LogEvent.Recorder, (_evt, payload) => {
    // 这里只 console；渲染端主要靠 console 输出
    console.log('[recorder]', payload)
  })
}

/* ============================================================
 * 窗口
 * ============================================================ */
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'LabTool-V3',
    backgroundColor: '#1a1d24',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/* ============================================================
 * 生命周期
 * ============================================================ */
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.labtool.v3')
  app.on('browser-window-created', (_e, w) => optimizer.watchWindowShortcuts(w))
  registerIpc()
  mainWindow = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('before-quit', async () => {
  scheduler.stop()
  await manager.shutdown()
  recorder.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
