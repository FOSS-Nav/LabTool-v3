# LabTool-V3

> 惯导实验室串口采数软件 V3 版本
> 基于 **Electron + React + TypeScript + Vite** 重构自 [LabTool-V2 (Qt)](../LabTool-V2/)

## 当前状态

**核心链路已闭环** —— 协议帧解析、双路串口、GNSS 解析、实时曲线、轨迹图、数据落盘全部可用。

```
✅ Electron 三进程（main / preload / renderer）
✅ React 18 + TypeScript 严格模式 + Vite 工具链
✅ 协议帧编辑器（10 种基础类型 / 字节序 / 标度因数 / 帧头/时间戳/校验）
✅ 显式位宽类型命名（int16 / int32 / uint8_t / uint16_t / float32 / float64）
✅ 协议帧状态机解码（流式 / 帧头自恢复 / 跨 chunk 粘包）
✅ 双路串口（IMU 字节流 + GNSS 文本行流），IMU 波特率最高 921600
✅ GNSS 解析（NMEA GPGGA/GPVTG / NovAtel BESTVEL/BESTPOS）
✅ GNSS 轨迹（WGS84 → 本地 E/N 投影，3600 点滑动窗口）
✅ 三联实时曲线（uPlot）
✅ GNSS 散点轨迹（Canvas 2D）
✅ 数据落盘：解析 .txt + 原始 .bin + GNSS 时间对齐
✅ 协议帧配置加载/保存（兼容 V2 CSV 格式 + V2 旧类型名 short/int/float/double 自动回退）
✅ 标度因数默认 9999.99 严格判定（不再误乘 uint8 等无意义标度）
✅ 串口 LED 状态、状态栏、错误提示、帮助对话框
✅ V2 暗色风格 + 现代布局
✅ Zustand 全局 store
✅ 顶部 HeaderBar：主题切换（浅色/深色/跟随系统）
✅ 多语言（简体中文 / 繁體中文 / English）
✅ HelpDialog 新增"反馈与交流"Tab（含 V3/V2 仓库、邮箱、知乎、官网）
✅ localStorage 持久化主题+语言
✅ 串口助手（AssistantPanel）：第三个独立串口，原始字节透传，HEX/ASCII 双模显示与发送，波特率最高 921600
⬜ 串口原生模块编译（需手动跑 electron-rebuild）
⬜ 仪表盘（V2 中已注释，未迁移）
⬜ 自动 .lastConfig.txt 持久化（V2 中存 Config 目录）
```

## 开发环境

- Node.js ≥ 20
- npm ≥ 10
- Windows 10/11（macOS / Linux 理论支持，未实测）

## 快速开始

### Windows 用户（推荐）

```cmd
run.bat               :: 中文主菜单（适合不熟悉命令行的用户）
start.bat             :: 一键安装 + 启动开发模式
dev.bat               :: 快速启动开发模式（依赖已装时）
build.bat             :: 构建生产包（带交互选择 portable/nsis，全英文界面）
install-deps.bat      :: 仅安装依赖 + 重建 serialport 原生模块
test-parser.bat       :: 运行解析器单元测试
```

> ⚠️ **build.bat 是全英文界面**：批处理文件对 UTF-8 中文极不友好——即使脚本内调用了 `chcp 65001`，cmd.exe 仍会按系统默认 codepage（中文 Windows = GBK/CP936）读 BAT 文件，导致中文乱码并破坏 `if ()` 块配对，产生"不是内部或外部命令"报错。改用英文后双击和命令行均稳定。

**首次使用**：双击 `start.bat`，脚本会自动：
1. 检测 Node.js / npm / MSVC / Python
2. 写入 `.npmrc`（使用 npmmirror 国内镜像）
3. `npm install --ignore-scripts` 安装依赖
4. `npx electron-rebuild -f -w serialport` 编译串口原生模块
5. 类型检查
6. 启动 `npm run dev`（HMR 热重载）

### 命令行用户

