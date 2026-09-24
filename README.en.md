# LabTool-V3

> INS Laboratory serial data acquisition software — V3
> Rebuilt on **Electron + React + TypeScript + Vite**, ported from [LabTool-V2 (Qt)](../LabTool-V2/)

> 🇨🇳 [简体中文 README](./README.md)  ·  🇬🇧 English (this file)

## Status

**Core pipeline is closed-loop** — frame parsing, dual serial ports, GNSS decoding, real-time curves, trajectory plot, and data recording are all functional.

```
✅ Electron three-process architecture (main / preload / renderer)
✅ React 18 + TypeScript strict mode + Vite toolchain
✅ Protocol frame editor (10 base types / endianness / scale factor / header/timestamp/checksum)
✅ Explicit bit-width type naming (int16 / int32 / uint8_t / uint16_t / float32 / float64)
✅ Frame state-machine decoder (streaming / header self-recovery / cross-chunk packet reassembly)
✅ Dual serial ports (IMU byte stream + GNSS line stream); IMU up to 921600 baud
✅ GNSS parsing (NMEA GPGGA/GPVTG / NovAtel BESTVEL/BESTPOS)
✅ GNSS trajectory (WGS84 → local E/N projection, 3600-point sliding window)
✅ Triple real-time curves (uPlot)
✅ GNSS scatter trajectory (Canvas 2D)
✅ Data recording: parsed .txt + raw .bin + GNSS time alignment
✅ Frame config load/save (V2 CSV compatible + V2 legacy type names short/int/float/double auto-fallback)
✅ Strict default-scale check (9999.99 no longer mis-applies to uint8 etc.)
✅ Port LED status, status bar, error toast, help dialog
✅ V2 dark style + modern layout
✅ Zustand global store
✅ HeaderBar: theme switching (light / dark / follow system)
✅ i18n (Simplified Chinese / Traditional Chinese / English)
✅ HelpDialog: new "Feedback & Contact" tab (V3/V2 repos, email, Zhihu, website)
✅ Theme + language persisted in localStorage
✅ Serial Assistant (AssistantPanel): third independent port, raw byte passthrough, HEX/ASCII dual-mode display & send, up to 921600 baud
⬜ Serial native module auto-build (manual electron-rebuild still required)
⬜ Dashboard (commented out in V2, not migrated)
⬜ Auto-save .lastConfig.txt (V2 stored under Config dir)
```

## Development Environment

- Node.js ≥ 20
- npm ≥ 10
- Windows 10/11 (macOS / Linux theoretically supported but untested)

## Quick Start

### Windows Users (recommended)

```cmd
run.bat               :: Chinese main menu (for users unfamiliar with CLI)
start.bat             :: One-shot install + start dev mode
dev.bat               :: Fast-start dev mode (when deps are already installed)
build.bat             :: Build production package (interactive: portable / nsis; English UI)
install-deps.bat      :: Install deps only + rebuild serialport native module
test-parser.bat       :: Run parser unit tests
```

> ⚠️ **build.bat uses an English UI on purpose**: Windows batch files are notoriously fragile with UTF-8 Chinese — even calling `chcp 65001` is not enough, because cmd.exe reads the BAT file using the system default codepage (Chinese Windows = GBK/CP936) before the first line runs, which mangles Chinese characters and breaks `if ()` block pairing, producing "is not recognized as an internal or external command" errors. Switching the menu to English makes double-click and command-line execution equally reliable.

**First run**: double-click `start.bat`. The script will automatically:
1. Detect Node.js / npm / MSVC / Python
2. Write `.npmrc` (using the npmmirror China mirror)
3. `npm install --ignore-scripts` to install deps
4. `npx electron-rebuild -f -w serialport` to build the serialport native module
5. Type-check
6. Launch `npm run dev` (HMR hot reload)

### Command-line Users

```bash
# 1. Install deps (≈250 MB on first run; includes Electron binary + uplot + zustand + serialport)
npm install --ignore-scripts          # skip postinstall (sandbox-friendly)
npx electron-rebuild -f -w serialport  # local dev: compile serialport native module

# 2. Start dev mode
npm run dev

# 3. Type-check
npm run typecheck

# 4. Parser manual unit tests (optional, requires tsx)
npx tsx tests/parser.test.ts

# 5. Build + package
npm run pack                # build both portable + nsis installers
```

> ⚠️ **serialport native module**: on Windows you need Visual Studio Build Tools + Python.
> After install, run `npx electron-rebuild -f -w serialport`. This repo ships prebuilt binaries by default; if it's your first install, please run rebuild locally.

## Directory Structure

