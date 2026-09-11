/**
 * LabTool-V3 轻量 i18n 模块
 *
 * 为什么不引入 react-i18next / i18next：
 *  - V2 是中文软件，三种语言固定（简/繁/英），翻译字符串不到 100 条；
 *  - 主进程 / 共享层已编译完成，再引入重型库反而需要重打；
 *  - 用 Zustand 订阅 locale 即可触发组件重渲，等价 react-i18next 的 useTranslation。
 *
 * 用法：
 *   const { t, locale } = useI18n()
 *   <button>{t('serial.open')}</button>
 *
 * 字符串插值：t('recorder.linesWritten', { lines: 123, kb: 4.5 })
 *   → '已写入 123 行 / 4.5 KB'（按 locale 选模板）
 */

import { useStore } from '../store'

export type Locale = 'zh-CN' | 'zh-TW' | 'en-US'

export const LocaleName: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English'
}

export const LocaleList: Locale[] = ['zh-CN', 'zh-TW', 'en-US']

/* ============================================================
 * 翻译表
 * ============================================================ */

type Dict = Record<string, string>

const zhCN: Dict = {
  // App
  'app.title': 'LabTool-V3',
  'app.subtitle': '惯导实验串口采数软件 · Electron + React + TS',
  'app.theme': '主题',
  'app.theme.light': '浅色',
  'app.theme.dark': '深色',
  'app.theme.system': '跟随系统',
  'app.language': '语言',

  // Header
  'header.imu': 'IMU',
  'header.gnss': 'GNSS',
  'header.status.closed': '已关闭',
  'header.status.opening': '打开中',
  'header.status.open': '已打开',
  'header.status.error': '错误',

  // ToolBox
  'tool.frame': '协议帧',
  'tool.serial': '串口',
  'tool.gnss': 'GNSS',
  'tool.display': '数据',
  'tool.curve': '曲线',
  'tool.trace': '轨迹',
  'tool.help': '帮助',

  // FrameEditor
  'frame.insertHeader': '插入帧头',
  'frame.insertTimestamp': '插入时间戳',
  'frame.appendChecksum': '追加和校验',
  'frame.addData': '添加数据',
  'frame.deleteLast': '删除末行',
  'frame.loadConfig': '加载配置',
  'frame.saveConfig': '保存配置',
  'frame.endian': '字节序',
  'frame.endian.little': '小端 (Little)',
  'frame.endian.big': '大端 (Big)',
  'frame.confirm': '确认数据帧',
  'frame.edit': '编辑数据帧',
  'frame.name': '名称',
  'frame.role': '角色',
  'frame.type': '类型',
  'frame.default': '默认值',
  'frame.scale': '标度因数 k',
  'frame.plot1': '图1',
  'frame.plot2': '图2',
  'frame.plot3': '图3',
  'frame.del': '删',
  'frame.role.header': '帧头',
  'frame.role.tail': '帧尾',
  'frame.role.timestamp': '时间戳',
  'frame.role.checksum': '和校验',
  'frame.role.data': '数据',
  'frame.frameLen': '帧长',
  'frame.headerLen': '帧头',
  'frame.timestampPos': '时间戳',
  'frame.checksumPos': '校验位',
  'frame.timestampAbsent': '无',
  'frame.confirmed': '✓ 已确认，正在解析',
  'frame.unconfirmed': '○ 未确认',
  'frame.frameLenUnit': '字节',

  // SerialPort
  'serial.portName': '串口号',
  'serial.baudRate': '波特率',
  'serial.dataBits': '数据位',
  'serial.stopBits': '停止位',
  'serial.parity': '校验位',
  'serial.parity.none': 'None',
  'serial.parity.even': 'Even',
  'serial.parity.odd': 'Odd',
  'serial.refreshPorts': '刷新串口列表',
  'serial.open': '打开串口',
  'serial.close': '关闭串口',
  'serial.errorOpenFirst': '请先在"协议帧"页面点击"确认数据帧"',

  // GnssPort
  'gnss.enable': '使能 GNSS',
  'gnss.enableHintOn': '开启后随 IMU 一起启动',
  'gnss.enableHintOff': '关闭',
  'gnss.measType': '量测类型',
  'gnss.measType.velpos': '速度+位置',
  'gnss.measType.onlypos': '仅位置',

  // DataDisplay
  'display.title': '实时数据',
  'display.frameCount': '帧计数',
  'display.type': '类型',
  'display.value': '实时值',

  // GnssDisplay
  'gnss.title': 'GNSS 数据',
  'gnss.traceCount': '轨迹点',
  'gnss.ve': 'Ve(东向)',
  'gnss.vn': 'Vn(北向)',
  'gnss.vu': 'Vu(天向)',
  'gnss.utcTime': 'UTC 时间',
  'gnss.lat': '纬度',
  'gnss.lng': '经度',
  'gnss.alt': '海拔',
  'gnss.hdop': 'HDOP',
  'gnss.unit.mps': 'm/s',
  'gnss.unit.deg': 'deg',
  'gnss.unit.m': 'm',
  'gnss.unit.s': 's',

  // CurvePlot
  'curve.empty': '未选择曲线',
  'curve.xAxis.frame': '帧',
  'curve.xAxis.time': '时间',

  // GnssTracePlot
  'trace.title': 'GNSS 轨迹',
  'trace.empty': '等待 GNSS 数据…',
  'trace.east': 'EAST(m) →',
  'trace.north': '↑ NORTH(m)',
  'trace.points': '点',

  // StatusBar
  'status.frame': '帧',
  'status.xAxis': '横轴',
  'status.xAxis.count': '帧计数',
  'status.xAxis.timestamp': '时间戳',
  'status.recording': '录制中',
  'status.notRecording': '未录制',
  'status.recStart': '捕获数据',
  'status.recStop': '停止捕获',
  'status.recInfo': '{lines} 行 · {kb} KB',

  // HelpDialog
  'help.title': 'LabTool-V3 帮助',
  'help.tab.about': '关于',
  'help.tab.usage': '使用说明',
  'help.tab.history': '版本历史',
  'help.tab.feedback': '反馈与交流',
  'help.about.heading': 'LabTool V3',
  'help.about.intro': '惯导实验室串口采数软件，基于 {tech} 重构自 LabTool-V2 (Qt)。',
  'help.about.tech': 'Electron + React + TypeScript + Vite',
  'help.about.features': '核心功能',
  'help.about.feature1': '可编辑协议帧（10 种基础类型 + 字节序）',
  'help.about.feature2': '双路串口（IMU + GNSS）异步采集',
  'help.about.feature3': 'NMEA / NovAtel 自动识别',
  'help.about.feature4': '三联实时曲线（uPlot 渲染）',
  'help.about.feature5': 'GNSS 实时轨迹图（本地 E/N 投影）',
  'help.about.feature6': '数据落盘：解析后 .txt + 原始 .bin，GNSS 时间对齐',
  'help.about.meta': '项目信息',
  'help.about.author': '作者：TMRNic ｜ 协议：GPL-3.0',
  'help.usage.heading': '使用步骤',
  'help.usage.step1': '打开「协议帧」面板，按需增删改表格行，设置帧头、字段类型、标度因数。',
  'help.usage.step2': '点击「确认数据帧」→ 编译为字节级描述。',
  'help.usage.step3': '在「串口」面板配置 COM 口 + 波特率，点击「打开串口」。',
  'help.usage.step4': '若需 GNSS，在「GNSS」面板勾选「使能 GNSS」并配置，打开后自动随 IMU 串口启动。',
  'help.usage.step5': '在表格中勾选每个字段的"图1/图2/图3"，「实时波形」面板会实时绘制曲线。',
  'help.usage.step6': '点击底部「捕获数据」，选择保存路径即可。停止捕获后得到 .txt（解析）+ .bin（原始）。',
  'help.usage.frameFormat': '帧协议脚本格式',
  'help.usage.frameNote': '字段名特殊值：Frame_Header / Frame_Tail / Time_Stamp / Check_Sum 触发对应逻辑。',
  'help.history.heading': '版本历史',
  'help.history.v3': 'V3 — Electron + React + TS 重构版。串口、解析、UI 完全重写。',
  'help.history.v2': 'V2 (2024) — Qt 5.15 + MinGW 8.1。加入 GNSS 解析 + 轨迹显示。',
  'help.history.v1': 'V1 — Qt 4 + QUC 控件。纯 IMU 采集。',
  'help.feedback.heading': '反馈与交流',
  'help.feedback.intro': '欢迎提交 Issue / Pull Request，或邮件交流。',
  'help.feedback.repo': '开源仓库',
  'help.feedback.repoV2': 'V2 (Qt) 仓库',
  'help.feedback.author': '作者邮箱',
  'help.feedback.zhihu': '知乎主页',
  'help.feedback.website': '个人网站',

  // Common
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.ok': '确定',
  'common.warn': '⚠',
  'common.error': '错误',
  'common.version': '版本'
}