```bash
# 1. 安装依赖（首次约 250MB；含 Electron 二进制 + uplot + zustand + serialport）
npm install --ignore-scripts          # 跳过 postinstall（沙箱友好）
npx electron-rebuild -f -w serialport  # 本地开发：编译 serialport 原生模块

# 2. 启动开发模式
npm run dev

# 3. 类型检查
npm run typecheck

# 4. 解析器单元手测（可选，需 tsx）
npx tsx tests/parser.test.ts

# 5. 构建 + 打包
npm run pack                # 同时打 portable + nsis
```

> ⚠️ **serialport 原生模块**：Windows 上需要 Visual Studio Build Tools + Python。
> 安装后用 `npx electron-rebuild -f -w serialport` 编译。本项目仓库默认包含预编译的二进制；如果是首次安装，请在本地执行 rebuild。

## 目录结构

```
LabTool-V3/
├── package.json
├── electron.vite.config.ts        # 三进程构建配置
├── electron-builder.yml           # 打包配置
├── tsconfig.json / node.json / web.json
├── src/
│   ├── main/                      # ★ 主进程（Node）
│   │   ├── index.ts               # 窗口 + IPC 注册 + 生命周期
│   │   ├── ipc/channels.ts        # IPC 通道常量
│   │   ├── serial/manager.ts      # 双路串口管理（IMU 字节流 + GNSS 行流）
│   │   ├── recorder/recorder.ts   # 解析 .txt + 原始 .bin 落盘
│   │   └── runtime/scheduler.ts   # 10ms 调度（接 SerialManager → 渲染端）
│   │
│   ├── preload/                   # ★ 安全桥
│   │   ├── index.ts               # contextBridge.exposeInMainWorld('labtool', ...)
│   │   └── types.ts               # 跨进程类型（被 main/preload/renderer 共用）
│   │
│   ├── renderer/                  # ★ React 渲染进程
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx           # React 入口
│   │       ├── App.tsx            # 主壳（Header + ToolBox + StatusBar）
│   │       ├── styles.css         # 全局 + V2 暗色主题
│   │       ├── store/index.ts     # Zustand 全局 store
│   │       ├── hooks/useRuntimeEvents.ts   # IPC 事件 → store
│   │       └── components/
│   │           ├── ToolBox/       # 左侧 Tab 切换
│   │           ├── FrameEditor/   # 协议帧表格 + 编译 + 加载/保存
│   │           ├── SerialPortPanel/  # IMU 串口配置
│   │           ├── GnssPortPanel/    # GNSS 串口配置
│   │           ├── DataDisplay/   # 实时字段值
│   │           ├── GnssDisplay/   # 8 个 LCD 数字
│   │           ├── CurvePlot/     # 三联曲线（uPlot）
│   │           ├── GnssTracePlot/ # 轨迹散点（Canvas 2D）
│   │           ├── StatusBar/     # 时钟/帧数/录制
│   │           └── HelpDialog/    # 关于/使用/历史
│   │
│   └── shared/                    # ★ 纯 TS，三进程共享
│       ├── index.ts               # barrel
│       ├── types.ts               # DataKind/Endian/FrameDescriptor/...
│       ├── parser/
│       │   ├── datatype.ts        # 10 种基础类型 + 字节序读写
│       │   ├── frame.ts           # 编译描述符 + 帧解码状态机
│       │   └── frame-config.ts    # V2 CSV 配置加载/保存
│       └── gnss/
│           ├── parser.ts          # NMEA / NovAtel
│           └── trace.ts           # WGS84 → local E/N
│
├── tests/parser.test.ts           # 纯 TS 解析器手测（12 用例）
├── build/icon.png                 # 应用图标
└── out/                           # electron-vite 中间产物（gitignore）
```

## 与 V2 的对应关系

