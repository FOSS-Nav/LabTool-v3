/**
 * LabTool-V3 IMU 串口面板
 * 对应 V2 ui->setPort_combox/setBaud_combox/...
 * + switchSerialPort_btn + LED 灯
 */

import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SerialConfig, SerialStatus } from '@shared'
import { useT } from '../../i18n'
import './SerialPortPanel.css'

const BAUDS = ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600']
const DATA_BITS = ['8', '7', '6', '5']
const PARITY = [0, 2, 3] as const
const STOP_BITS = [1, 3, 2] as const

interface Props {
  onError(msg: string): void
  /** 打开串口前是否已确认协议帧 */
  frameConfirmed: boolean
}

export function SerialPortPanel({ onError, frameConfirmed }: Props): JSX.Element {
  const t = useT()
  const imu = useStore((s) => s.imu)
  const setImuConfig = useStore((s) => s.setImuConfig)
  const setAvailablePorts = useStore((s) => s.setAvailablePorts)
  const fields = useStore((s) => s.fields)
  const endian = useStore((s) => s.endian)
  const [localCfg, setLocalCfg] = useState<SerialConfig>({
    portName: imu.config?.portName ?? 'COM1',
    baudRate: imu.config?.baudRate ?? 115200,
    dataBits: imu.config?.dataBits ?? 8,
    parity: imu.config?.parity ?? 0,
    stopBits: imu.config?.stopBits ?? 1
  })

  useEffect(() => {
    if (imu.config) setLocalCfg(imu.config)
  }, [imu.config?.portName, imu.config?.baudRate])

  const isOpen = imu.status === SerialStatus.Open

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
        if (!frameConfirmed) {
          onError(t('serial.errorOpenFirst'))
          return
        }
        const { compileDescriptor } = await import('@shared')
        const desc = { fields, endian, derived: compileDescriptor(fields, endian).derived }
        setImuConfig(localCfg)
        const r = await window.labtool.openIMU(localCfg, desc)
        if (!r.ok) onError(r.error ?? 'Open failed')
      } else {
        await window.labtool.closeIMU()
      }
    } catch (e) {
      onError((e as Error).message)
    }
  }

  return (
    <div className="serial-panel">
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
        <button className="sp-refresh" onClick={() => void refreshPorts()} disabled={isOpen} title={t('serial.refreshPorts')}>↻</button>
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
        <label className="sp-label sp-label-small">{t('serial.stopBits')}</label>
        <select
          className="sp-select sp-select-small"
          value={localCfg.stopBits}
          disabled={isOpen}
          onChange={(e) => setLocalCfg((c) => ({ ...c, stopBits: Number(e.target.value) as 1 | 2 | 3 }))}
        >
          {STOP_BITS.map((b) => <option key={b} value={b}>{b}</option>)}
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

      <div className="sp-actions">
        <div className={'sp-led ' + (isOpen ? 'on' : 'off')} />
        <button
          className={'sp-btn ' + (isOpen ? 'close' : 'open')}
          onClick={() => void handleToggle()}
        >
          {isOpen ? t('serial.close') : t('serial.open')}
        </button>
      </div>

      {imu.error && <div className="sp-error">⚠ {imu.error}</div>}
    </div>
  )
}