const zhTW: Dict = {
  'app.title': 'LabTool-V3',
  'app.subtitle': '慣導實驗串口採數軟體 · Electron + React + TS',
  'app.theme': '主題',
  'app.theme.light': '淺色',
  'app.theme.dark': '深色',
  'app.theme.system': '跟隨系統',
  'app.language': '語言',

  'header.imu': 'IMU',
  'header.gnss': 'GNSS',
  'header.status.closed': '已關閉',
  'header.status.opening': '打開中',
  'header.status.open': '已打開',
  'header.status.error': '錯誤',

  'tool.frame': '協議幀',
  'tool.serial': '串口',
  'tool.gnss': 'GNSS',
  'tool.display': '資料',
  'tool.curve': '曲線',
  'tool.trace': '軌跡',
  'tool.help': '說明',

  'frame.insertHeader': '插入幀頭',
  'frame.insertTimestamp': '插入時間戳',
  'frame.appendChecksum': '追加和校驗',
  'frame.addData': '新增資料',
  'frame.deleteLast': '刪除末行',
  'frame.loadConfig': '載入設定',
  'frame.saveConfig': '儲存設定',
  'frame.endian': '位元組序',
  'frame.endian.little': '小端 (Little)',
  'frame.endian.big': '大端 (Big)',
  'frame.confirm': '確認資料幀',
  'frame.edit': '編輯資料幀',
  'frame.name': '名稱',
  'frame.role': '角色',
  'frame.type': '型別',
  'frame.default': '預設值',
  'frame.scale': '標度因數 k',
  'frame.plot1': '圖1',
  'frame.plot2': '圖2',
  'frame.plot3': '圖3',
  'frame.del': '刪',
  'frame.role.header': '幀頭',
  'frame.role.tail': '幀尾',
  'frame.role.timestamp': '時間戳',
  'frame.role.checksum': '和校驗',
  'frame.role.data': '資料',
  'frame.frameLen': '幀長',
  'frame.headerLen': '幀頭',
  'frame.timestampPos': '時間戳',
  'frame.checksumPos': '校驗位',
  'frame.timestampAbsent': '無',
  'frame.confirmed': '✓ 已確認，正在解析',
  'frame.unconfirmed': '○ 未確認',
  'frame.frameLenUnit': '位元組',

  'serial.portName': '串口號',
  'serial.baudRate': '鮑率',
  'serial.dataBits': '資料位',
  'serial.stopBits': '停止位',
  'serial.parity': '同位元',
  'serial.parity.none': 'None',
  'serial.parity.even': 'Even',
  'serial.parity.odd': 'Odd',
  'serial.refreshPorts': '重新整理串口',
  'serial.open': '開啟串口',
  'serial.close': '關閉串口',
  'serial.errorOpenFirst': '請先在「協議幀」頁面點選「確認資料幀」',

  'gnss.enable': '啟用 GNSS',
  'gnss.enableHintOn': '開啟後隨 IMU 一起啟動',
  'gnss.enableHintOff': '關閉',
  'gnss.measType': '量測類型',
  'gnss.measType.velpos': '速度+位置',
  'gnss.measType.onlypos': '僅位置',

  'display.title': '即時資料',
  'display.frameCount': '幀計數',
  'display.type': '型別',
  'display.value': '即時值',

  'gnss.title': 'GNSS 資料',
  'gnss.traceCount': '軌跡點',
  'gnss.ve': 'Ve(東向)',
  'gnss.vn': 'Vn(北向)',
  'gnss.vu': 'Vu(天向)',
  'gnss.utcTime': 'UTC 時間',
  'gnss.lat': '緯度',
  'gnss.lng': '經度',
  'gnss.alt': '海拔',
  'gnss.hdop': 'HDOP',
  'gnss.unit.mps': 'm/s',
  'gnss.unit.deg': 'deg',
  'gnss.unit.m': 'm',
  'gnss.unit.s': 's',

  'curve.empty': '未選擇曲線',
  'curve.xAxis.frame': '幀',
  'curve.xAxis.time': '時間',

  'trace.title': 'GNSS 軌跡',
  'trace.empty': '等待 GNSS 資料…',
  'trace.east': 'EAST(m) →',
  'trace.north': '↑ NORTH(m)',
  'trace.points': '點',

  'status.frame': '幀',
  'status.xAxis': '橫軸',
  'status.xAxis.count': '幀計數',
  'status.xAxis.timestamp': '時間戳',
  'status.recording': '錄製中',
  'status.notRecording': '未錄製',
  'status.recStart': '擷取資料',
  'status.recStop': '停止擷取',
  'status.recInfo': '{lines} 行 · {kb} KB',

  'help.title': 'LabTool-V3 說明',
  'help.tab.about': '關於',
  'help.tab.usage': '使用說明',
  'help.tab.history': '版本歷史',
  'help.tab.feedback': '意見回饋',
  'help.about.heading': 'LabTool V3',
  'help.about.intro': '慣導實驗室串口採數軟體，基於 {tech} 重構自 LabTool-V2 (Qt)。',
  'help.about.tech': 'Electron + React + TypeScript + Vite',
  'help.about.features': '核心功能',
  'help.about.feature1': '可編輯協議幀（10 種基礎型別 + 位元組序）',
  'help.about.feature2': '雙路串口（IMU + GNSS）非同步採集',
  'help.about.feature3': 'NMEA / NovAtel 自動識別',
  'help.about.feature4': '三聯即時曲線（uPlot 渲染）',
  'help.about.feature5': 'GNSS 即時軌跡圖（本地 E/N 投影）',
  'help.about.feature6': '資料落盤：解析後 .txt + 原始 .bin，GNSS 時間對齊',
  'help.about.meta': '專案資訊',
  'help.about.author': '作者：TMRNic ｜ 授權：GPL-3.0',
  'help.usage.heading': '使用步驟',
  'help.usage.step1': '開啟「協議幀」面板，按需增刪改表格行，設定幀頭、欄位型別、標度因數。',
  'help.usage.step2': '點選「確認資料幀」→ 編譯為位元組級描述。',
  'help.usage.step3': '在「串口」面板設定 COM 號 + 鮑率，點選「開啟串口」。',
  'help.usage.step4': '若需 GNSS，在「GNSS」面板勾選「啟用 GNSS」並設定，開啟後自動隨 IMU 串口啟動。',
  'help.usage.step5': '在表格中勾選每個欄位的「圖1/圖2/圖3」，「即時波形」面板會即時繪製曲線。',
  'help.usage.step6': '點選底部「擷取資料」，選擇儲存路徑即可。停止擷取後得到 .txt（解析）+ .bin（原始）。',
  'help.usage.frameFormat': '幀協議腳本格式',
  'help.usage.frameNote': '欄位名稱特殊值：Frame_Header / Frame_Tail / Time_Stamp / Check_Sum 觸發對應邏輯。',
  'help.history.heading': '版本歷史',
  'help.history.v3': 'V3 — Electron + React + TS 重構版。串口、解析、UI 完全重寫。',
  'help.history.v2': 'V2 (2024) — Qt 5.15 + MinGW 8.1。加入 GNSS 解析 + 軌跡顯示。',
  'help.history.v1': 'V1 — Qt 4 + QUC 控件。純 IMU 採集。',
  'help.feedback.heading': '意見回饋',
  'help.feedback.intro': '歡迎提交 Issue / Pull Request，或郵件交流。',
  'help.feedback.repo': '開源倉庫',
  'help.feedback.repoV2': 'V2 (Qt) 倉庫',
  'help.feedback.author': '作者郵箱',
  'help.feedback.zhihu': '知乎主頁',
  'help.feedback.website': '個人網站',

  'common.cancel': '取消',
  'common.close': '關閉',
  'common.ok': '確定',
  'common.warn': '⚠',
  'common.error': '錯誤',
  'common.version': '版本'
}

