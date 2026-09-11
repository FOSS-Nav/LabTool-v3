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
  IpcChannel,
  SerialConfig,
  SerialStatus
} from '../shared'
import { SerialManager } from './serial/manager'
import { Recorder } from './recorder/recorder'
import { TaskScheduler } from './runtime/scheduler'
import {
  CH,
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
manager.on('imu:frames', (frames) => scheduler.pushImuFrames(frames))
manager.on('gnss:merged', (vec) => scheduler.pushGnssMerged(vec, []))
manager.on('gnss:raw', (line) => {
  mainWindow?.webContents.send(DataEvent.GnssRaw, { line })
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

  // 6) 切换 GNSS 量测类型
  ipcMain.handle(GnssInvoke.SetMeasType, async (_evt, args: { meas: GnssMeasType }) => {
    manager.setGnssMeasType(args.meas)
    return { ok: true }
  })

  // 7) 开始/停止落盘
  ipcMain.handle(
    RecorderInvoke.Start,
    async (
      _evt,
      args: {
        txtPath: string
        fieldNames: string[]
        alignGnss: boolean
      }
    ) => {
      try {
        recorder.start({
          txtPath: args.txtPath,
          fieldNames: args.fieldNames,
          alignGnss: args.alignGnss
        })
        return { ok: true }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )
  ipcMain.handle(RecorderInvoke.Stop, async () => {
    recorder.stop()
    return { ok: true, state: recorder.state() }
  })

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
