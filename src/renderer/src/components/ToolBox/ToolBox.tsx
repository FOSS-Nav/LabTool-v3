/**
 * LabTool-V3 左侧工具箱
 * 对应 V2 ui->toolBox（数据协议 / 串口 / GNSS / 显示 / 曲线）
 *
 * 帮助按钮已迁移到 HeaderBar，这里只保留 6 个功能面板。
 */

import { useState } from 'react'
import { FrameEditor } from '../FrameEditor/FrameEditor'
import { SerialPortPanel } from '../SerialPortPanel/SerialPortPanel'
import { GnssPortPanel } from '../GnssPortPanel/GnssPortPanel'
import { DataDisplay } from '../DataDisplay/DataDisplay'
import { GnssDisplay } from '../GnssDisplay/GnssDisplay'
import { CurvePlot } from '../CurvePlot/CurvePlot'
import { GnssTracePlot } from '../GnssTracePlot/GnssTracePlot'
import { AssistantPanel } from '../AssistantPanel/AssistantPanel'
import { useStore } from '../../store'
import { useT } from '../../i18n'
import './ToolBox.css'

export type PanelKey = 'frame' | 'serial' | 'gnss' | 'display' | 'curve' | 'trace' | 'assistant'
interface Props {
  panel: PanelKey
  setPanel(p: PanelKey): void
  onError(msg: string): void
}

export function ToolBox({ panel, setPanel, onError }: Props): JSX.Element {
  const t = useT()
  const frameConfirmed = useStore((s) => s.confirmed)
  const [hovered, setHovered] = useState<PanelKey | null>(null)

  const PANELS: { key: PanelKey; icon: string; labelKey: string }[] = [
    { key: 'frame', icon: '📋', labelKey: 'tool.frame' },
    { key: 'serial', icon: '🔌', labelKey: 'tool.serial' },
    { key: 'gnss', icon: '🛰️', labelKey: 'tool.gnss' },
    { key: 'display', icon: '📊', labelKey: 'tool.display' },
    { key: 'curve', icon: '📈', labelKey: 'tool.curve' },
    { key: 'trace', icon: '🗺️', labelKey: 'tool.trace' },
    { key: 'assistant', icon: '🔧', labelKey: 'tool.assistant' }
  ]

  return (
    <aside className="toolbox">
      <div className="tb-tabs">
        {PANELS.map((p) => (
          <button
            key={p.key}
            className={'tb-tab ' + (panel === p.key ? 'active' : '')}
            onClick={() => setPanel(p.key)}
            onMouseEnter={() => setHovered(p.key)}
            onMouseLeave={() => setHovered(null)}
            title={t(p.labelKey)}
          >
            <span className="tb-icon">{p.icon}</span>
            {hovered === p.key && <span className="tb-tip">{t(p.labelKey)}</span>}
          </button>
        ))}
      </div>
      <div className="tb-body">
        {panel === 'frame' && <FrameEditor onError={onError} />}
        {panel === 'serial' && <SerialPortPanel onError={onError} frameConfirmed={frameConfirmed} />}
        {panel === 'gnss' && <GnssPortPanel onError={onError} />}
        {panel === 'display' && <DataDisplay />}
        {panel === 'curve' && <CurvePlot />}
        {panel === 'trace' && <GnssTracePlot />}
        {panel === 'assistant' && <AssistantPanel />}
      </div>
    </aside>
  )
}
