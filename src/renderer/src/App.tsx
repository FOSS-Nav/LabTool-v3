/**
 * LabTool-V3 主组件
 * 整体布局：
 *   ┌─────────────────────────────────────────────────────┐
 *   │  HeaderBar (品牌 + 主题/语言 + LED)                  │
 *   ├──────────┬──────────────────────────────────────────┤
 *   │          │                                          │
 *   │ ToolBox  │   主显示区 (FrameEditor / SerialPort /   │
 *   │ (tabs)   │     DataDisplay / CurvePlot / Trace /   │
 *   │          │     GnssDisplay 按选中切换)              │
 *   │          │                                          │
 *   ├──────────┴──────────────────────────────────────────┤
 *   │  StatusBar (时钟/帧数/X 轴/录制)                    │
 *   └─────────────────────────────────────────────────────┘
 */

import { useEffect, useState } from 'react'
import { ToolBox, PanelKey } from './components/ToolBox/ToolBox'
import { HeaderBar } from './components/HeaderBar/HeaderBar'
import { StatusBar } from './components/StatusBar/StatusBar'
import { HelpDialog } from './components/HelpDialog/HelpDialog'
import { useRuntimeEvents } from './hooks/useRuntimeEvents'
import { initTheme } from './store'
import './styles.css'

function App(): JSX.Element {
  const [panel, setPanel] = useState<PanelKey>('frame')
  const [helpOpen, setHelpOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /* 订阅主进程事件 */
  useRuntimeEvents()

  /* 应用挂载时初始化主题 + 响应系统主题变化 */
  useEffect(() => initTheme(), [])

  /* ESC 关闭错误提示 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setErrorMsg(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* 切换面板时若之前有错误，自动清空 */
  useEffect(() => {
    setErrorMsg(null)
  }, [panel])

  function handleError(msg: string): void {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg((e) => (e === msg ? null : e)), 6000)
  }

  return (
    <div className="app-root">
      <HeaderBar onHelp={() => setHelpOpen(true)} />

      <main className="app-main">
        <ToolBox
          panel={panel}
          setPanel={setPanel}
          onError={handleError}
        />
      </main>

      <StatusBar
        errorMsg={errorMsg}
        onClearError={() => setErrorMsg(null)}
      />

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

export default App
