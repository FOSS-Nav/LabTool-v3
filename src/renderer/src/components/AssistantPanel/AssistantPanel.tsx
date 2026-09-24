/**
 * LabTool-V3 串口助手面板
 *
 * 独立于 IMU/GNSS 的第三个串口，原始字节透传。
 * 用于在正式采集前调试串口、发送 AT 命令、查看原始响应等。
 *
 * 布局：
 *   ┌─ 串口配置（COM / 波特率 / 打开）───────────┐
 *   ├─ 接收区（HEX 格式，可切换 ASCII）───────┤
 *   ├─ 发送区（HEX 输入，回车发送）────────────┤
 *   └─ 状态：收发字节计数 ──────────────────────┘
 */

import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { SerialConfig, SerialStatus } from '@shared'
import { useT } from '../../i18n'
import './AssistantPanel.css'

const BAUDS = [
  '1200', '2400', '4800', '9600', '19200', '38400', '57600',
  '115200', '230400', '460800', '614400', '921600'
]
const DATA_BITS = ['8', '7', '6', '5']
const PARITY = [0, 2, 3] as const
const STOP_BITS = [1, 3, 2] as const

const MAX_RENDER_BYTES = 8192  // 接收区最多保留这么多字节

export function AssistantPanel(): JSX.Element {
  const t = useT()
  const imu = useStore((s) => s.imu)  // 复用 imu.availablePorts

  const [cfg, setCfg] = useState<SerialConfig>({
    portName: 'COM4',
    baudRate: 115200,
    dataBits: 8,
    parity: 0,
    stopBits: 1
  })
  const [status, setStatus] = useState<SerialStatus>(SerialStatus.Closed)
  const [error, setError] = useState<string | null>(null)

  /** 接收缓冲区（原始字节） */
  const [rxBuf, setRxBuf] = useState<number[]>([])
  /** 收发字节计数 */
  const [txBytes, setTxBytes] = useState(0)
  const [rxBytes, setRxBytes] = useState(0)
  /** 显示模式：'hex' | 'ascii' */
  const [displayMode, setDisplayMode] = useState<'hex' | 'ascii'>('hex')

  const txInputRef = useRef<HTMLTextAreaElement>(null)
  const rxAreaRef = useRef<HTMLPreElement>(null)
  const lastTxRef = useRef('')  // 用于发送时回显

  // 订阅助手状态 / 数据
  useEffect(() => {
    const offStatus = window.labtool.onAssistantStatus((p) => {
      setStatus(p.status)
      setError(p.error ?? null)
    })
    const offData = window.labtool.onAssistantData((p) => {
      setRxBuf((prev) => {
        const next = prev.concat(p.data)
        return next.length > MAX_RENDER_BYTES ? next.slice(-MAX_RENDER_BYTES) : next
      })
      setRxBytes((n) => n + p.data.length)
      // 自动滚动到底部
      setTimeout(() => {
        if (rxAreaRef.current) rxAreaRef.current.scrollTop = rxAreaRef.current.scrollHeight
      }, 0)
    })
    // 初次拉取状态（可能主进程已经有）
    void window.labtool.getAssistantState().then((s) => setStatus(s.status))
    return () => {
      offStatus()
      offData()
    }
  }, [])

  // 离开页面自动关闭
  useEffect(() => {
    return () => {
      void window.labtool.closeAssistant()
    }
  }, [])

  async function refreshPorts(): Promise<void> {
    const ports = await window.labtool.listPorts()
    if (ports.length > 0 && !ports.includes(cfg.portName)) {
      setCfg((c) => ({ ...c, portName: ports[0] }))
    }
    // 同步到 store
    useStore.getState().setAvailablePorts(ports)
  }

  async function handleToggle(): Promise<void> {
    setError(null)
    if (status === SerialStatus.Open) {
      await window.labtool.closeAssistant()
    } else {
      const r = await window.labtool.openAssistant(cfg)
      if (!r.ok) setError(r.error ?? 'open failed')
    }
  }

  function parseInput(text: string): { buf: number[]; error?: string } {
    const trimmed = text.trim()
    if (!trimmed) return { buf: [], error: 'empty' }
    // 尝试 hex
    const noSpace = trimmed.replace(/\s+/g, '')
    if (/^[0-9A-Fa-f]+$/.test(noSpace) && noSpace.length % 2 === 0) {
      const out: number[] = []
      for (let i = 0; i < noSpace.length; i += 2) {
        out.push(parseInt(noSpace.slice(i, i + 2), 16))
      }
      return { buf: out }
    }
    // 退路：UTF-8
    const u = new TextEncoder().encode(trimmed + '\r\n')
    return { buf: Array.from(u) }
  }

  async function handleSend(): Promise<void> {
    if (status !== SerialStatus.Open) {
      setError(t('assistant.errorNotOpen'))
      return
    }
    const text = txInputRef.current?.value ?? ''
    const r = parseInput(text)
    if (r.error === 'empty') return
    if (r.error) {
      setError(r.error)
      return
    }
    const hex = r.buf.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
    const r2 = await window.labtool.writeAssistant(hex)
    if (!r2.ok) {
      setError(r2.error ?? 'send failed')
      return
    }
    setTxBytes((n) => n + (r2.written ?? r.buf.length))
    lastTxRef.current = text
    // 清空发送框（保留历史可加 ↑↓ 键）
    if (txInputRef.current) txInputRef.current.value = ''
    // 回显到接收区
    setRxBuf((prev) => {
      const next = prev.concat(r.buf)
      return next.length > MAX_RENDER_BYTES ? next.slice(-MAX_RENDER_BYTES) : next
    })
  }

  function handleClear(): void {
    setRxBuf([])
  }

  async function handleCopy(): Promise<void> {
    const text = renderRx()
    if (!text) return
    try {
      // 优先用现代 Clipboard API；不可用时回退到临时 textarea + execCommand
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        ta.style.pointerEvents = 'none'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyFlash(true)
      setTimeout(() => setCopyFlash(false), 800)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const [copyFlash, setCopyFlash] = useState(false)

  function renderRx(): string {
    if (displayMode === 'hex') {
      // 每 16 字节一行
      const lines: string[] = []
      for (let i = 0; i < rxBuf.length; i += 16) {
        const slice = rxBuf.slice(i, i + 16)
        const hex = slice.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
        const ascii = slice.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('')
        lines.push(hex.padEnd(48, ' ') + '  | ' + ascii)
      }
      return lines.join('\n')
    }
    // ASCII
    const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(rxBuf))
    // 不可打印字符替换
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '·')
  }

  const isOpen = status === SerialStatus.Open

  return (
    <div className="assistant-panel">
      {/* 配置区 */}
      <div className="ap-config">
        <div className="sp-row">
          <label className="sp-label">{t('serial.portName')}</label>
          <select
            className="sp-select"
            value={cfg.portName}
            disabled={isOpen}
            onClick={() => void refreshPorts()}
            onChange={(e) => setCfg((c) => ({ ...c, portName: e.target.value }))}
          >
            {imu.availablePorts.length === 0 ? (
              <option value={cfg.portName}>{cfg.portName}</option>
            ) : (
              imu.availablePorts.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))
            )}
          </select>
        </div>
        <div className="sp-row">
          <label className="sp-label">{t('serial.baudRate')}</label>
          <select
            className="sp-select"
            value={cfg.baudRate}
            disabled={isOpen}
            onChange={(e) => setCfg((c) => ({ ...c, baudRate: Number(e.target.value) }))}
          >
            {BAUDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="sp-row">
          <label className="sp-label">{t('serial.dataBits')}</label>
          <select
            className="sp-select"
            value={cfg.dataBits}
            disabled={isOpen}
            onChange={(e) => setCfg((c) => ({ ...c, dataBits: Number(e.target.value) as 5 | 6 | 7 | 8 }))}
          >
            {DATA_BITS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <label className="sp-label small">{t('serial.stopBits')}</label>
          <select
            className="sp-select small"
            value={cfg.stopBits}
            disabled={isOpen}
            onChange={(e) => setCfg((c) => ({ ...c, stopBits: Number(e.target.value) as 1 | 2 | 3 }))}
          >
            {STOP_BITS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <label className="sp-label small">{t('serial.parity')}</label>
          <select
            className="sp-select small"
            value={cfg.parity}
            disabled={isOpen}
            onChange={(e) => setCfg((c) => ({ ...c, parity: Number(e.target.value) as 0 | 2 | 3 }))}
          >
            {PARITY.map((p) => (
              <option key={p} value={p}>
                {p === 0 ? t('serial.parity.none') : p === 2 ? t('serial.parity.even') : t('serial.parity.odd')}
              </option>
            ))}
          </select>
          <div className={'sp-led ' + (isOpen ? 'on' : 'off')} />
          <button
            className={'sp-btn ' + (isOpen ? 'close' : 'open')}
            onClick={() => void handleToggle()}
          >
            {isOpen ? t('serial.close') : t('serial.open')}
          </button>
        </div>
      </div>

      {/* 接收区 */}
      <div className="ap-rx">
        <div className="ap-rx-header">
          <span className="ap-section-title">▼ {t('assistant.receive')}</span>
          <span className="ap-rx-stats">
            {t('assistant.bytes')}: <b>{rxBytes}</b>
          </span>
          <div className="ap-mode-toggle">
            <button
              className={displayMode === 'hex' ? 'on' : ''}
              onClick={() => setDisplayMode('hex')}
            >HEX</button>
            <button
              className={displayMode === 'ascii' ? 'on' : ''}
              onClick={() => setDisplayMode('ascii')}
            >ASCII</button>
          </div>
          <button
            className={'ap-btn small' + (copyFlash ? ' copied' : '')}
            onClick={() => void handleCopy()}
            disabled={rxBuf.length === 0}
            title={t('assistant.copyHint')}
          >
            {copyFlash ? '✓ ' + t('assistant.copied') : t('assistant.copy')}
          </button>
          <button className="ap-btn small" onClick={handleClear}>
            {t('assistant.clear')}
          </button>
        </div>
        <pre className="ap-rx-area" ref={rxAreaRef}>
          {rxBuf.length === 0 ? (
            <span className="ap-rx-empty">{t('assistant.empty')}</span>
          ) : (
            renderRx()
          )}
        </pre>
      </div>

      {/* 发送区 */}
      <div className="ap-tx">
        <div className="ap-tx-header">
          <span className="ap-section-title">▲ {t('assistant.send')}</span>
          <span className="ap-tx-stats">
            {t('assistant.bytes')}: <b>{txBytes}</b>
          </span>
          <span className="ap-tx-hint">{t('assistant.sendHint')}</span>
          <button
            className="ap-btn primary"
            onClick={() => void handleSend()}
            disabled={!isOpen}
          >
            {t('assistant.sendBtn')} ⏎
          </button>
        </div>
        <textarea
          ref={txInputRef}
          className="ap-tx-input"
          rows={3}
          placeholder={t('assistant.sendPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
      </div>

      {error && <div className="ap-error">⚠ {error}</div>}
    </div>
  )
}