| V2 文件 | V3 模块 | 备注 |
|---------|---------|------|
| `mydatatype.cpp/h` union 解析 | `shared/parser/datatype.ts` | 用 `DataView` 替代 union，10 种类型完整迁移 |
| `mainwindow.cpp` 帧表 + 编译 | `shared/parser/frame.ts` + `components/FrameEditor/` | compileDescriptor = V2 on_confirmDataFrame_btn |
| `mainwindow.cpp` 表格刷新 | `components/DataDisplay/` | store 中 tableValues 每帧更新 |
| `mainwindow.cpp` 任务调度 10ms | `main/runtime/scheduler.ts` | setInterval 替代 QTimer |
| `mainwindow.cpp` 文件保存 | `main/recorder/recorder.ts` | txt + bin + GNSS 时间对齐 |
| `mySerialPort/myserialport.cpp` | `main/serial/manager.ts` | 一份类管理 IMU/GNSS 双路 |
| `gnss_parse.cpp/h` | `shared/gnss/parser.ts` | 纯函数 + mergeGnssVec8 |
| `mainwindow.cpp` 轨迹图 | `components/GnssTracePlot/` | Canvas 2D 替代 QCustomPlot |
| `myPlot/mycurveplot.cpp` 三联曲线 | `components/CurvePlot/` | uPlot 替代 QCustomPlot (10×快) |
| `mainwindow.cpp` LED/状态栏 | `App.tsx` header + `StatusBar` | 仿 V2 视觉 |
| `Help/help.cpp` 关于对话框 | `components/HelpDialog/` | 内嵌 React，无新窗口 |
| `myTableWidget/mycomboxdelegate` | `<select>` | 直接用原生 HTML |
| `mydashboard.cpp/h/.ui` | **未迁移** | V2 中已注释掉，与 QUC 控件解耦 |

## 架构图

```
┌─────────────────── Renderer (React + Zustand) ───────────────────┐
│  App                                                              │
│  ├── Header (IMU/GNSS LED)                                        │
│  ├── ToolBox (Tab 切换)                                           │
│  │   ├── FrameEditor ──┐                                          │
│  │   ├── SerialPort   │                                          │
│  │   ├── GnssPort     │                                          │
│  │   ├── DataDisplay  │                                          │
│  │   ├── CurvePlot    │                                          │
│  │   └── TracePlot    │                                          │
│  └── StatusBar                                                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │ window.labtool.* (typed)
                           ▼
┌─────────────────── Preload (typed IPC) ──────────────────────────┐
│  LabtoolAPI (contextBridge)                                       │
└──────────────────────────┬───────────────────────────────────────┘
                           │ ipcRenderer.invoke / on
                           ▼
┌─────────────────── Main (Node) ───────────────────────────────────┐
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ SerialMgr   │  │ Recorder    │  │ Scheduler   │              │
│  │ (IMU + GNSS)│  │ (.txt+.bin) │  │ (10ms tick) │              │
│  └─────┬───────┘  └─────▲───────┘  └─────▲───────┘              │
│        │ push frames     │                │                      │
│        │ + gnss merged   │ writeImuBatch  │ send FrameParsed     │
│        └────────────┬────┴────────────────┘                      │
│                     ▼                                              │
│              WebContents.send → 渲染端                            │
└──────────────────────────────────────────────────────────────────┘
```

## 设计取舍

### 为什么用 uPlot 而非 Chart.js / Recharts
V2 用 QCustomPlot，绘制 3 个实时波形（每秒刷新 100 帧 × 6 条曲线）。
Chart.js/Recharts 基于 SVG，10× 慢。uPlot 基于 Canvas，性能对标 QCustomPlot。

### 为什么用 Zustand 而非 Redux/Context
V2 主窗口是一个"上帝类"，所有状态塞在 MainWindow 里。
V3 拆为多个 slice（FrameSlice / SerialSlice / DataSlice），但只用一个 store。
Zustand 的 selector 模型避免不必要重渲，比 Redux 样板代码少一个数量级。

### 为什么 IPC 用 contextBridge
V2 的 QSerialPort 在主线程，UI 在主线程，跨线程用 signal/slot。
V3 的安全模型要求 preload 隔离，因此设计为：
  - 渲染端 → main：`invoke` (Promise)
  - main → 渲染端：`webContents.send` + 事件名

## 更新日志

### v3.0.x（最新）