```
LabTool-V3/
├── package.json
├── electron.vite.config.ts        # Three-process build config
├── electron-builder.yml           # Packaging config
├── tsconfig.json / node.json / web.json
├── src/
│   ├── main/                      # ★ Main process (Node)
│   │   ├── index.ts               # Window + IPC registration + lifecycle
│   │   ├── ipc/channels.ts        # IPC channel constants
│   │   ├── serial/manager.ts      # Dual serial manager (IMU byte stream + GNSS line stream)
│   │   ├── recorder/recorder.ts   # Parsed .txt + raw .bin writer
│   │   └── runtime/scheduler.ts   # 10ms scheduler (SerialManager → renderer)
│   │
│   ├── preload/                   # ★ Security bridge
│   │   ├── index.ts               # contextBridge.exposeInMainWorld('labtool', ...)
│   │   └── types.ts               # Cross-process types (shared by main/preload/renderer)
│   │
│   ├── renderer/                  # ★ React renderer process
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx           # React entry
│   │       ├── App.tsx            # Shell (Header + ToolBox + StatusBar)
│   │       ├── styles.css         # Global + V2 dark theme
│   │       ├── store/index.ts     # Zustand global store
│   │       ├── hooks/useRuntimeEvents.ts   # IPC events → store
│   │       └── components/
│   │           ├── ToolBox/       # Left-side tab switcher
│   │           ├── FrameEditor/   # Frame table + compile + load/save
│   │           ├── SerialPortPanel/  # IMU serial config
│   │           ├── GnssPortPanel/    # GNSS serial config
│   │           ├── AssistantPanel/   # Third serial (raw passthrough)
│   │           ├── DataDisplay/   # Live field values
│   │           ├── GnssDisplay/   # 8 LCD digits
│   │           ├── CurvePlot/     # Triple curves (uPlot)
│   │           ├── GnssTracePlot/ # Trajectory scatter (Canvas 2D)
│   │           ├── StatusBar/     # Clock / frame count / recording
│   │           └── HelpDialog/    # About / Usage / History
│   │
│   └── shared/                    # ★ Pure TS, shared by all three processes
│       ├── index.ts               # barrel
│       ├── types.ts               # DataKind / Endian / FrameDescriptor / ...
│       ├── parser/
│       │   ├── datatype.ts        # 10 base types + endianness read/write
│       │   ├── frame.ts           # Descriptor compile + frame decode state machine
│       │   └── frame-config.ts    # V2 CSV config load/save
│       └── gnss/
│           ├── parser.ts          # NMEA / NovAtel
│           └── trace.ts           # WGS84 → local E/N
│
├── tests/parser.test.ts           # Pure-TS parser manual tests (12 cases)
├── build/icon.png                 # App icon
└── out/                           # electron-vite intermediates (gitignored)
```

## Mapping to V2

| V2 file | V3 module | Notes |
|---------|-----------|-------|
| `mydatatype.cpp/h` union parser | `shared/parser/datatype.ts` | `DataView` replaces union; all 10 types migrated |
| `mainwindow.cpp` frame table + compile | `shared/parser/frame.ts` + `components/FrameEditor/` | compileDescriptor = V2 on_confirmDataFrame_btn |
| `mainwindow.cpp` table refresh | `components/DataDisplay/` | store's `tableValues` updated per frame |
| `mainwindow.cpp` 10ms task scheduler | `main/runtime/scheduler.ts` | `setInterval` replaces `QTimer` |
| `mainwindow.cpp` file saving | `main/recorder/recorder.ts` | txt + bin + GNSS time alignment |
| `mySerialPort/myserialport.cpp` | `main/serial/manager.ts` | One class manages IMU + GNSS dual ports |
| `gnss_parse.cpp/h` | `shared/gnss/parser.ts` | Pure functions + `mergeGnssVec8` |
| `mainwindow.cpp` trajectory plot | `components/GnssTracePlot/` | Canvas 2D replaces QCustomPlot |
| `myPlot/mycurveplot.cpp` triple curves | `components/CurvePlot/` | uPlot replaces QCustomPlot (≈10× faster) |
| `mainwindow.cpp` LED / status bar | `App.tsx` header + `StatusBar` | Mimics V2 visuals |
| `Help/help.cpp` about dialog | `components/HelpDialog/` | Embedded React, no extra window |
| `myTableWidget/mycomboxdelegate` | `<select>` | Native HTML controls |
| `mydashboard.cpp/h/.ui` | **Not migrated** | Already commented out in V2; decoupled from QUC widgets |

## Architecture

```
┌─────────────────── Renderer (React + Zustand) ───────────────────┐
│  App                                                              │
│  ├── Header (IMU/GNSS LED)                                        │
│  ├── ToolBox (tab switcher)                                       │
│  │   ├── FrameEditor ──┐                                          │
│  │   ├── SerialPort   │                                          │
│  │   ├── GnssPort     │                                          │
│  │   ├── Assistant    │  (third port, raw passthrough)           │
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
│              WebContents.send → renderer                          │
└──────────────────────────────────────────────────────────────────┘
```

## Design Decisions

### Why uPlot instead of Chart.js / Recharts
V2 used QCustomPlot, drawing 3 live waveforms (100 fps × 6 curves per second).
Chart.js / Recharts are SVG-based and ≈10× slower. uPlot is Canvas-based and matches QCustomPlot's performance.

