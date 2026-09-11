/**
 * LabTool-V3 GNSS 串口面板
 * 对应 V2 ui->setPort_combox_g + checkBox_active_gnss + meas_combox_g
 */

import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SerialConfig, SerialStatus, GnssMeasType } from '@shared'
import { useT } from '../../i18n'
import './GnssPortPanel.css'

const BAUDS = ['4800', '9600', '19200', '38400', '57600', '115200']
const DATA_BITS = ['8', '7', '6', '5']
const PARITY = [0, 2, 3] as const
const STOP_BITS = [1, 3, 2] as const

interface Props {
  onError(msg: string): void
}

export function GnssPortPanel({ onError }: Props): JSX.Element {
  const t = useT()
  const gnss = useStore((s) => s.gnss)
  const imu = useStore((s) => s.imu)
  const setGnssConfig = useStore((s) => s.setGnssConfig)
  const setGnssActive = useStore((s) => s.setGnssActive)
  const setGnssMeasType = useStore((s) => s.setGnssMeasType)
  const setAvailablePorts = useStore((s) => s.setAvailablePorts)

  const [localCfg, setLocalCfg] = useState<SerialConfig>({
    portName: gnss.config?.portName ?? 'COM3',
    baudRate: gnss.config?.baudRate ?? 38400,
    dataBits: gnss.config?.dataBits ?? 8,
    parity: gnss.config?.parity ?? 0,
    stopBits: gnss.config?.stopBits ?? 1
  })

  useEffect(() => {
    if (gnss.config) setLocalCfg(gnss.config)
  }, [gnss.config?.portName, gnss.config?.baudRate])

  const isOpen = gnss.status === SerialStatus.Open

  async function refreshPorts(): Promise<void> {
    const ports = await window.labtool.listPorts()
    setAvailablePorts(ports)
    if (ports.length > 0 && !ports.includes(localCfg.portName)) {
      setLocalCfg((c) => ({ ...c, portName: ports[0] }))
    }
  }

  async function handleToggle(): Promise<void> {
    try {
      if (!isOpen) {
        setGnssConfig(localCfg)
        const r = await window.labtool.openGNSS(localCfg)
        if (!r.ok) {
          onError(r.error ?? 'GNSS open failed')
        }
      } else {
        await window.labtool.closeGNSS()
      }
    } catch (e) {
      onError((e as Error).message)
    }
  }

  function handleActiveToggle(): void {
    setGnssActive(!gnss.active)
  }

  return (
    <div className="gnss-panel">
      <div className="gp-active-row">
        <label className="gp-active">
          <input
            type="checkbox"
            checked={gnss.active}
            onChange={handleActiveToggle}
            disabled={isOpen}
          />
          <span>{t('gnss.enable')}</span>
        </label>
        <span className="gp-hint">
          {gnss.active ? t('gnss.enableHintOn') : t('gnss.enableHintOff')}
        </span>
      </div>

      <div className="sp-row">
        <label className="sp-label">{t('serial.portName')}</label>
        <select
          className="sp-select"
          value={localCfg.portName}
          disabled={isOpen}
          onClick={() => void refreshPorts()}
          onChange={(e) => setLocalCfg((c) => ({ ...c, portName: e.target.value }))}
        >
          {imu.availablePorts.length === 0 ? (
            <option value={localCfg.portName}>{localCfg.portName}</option>
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
          value={localCfg.baudRate}
          disabled={isOpen}
          onChange={(e) => setLocalCfg((c) => ({ ...c, baudRate: Number(e.target.value) }))}
        >
          {BAUDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="sp-row">
        <label className="sp-label">{t('serial.dataBits')}</label>
        <select
          className="sp-select"
          value={localCfg.dataBits}
          disabled={isOpen}
          onChange={(e) => setLocalCfg((c) => ({ ...c, dataBits: Number(e.target.value) as 5 | 6 | 7 | 8 }))}
        >
          {DATA_BITS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="sp-row">
        <label className="sp-label">{t('serial.parity')}</label>
        <select
          className="sp-select"
          value={localCfg.parity}
          disabled={isOpen}
          onChange={(e) => setLocalCfg((c) => ({ ...c, parity: Number(e.target.value) as 0 | 2 | 3 }))}
        >
          {PARITY.map((p) => (
            <option key={p} value={p}>
              {p === 0 ? t('serial.parity.none') : p === 2 ? t('serial.parity.even') : t('serial.parity.odd')}
            </option>
          ))}
        </select>
      </div>

      <div className="sp-row">
        <label className="sp-label">{t('serial.stopBits')}</label>
        <select
          className="sp-select"
          value={localCfg.stopBits}
          disabled={isOpen}
          onChange={(e) => setLocalCfg((c) => ({ ...c, stopBits: Number(e.target.value) as 1 | 2 | 3 }))}
        >
          {STOP_BITS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="sp-row">
        <label className="sp-label">{t('gnss.measType')}</label>
        <select
          className="sp-select"
          value={gnss.measType}
          disabled={isOpen}
          onChange={(e) => setGnssMeasType(Number(e.target.value))}
        >
          <option value={GnssMeasType.VelPos}>{t('gnss.measType.velpos')}</option>
          <option value={GnssMeasType.OnlyPos}>{t('gnss.measType.onlypos')}</option>
        </select>
      </div>

      <div className="sp-actions">
        <div className={'sp-led ' + (isOpen ? 'on' : 'off')} />
        <button
          className={'sp-btn ' + (isOpen ? 'close' : 'open')}
          disabled={!gnss.active}
          onClick={() => void handleToggle()}
        >
          {isOpen ? t('serial.close') + ' GNSS' : t('serial.open') + ' GNSS'}
        </button>
      </div>

      {gnss.error && <div className="sp-error">⚠ {gnss.error}</div>}
    </div>
  )
}