const enUS: Dict = {
  'app.title': 'LabTool-V3',
  'app.subtitle': 'Inertial Lab Serial Acquisition · Electron + React + TS',
  'app.theme': 'Theme',
  'app.theme.light': 'Light',
  'app.theme.dark': 'Dark',
  'app.theme.system': 'Follow system',
  'app.language': 'Language',

  'header.imu': 'IMU',
  'header.gnss': 'GNSS',
  'header.status.closed': 'closed',
  'header.status.opening': 'opening',
  'header.status.open': 'open',
  'header.status.error': 'error',

  'tool.frame': 'Frame',
  'tool.serial': 'Serial',
  'tool.gnss': 'GNSS',
  'tool.display': 'Data',
  'tool.curve': 'Curves',
  'tool.trace': 'Trace',
  'tool.help': 'Help',

  'frame.insertHeader': 'Insert Header',
  'frame.insertTimestamp': 'Insert Timestamp',
  'frame.appendChecksum': 'Append Checksum',
  'frame.addData': 'Add Data',
  'frame.deleteLast': 'Delete Last',
  'frame.loadConfig': 'Load Config',
  'frame.saveConfig': 'Save Config',
  'frame.endian': 'Endian',
  'frame.endian.little': 'Little',
  'frame.endian.big': 'Big',
  'frame.confirm': 'Confirm Frame',
  'frame.edit': 'Edit Frame',
  'frame.name': 'Name',
  'frame.role': 'Role',
  'frame.type': 'Type',
  'frame.default': 'Default',
  'frame.scale': 'Scale k',
  'frame.plot1': 'Plot1',
  'frame.plot2': 'Plot2',
  'frame.plot3': 'Plot3',
  'frame.del': '×',
  'frame.role.header': 'Header',
  'frame.role.tail': 'Tail',
  'frame.role.timestamp': 'Timestamp',
  'frame.role.checksum': 'Checksum',
  'frame.role.data': 'Data',
  'frame.frameLen': 'Frame Len',
  'frame.headerLen': 'Header',
  'frame.timestampPos': 'Timestamp',
  'frame.checksumPos': 'Checksum',
  'frame.timestampAbsent': 'none',
  'frame.confirmed': '✓ Confirmed, parsing',
  'frame.unconfirmed': '○ Unconfirmed',
  'frame.frameLenUnit': 'bytes',

  'serial.portName': 'Port',
  'serial.baudRate': 'Baud',
  'serial.dataBits': 'Data bits',
  'serial.stopBits': 'Stop bits',
  'serial.parity': 'Parity',
  'serial.parity.none': 'None',
  'serial.parity.even': 'Even',
  'serial.parity.odd': 'Odd',
  'serial.refreshPorts': 'Refresh ports',
  'serial.open': 'Open Port',
  'serial.close': 'Close Port',
  'serial.errorOpenFirst': 'Please confirm the data frame first',

  'gnss.enable': 'Enable GNSS',
  'gnss.enableHintOn': 'Starts with IMU',
  'gnss.enableHintOff': 'Disabled',
  'gnss.measType': 'Measurement',
  'gnss.measType.velpos': 'Vel + Pos',
  'gnss.measType.onlypos': 'Pos only',

  'display.title': 'Live Data',
  'display.frameCount': 'Frame',
  'display.type': 'Type',
  'display.value': 'Value',

  'gnss.title': 'GNSS Data',
  'gnss.traceCount': 'Points',
  'gnss.ve': 'Ve (East)',
  'gnss.vn': 'Vn (North)',
  'gnss.vu': 'Vu (Up)',
  'gnss.utcTime': 'UTC Time',
  'gnss.lat': 'Latitude',
  'gnss.lng': 'Longitude',
  'gnss.alt': 'Altitude',
  'gnss.hdop': 'HDOP',
  'gnss.unit.mps': 'm/s',
  'gnss.unit.deg': 'deg',
  'gnss.unit.m': 'm',
  'gnss.unit.s': 's',

  'curve.empty': 'No curve selected',
  'curve.xAxis.frame': 'frame',
  'curve.xAxis.time': 'time',

  'trace.title': 'GNSS Trace',
  'trace.empty': 'Waiting for GNSS data…',
  'trace.east': 'EAST (m) →',
  'trace.north': '↑ NORTH (m)',
  'trace.points': 'pts',

  'status.frame': 'frame',
  'status.xAxis': 'X axis',
  'status.xAxis.count': 'Frame count',
  'status.xAxis.timestamp': 'Timestamp',
  'status.recording': 'Recording',
  'status.notRecording': 'Idle',
  'status.recStart': 'Capture',
  'status.recStop': 'Stop',
  'status.recInfo': '{lines} lines · {kb} KB',

  'help.title': 'LabTool-V3 Help',
  'help.tab.about': 'About',
  'help.tab.usage': 'Usage',
  'help.tab.history': 'History',
  'help.tab.feedback': 'Feedback',
  'help.about.heading': 'LabTool V3',
  'help.about.intro': 'Inertial navigation lab serial acquisition software, rebuilt from LabTool-V2 (Qt) using {tech}.',
  'help.about.tech': 'Electron + React + TypeScript + Vite',
  'help.about.features': 'Features',
  'help.about.feature1': 'Editable protocol frame (10 base types + endian)',
  'help.about.feature2': 'Dual-port serial (IMU + GNSS) async capture',
  'help.about.feature3': 'NMEA / NovAtel auto detection',
  'help.about.feature4': 'Triple real-time curves (uPlot)',
  'help.about.feature5': 'GNSS trace map (local E/N projection)',
  'help.about.feature6': 'Data persistence: parsed .txt + raw .bin, GNSS time-aligned',
  'help.about.meta': 'Project info',
  'help.about.author': 'Author: TMRNic ｜ License: GPL-3.0',
  'help.usage.heading': 'Workflow',
  'help.usage.step1': 'Open the Frame panel. Edit rows for header, field types, scale factors.',
  'help.usage.step2': 'Click "Confirm Frame" to compile the descriptor.',
  'help.usage.step3': 'Configure the COM port + baud rate in the Serial panel, then click "Open Port".',
  'help.usage.step4': 'For GNSS: tick "Enable GNSS" in the GNSS panel and configure; it starts with IMU.',
  'help.usage.step5': 'Tick "Plot1/2/3" for fields you want to graph; the Curves panel updates in real time.',
  'help.usage.step6': 'Click "Capture" at the bottom and choose a save path. On stop you get .txt (parsed) + .bin (raw).',
  'help.usage.frameFormat': 'Frame config format',
  'help.usage.frameNote': 'Special field names: Frame_Header / Frame_Tail / Time_Stamp / Check_Sum trigger the corresponding logic.',
  'help.history.heading': 'Version history',
  'help.history.v3': 'V3 — Electron + React + TS rebuild. Serial, parser, UI all rewritten.',
  'help.history.v2': 'V2 (2024) — Qt 5.15 + MinGW 8.1. Added GNSS parsing + trace plot.',
  'help.history.v1': 'V1 — Qt 4 + QUC widgets. Pure IMU capture.',
  'help.feedback.heading': 'Feedback & Contact',
  'help.feedback.intro': 'Issues, PRs, and emails are welcome.',
  'help.feedback.repo': 'Source repository',
  'help.feedback.repoV2': 'V2 (Qt) repository',
  'help.feedback.author': 'Author email',
  'help.feedback.zhihu': 'Zhihu profile',
  'help.feedback.website': 'Personal website',

  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.ok': 'OK',
  'common.warn': '⚠',
  'common.error': 'Error',
  'common.version': 'Version'
}

const dictionaries: Record<Locale, Dict> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS
}

/* ============================================================
 * Hook：useT
 * 组件中使用 const t = useT()，调用 t('frame.confirm') 取字符串。
 * ============================================================ */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const locale = useStore((s) => s.locale)
  return (key: string, params?: Record<string, string | number>) => {
    const dict = dictionaries[locale] ?? zhCN
    let str = dict[key]
    if (str === undefined) {
      // 兜底：找不到就回退到 zh-CN，再找不到就原样返回 key
      str = zhCN[key] ?? key
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return str
  }
}

/* ============================================================
 * 直接取值（非 hook，可在 main 进程或工具中使用）
 * ============================================================ */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[locale] ?? zhCN
  let str = dict[key] ?? zhCN[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}
