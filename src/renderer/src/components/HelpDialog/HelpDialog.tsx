/**
 * LabTool-V3 帮助对话框
 * 对应 V2 ui->on_showHelp_btn_clicked
 *
 * 内容对标 V2 Help/help.ui，但用 React + 内联样式实现；
 * 并新增「反馈与交流」标签页。
 */

import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import './HelpDialog.css'

interface Props {
  open: boolean
  onClose(): void
}

type Tab = 'about' | 'usage' | 'history' | 'feedback'

/* V2 Readme.md 中提取的反馈信息 */
const FEEDBACK = {
  repoV3: 'https://gitee.com/tmrnic/lab-tool-v3',
  repoV2: 'https://gitee.com/tmrnic/lab-tool-v2',
  email: 'yangxiaokang495@163.com',
  zhihu: 'https://www.zhihu.com/people/qikitaka',
  website: 'http://www.navspace.tech'
}

export function HelpDialog({ open, onClose }: Props): JSX.Element | null {
  const t = useT()
  const [tab, setTab] = useState<Tab>('about')

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  function copy(text: string): void {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div className="help-mask" onClick={onClose}>
      <div className="help-window" onClick={(e) => e.stopPropagation()}>
        <div className="help-titlebar">
          <span>📘 {t('help.title')}</span>
          <button className="help-close" onClick={onClose}>×</button>
        </div>
        <div className="help-tabs">
          <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
            {t('help.tab.about')}
          </button>
          <button className={tab === 'usage' ? 'active' : ''} onClick={() => setTab('usage')}>
            {t('help.tab.usage')}
          </button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            {t('help.tab.history')}
          </button>
          <button className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}>
            {t('help.tab.feedback')}
          </button>
        </div>

        <div className="help-content">
          {tab === 'about' && (
            <div>
              <h3>{t('help.about.heading')}</h3>
              <p>
                {t('help.about.intro', { tech: t('help.about.tech') })}
              </p>
              <h4>{t('help.about.features')}</h4>
              <ul>
                <li>{t('help.about.feature1')}</li>
                <li>{t('help.about.feature2')}</li>
                <li>{t('help.about.feature3')}</li>
                <li>{t('help.about.feature4')}</li>
                <li>{t('help.about.feature5')}</li>
                <li>{t('help.about.feature6')}</li>
              </ul>
              <h4>{t('help.about.meta')}</h4>
              <p>{t('help.about.author')}</p>
            </div>
          )}

          {tab === 'usage' && (
            <div>
              <h3>{t('help.usage.heading')}</h3>
              <ol>
                <li>{t('help.usage.step1')}</li>
                <li>{t('help.usage.step2')}</li>
                <li>{t('help.usage.step3')}</li>
                <li>{t('help.usage.step4')}</li>
                <li>{t('help.usage.step5')}</li>
                <li>{t('help.usage.step6')}</li>
              </ol>
              <h4>{t('help.usage.frameFormat')}</h4>
              <pre>{`# endian=little
Frame_Header,uint8_t(hex),0xEB,------
Frame_Header,uint8_t(hex),0x90,------
Time_Stamp,uint32_t,0,------
bmi-wx,float,0,/
pitch,float,0,/
CHKSUM,uint8,0,------`}</pre>
              <p className="help-note">{t('help.usage.frameNote')}</p>
            </div>
          )}

          {tab === 'history' && (
            <div>
              <h3>{t('help.history.heading')}</h3>
              <ul className="help-history">
                <li><b>V3 (2025+)</b> — {t('help.history.v3')}</li>
                <li><b>V2 (2024)</b> — {t('help.history.v2')}</li>
                <li><b>V1</b> — {t('help.history.v1')}</li>
              </ul>
            </div>
          )}

          {tab === 'feedback' && (
            <div className="help-feedback">
              <h3>{t('help.feedback.heading')}</h3>
              <p className="help-feedback-intro">{t('help.feedback.intro')}</p>

              <div className="help-feedback-grid">
                <div className="help-feedback-item">
                  <div className="help-feedback-label">
                    <span className="help-feedback-icon">📦</span>
                    {t('help.feedback.repo')} (V3)
                  </div>
                  <a
                    className="help-feedback-link"
                    href={FEEDBACK.repoV3}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {FEEDBACK.repoV3}
                  </a>
                  <button
                    className="help-feedback-copy"
                    onClick={() => copy(FEEDBACK.repoV3)}
                    title="Copy"
                  >
                    📋
                  </button>
                </div>

                <div className="help-feedback-item">
                  <div className="help-feedback-label">
                    <span className="help-feedback-icon">📦</span>
                    {t('help.feedback.repoV2')}
                  </div>
                  <a
                    className="help-feedback-link"
                    href={FEEDBACK.repoV2}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {FEEDBACK.repoV2}
                  </a>
                  <button
                    className="help-feedback-copy"
                    onClick={() => copy(FEEDBACK.repoV2)}
                    title="Copy"
                  >
                    📋
                  </button>
                </div>

                <div className="help-feedback-item">
                  <div className="help-feedback-label">
                    <span className="help-feedback-icon">📧</span>
                    {t('help.feedback.author')}
                  </div>
                  <a className="help-feedback-link" href={`mailto:${FEEDBACK.email}`}>
                    {FEEDBACK.email}
                  </a>
                  <button
                    className="help-feedback-copy"
                    onClick={() => copy(FEEDBACK.email)}
                    title="Copy"
                  >
                    📋
                  </button>
                </div>

                <div className="help-feedback-item">
                  <div className="help-feedback-label">
                    <span className="help-feedback-icon">💬</span>
                    {t('help.feedback.zhihu')}
                  </div>
                  <a
                    className="help-feedback-link"
                    href={FEEDBACK.zhihu}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {FEEDBACK.zhihu}
                  </a>
                </div>

                <div className="help-feedback-item">
                  <div className="help-feedback-label">
                    <span className="help-feedback-icon">🌐</span>
                    {t('help.feedback.website')}
                  </div>
                  <a
                    className="help-feedback-link"
                    href={FEEDBACK.website}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {FEEDBACK.website}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="help-footer">
          <button className="help-ok" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}
