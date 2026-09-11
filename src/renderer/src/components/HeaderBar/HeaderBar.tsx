/**
 * LabTool-V3 顶部 Header
 * 包含：品牌 + 主题切换 + 语言切换 + IMU/GNSS LED 状态
 */

import { useStore } from '../../store'
import { SerialStatus } from '@shared'
import { LocaleList, LocaleName, useT } from '../../i18n'
import type { Locale } from '../../i18n'
import type { ThemeMode } from '../../store'
import './HeaderBar.css'

interface Props {
  onHelp(): void
}

export function HeaderBar({ onHelp }: Props): JSX.Element {
  const t = useT()
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const locale = useStore((s) => s.locale)
  const setLocale = useStore((s) => s.setLocale)
  const imu = useStore((s) => s.imu)
  const gnss = useStore((s) => s.gnss)

  const imuOn = imu.status === SerialStatus.Open
  const gnssOn = gnss.status === SerialStatus.Open

  return (
    <header className="app-header">
      <div className="ah-brand">
        <span className="ah-logo">✈</span>
        <h1>{t('app.title')}</h1>
        <span className="ah-sub">{t('app.subtitle')}</span>
      </div>

      <div className="ah-tools">
        <label className="ah-tool" title={t('app.theme')}>
          <span className="ah-tool-icon">🎨</span>
          <select
            className="ah-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeMode)}
          >
            <option value="light">{t('app.theme.light')}</option>
            <option value="dark">{t('app.theme.dark')}</option>
            <option value="system">{t('app.theme.system')}</option>
          </select>
        </label>

        <label className="ah-tool" title={t('app.language')}>
          <span className="ah-tool-icon">🌐</span>
          <select
            className="ah-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            {LocaleList.map((l) => (
              <option key={l} value={l}>
                {LocaleName[l]}
              </option>
            ))}
          </select>
        </label>

        <button className="ah-help-btn" onClick={onHelp} title={t('tool.help')}>
          ?
        </button>
      </div>

      <div className="ah-status">
        <div className="ah-led-group">
          <span className="ah-led-label">{t('header.imu')}</span>
          <span className={'ah-led ' + (imuOn ? 'on' : 'off')} />
          <span className="ah-led-state">{t('header.status.' + imu.status)}</span>
        </div>
        <div className="ah-led-group">
          <span className="ah-led-label">{t('header.gnss')}</span>
          <span className={'ah-led ' + (gnssOn ? 'on' : 'off')} />
          <span className="ah-led-state">{t('header.status.' + gnss.status)}</span>
        </div>
      </div>
    </header>
  )
}