### Why Zustand instead of Redux / Context
V2's main window is a "god class" with all state stuffed into MainWindow.
V3 splits it into slices (FrameSlice / SerialSlice / DataSlice) inside a single store.
Zustand's selector model avoids unnecessary re-renders and cuts Redux boilerplate by an order of magnitude.

### Why IPC goes through contextBridge
V2 had `QSerialPort` on the main thread, UI on the main thread, cross-thread via signal/slot.
V3's security model requires preload isolation, so the design is:
  - Renderer → main: `invoke` (Promise)
  - Main → renderer: `webContents.send` + event name

## Changelog

### v3.0.x (latest)

#### Serial Assistant & IMU Serial — new 614400 baud rate
- `SerialPortPanel` ("Serial", IMU port) baud dropdown adds **`614400`**. Available range: `9600 / 19200 / 38400 / 57600 / 115200 / 230400 / 460800 / 614400 / 921600`
- `AssistantPanel` ("Serial Assistant") baud dropdown adds **`614400`** as well. Available range: `1200 / 2400 / 4800 / 9600 / 19200 / 38400 / 57600 / 115200 / 230400 / 460800 / 614400 / 921600`
- `GnssPortPanel` ("GNSS") **unchanged** — mainstream GNSS receivers are still capped at 115200

#### Data types unified as `{type}{bit-width}`
The old names `short` / `int` / `float` / `double` have platform-dependent widths in C (`short` is usually 16-bit but C only guarantees ≥16; `int` can be 16/32/64; `float` is usually 32-bit, `double` usually 64-bit but not strictly defined). The new explicit bit-width names are consistent across the frame editor, CSV serializer, and parser entry point:

| `DataKind` | Old name | New name |
|------------|----------|----------|
| `Int16`    | `short`  | **`int16`**   |
| `Int32`    | `int`    | **`int32`**   |
| `Float32`  | `float`  | **`float32`** |
| `Float64`  | `double` | **`float64`** |

- **Write side** (`frame-config.ts` `dataKindName()` + `types.ts` `DataTypeName`): writes new names only
- **Read side** (`types.ts` `dataKindFromName()`): new names take priority; if a V2 `.txt`/`.csv` config still uses `short`/`int`/`float`/`double`, it automatically falls back to the correct `DataKind` — **never** silently downgrades to `uint8`

#### Fix: `uint8` fields decoding to values > 256
- **Symptom**: a protocol-frame field declared as `uint8` decoded to values far larger than 256 (e.g. `0xFF` → ~2 550 000)
- **Root cause**: in `frame.ts`, the default scale-factor sentinel `SCALE_NONE = 9999.99` was previously checked with `<=`, so the sentinel itself counted as a valid scale. `rawValue = rawVal * 9999.99` then inflated 0–255 to 0–~2.55M. **All data types were affected** — `uint8` was just the most obvious victim
- **Fix**: `<=` → **`<`** (strictly less than), matching the V2 semantics "`scale > 9999.99` means unused"
- **Behavior change**: when `scale` is the default value (`9999.99`), no multiplication is applied and the output equals the raw byte value. This matches the behavior of "do not apply scale factor" in the frame editor.

## Next Steps

- [ ] Automated serialport native-module compilation (npm scripts)
- [ ] Auto-save `.lastConfig.txt` to `app.getPath('userData')`
- [ ] Live byte / line counts during recording (progress from main process)
- [ ] Frame `.csv` validation (column-misalignment hints on import)
- [ ] IMU frame-loss / error-rate statistics
- [ ] Unit tests: FrameDecoder / GNSS parser / Recorder

## Known Limitations

1. **Sandbox builds**: the current sandbox blocks `esbuild` / `node-gyp` from spawning child processes, so `npm run build` fails inside the sandbox. It works normally on a local dev machine.
2. **serialport rebuild**: the first `npm install` uses `--ignore-scripts` to skip native build by default; on Windows you must run `npx electron-rebuild -f -w serialport` manually.
3. **uPlot theme**: uPlot ships light by default; overridden to dark in `styles.css`.

## Theme & i18n

### Theme
- **Light / Dark / Follow System** — switchable from the HeaderBar
- Implementation: `data-theme="light|dark|system"` + `data-resolved-theme` drive CSS variables
- `prefers-color-scheme` media query listens to system changes
- Persisted to `localStorage['labtool-v3-ui']`

### i18n
- **Simplified Chinese (zh-CN) / Traditional Chinese (zh-TW) / English (en-US)** — switchable from the HeaderBar
- Translations live in `src/renderer/src/i18n/index.ts` (~130 keys × 3 languages)
- Usage: `const t = useT(); <button>{t('frame.confirm')}</button>`
- String interpolation: `t('help.about.intro', { tech: '...' })`
- Persisted to `localStorage`

## License

GPL-3.0