#### 串口助手 & IMU 串口 —— 新增 614400 波特率
- `SerialPortPanel`（"串口"，IMU 端口）波特率下拉新增 **`614400`**，现可选范围：`9600 / 19200 / 38400 / 57600 / 115200 / 230400 / 460800 / 614400 / 921600`
- `AssistantPanel`（"串口助手"）波特率下拉同步新增 **`614400`**，现可选范围：`1200 / 2400 / 4800 / 9600 / 19200 / 38400 / 57600 / 115200 / 230400 / 460800 / 614400 / 921600`
- `GnssPortPanel`（"GNSS"）**未改动** —— 主流 GNSS 接收机最高仍按 115200 配置

#### 数据类型命名统一为 `{类型}{位宽}`
旧写法 `short` / `int` / `float` / `double` 在 C 语言中位宽因平台而异（`short` 通常 16 位但 C 标准仅保证 ≥16；`int` 可能是 16/32/64 位；`float` 通常 32 位、`double` 通常 64 位但不一定），命名有歧义。改为显式位宽后，协议帧编辑器、CSV 序列化、解析入口三处完全统一：

| `DataKind` | 旧名称 | 新名称 |
|------------|--------|--------|
| `Int16`    | `short` | **`int16`**   |
| `Int32`    | `int`   | **`int32`**   |
| `Float32`  | `float` | **`float32`** |
| `Float64`  | `double`| **`float64`** |

- **写入侧**（`frame-config.ts` `dataKindName()` + `types.ts` `DataTypeName`）：只写新名字
- **读取侧**（`types.ts` `dataKindFromName()`）：新名字优先；遇到 V2 老 `.txt`/`.csv` 配置里的 `short`/`int`/`float`/`double` 自动回退到对应 `DataKind`，**不会**被误降级为 `uint8`

#### 修复 uint8 字段值出现 > 256 的 Bug
- 现象：协议帧里某个 `uint8` 字段解析出来的值远大于 256（例如 0xFF → ~2550000）
- 根因：`frame.ts` 中标度因数默认值为 `SCALE_NONE = 9999.99`，原代码用 `<=` 比较，等号命中时把默认标度当成真实标度参与运算：`rawValue = rawVal * 9999.99`，0–255 被放大到 0–~2.55M。**所有数据类型都受影响**，uint8 只是最显眼的那个
- 修复：`<=` → **`<`**（严格小于），与 V2 "scale > 9999.99 表示不使用" 的语义一致
- 行为变化：scale 默认值（9999.99）下不再做乘法，输出即原始字节值；与"协议帧编辑器"中没勾选"应用标度因数"时的行为一致

## 下一步计划

- [ ] 串口原生模块自动化编译（npm scripts）
- [ ] 自动保存 `.lastConfig.txt` 到 `app.getPath('userData')`
- [ ] 录制中实时显示字节/行数（从主进程回传进度）
- [ ] 协议帧 .csv 格式校验（导入时给出列错位提示）
- [ ] IMU 帧丢失/错误率统计
- [ ] 单测：FrameDecoder / GNSS parser / Recorder

## 已知限制

1. **沙箱构建**：当前 sandbox 环境阻止 `esbuild` / `node-gyp` 启动子进程，因此 `npm run build` 在 sandbox 内失败。
   在本地开发机上正常。
2. **serialport 重编译**：首次 `npm install` 时本项目默认 `--ignore-scripts` 跳过原生编译，
   在 Windows 上需手动执行 `npx electron-rebuild -f -w serialport`。
3. **uPlot 主题**：uPlot 默认浅色，已在 styles.css 中覆盖为深色。

## 主题与多语言

### 主题
- **浅色 / 深色 / 跟随系统** —— 顶部 HeaderBar 切换
- 实现：`data-theme="light|dark|system"` + `data-resolved-theme` 驱动 CSS 变量
- `prefers-color-scheme` 媒体查询监听系统切换
- 持久化到 `localStorage['labtool-v3-ui']`

### 多语言
- **简体中文 (zh-CN) / 繁體中文 (zh-TW) / English (en-US)** —— 顶部 HeaderBar 切换
- 翻译集中在 `src/renderer/src/i18n/index.ts`（约 130 条 key × 3 语言）
- 用法：`const t = useT(); <button>{t('frame.confirm')}</button>`
- 字符串插值：`t('help.about.intro', { tech: '...' })`
- 持久化到 `localStorage`

## 许可证

GPL-3.0
