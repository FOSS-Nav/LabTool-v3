/**
 * LabTool-V3 GNSS 报文解析器
 * 对应 V2 gnss_parse.cpp 的四个解析函数。
 *
 * 支持：
 *   - $GPGGA / $GNGGA  定位质量/经纬度/海拔
 *   - $GPVTG / $GNVTG  航向/速度
 *   - #BESTVEL           NovAtel 速度
 *   - #BESTPOS           NovAtel 位置
 *
 * 与 V2 区别：不再返回 bool 标记"成功"，而是返回 null，
 * 上层代码自己过滤。失败的字段保留 0/''，与 V2 行为类似。
 */

import { GpggaData, GpvtgData, NovAPData, NovAVData } from '../types'

const PI = Math.PI
const DEG = PI / 180.0

function splitFields(s: string): string[] {
  return s.split(',')
}

/* ============================================================
 * GPGGA
 * 字段：$GPGGA,hhmmss.sss,ddmm.mmmm,N,dddmm.mmmm,E,f,x,satellites,HDOP,altitude,geoidHeight,,*cs
 * ============================================================ */
export function parseGPGGA(line: string): GpggaData | null {
  let body = line
  if (body.startsWith('$GPGGA,')) body = body.slice(7)
  else if (body.startsWith('$GNGGA,')) body = body.slice(7)
  else return null

  // 兼容 *checksum
  const star = body.indexOf('*')
  if (star >= 0) body = body.slice(0, star)
  // 兼容 \r\n 尾巴
  body = body.replace(/[\r\n]+$/, '')

  const f = splitFields(body)
  if (f.length < 14) return null

  const num = (s: string | undefined, fallback = 0): number => {
    if (s === undefined || s === '') return fallback
    const n = Number(s)
    return Number.isFinite(n) ? n : fallback
  }

  const latRaw = f[1] ?? ''
  const lonRaw = f[3] ?? ''
  const lat = num(latRaw.slice(0, 2)) + num(latRaw.slice(2)) / 60.0
  const lon = num(lonRaw.slice(0, 3)) + num(lonRaw.slice(3)) / 60.0

  return {
    utcTime: f[0] ?? '',
    latitude: lat,
    latitudeDirection: (f[2] === 'S' ? 'S' : 'N'),
    longitude: lon,
    longitudeDirection: (f[4] === 'W' ? 'W' : 'E'),
    fixQuality: num(f[5]),
    numSatellites: num(f[6]),
    hdop: num(f[7]),
    altitude: num(f[8]),
    geoidHeight: num(f[9])
  }
}

/* ============================================================
 * GPVTG
 * 字段：$GPVTG,<trueHeading>,T,<magHeading>,M,<speedKnots>,N,<speedKmh>,K
 * ============================================================ */
export function parseGPVTG(line: string): GpvtgData | null {
  let body = line
  if (body.startsWith('$GPVTG,')) body = body.slice(7)
  else if (body.startsWith('$GNVTG,')) body = body.slice(7)
  else return null

  const star = body.indexOf('*')
  if (star >= 0) body = body.slice(0, star)
  body = body.replace(/[\r\n]+$/, '')

  const f = splitFields(body)
  if (f.length !== 8) return null
  // V2 校验：1=T  3=M  5=N  7=K
  if (f[1] !== 'T' || f[3] !== 'M' || f[5] !== 'N' || f[7] !== 'K') return null

  const num = (s: string): number => {
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  return {
    trueHeading: num(f[0]),
    magneticHeading: num(f[2]),
    speedKnots: num(f[4]),
    speedKmh: num(f[6])
  }
}

/* ============================================================
 * NovAtel BESTVEL：#BESTVELA,...)
 * V2 字段下标：5=week, 6=second, 13=velocityH, 14=heading, 15=velocityU
 * ============================================================ */
export function parseNovAV(line: string): NovAVData | null {
  if (!line.startsWith('#BESTVEL')) return null
  const body = line.replace(/[\r\n]+$/, '')
  const f = splitFields(body)
  if (f.length < 16) return null

  const num = (s: string | undefined): number => {
    if (s === undefined) return 0
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  return {
    week: num(f[5]),
    second: num(f[6]),
    velocityH: num(f[13]),
    heading: num(f[14]),
    velocityU: num(f[15])
  }
}

/* ============================================================
 * NovAtel BESTPOS：#BESTPOSA,...
 * V2 期望 8 个字段：lat,lon,height,hdop,vdop,status,timestamp,...
 * ============================================================ */
export function parseNovAP(line: string): NovAPData | null {
  if (!line.startsWith('#BESTPOS')) return null
  const body = line.replace(/[\r\n]+$/, '')
  // V2 的 split 后 size == 8 即可
  const f = splitFields(body)
  if (f.length !== 8) return null

  const num = (s: string | undefined): number => {
    if (s === undefined) return 0
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  return {
    latitude: num(f[0]),
    longitude: num(f[1]),
    height: num(f[2]),
    hdop: num(f[3]),
    vdop: num(f[4]),
    status: num(f[5]) | 0,
    timestamp: f[6] ?? ''
  }
}

/* ============================================================
 * 报头探测 + 集成入口
 * ============================================================ */

export type GnssKind = 'GPGGA' | 'GPVTG' | 'BESTVEL' | 'BESTPOS'

export function detectGnssKind(line: string): GnssKind | null {
  if (line.startsWith('$GPGGA') || line.startsWith('$GNGGA')) return 'GPGGA'
  if (line.startsWith('$GPVTG') || line.startsWith('$GNVTG')) return 'GPVTG'
  if (line.startsWith('#BESTVEL')) return 'BESTVEL'
  if (line.startsWith('#BESTPOS')) return 'BESTPOS'
  return null
}

/**
 * V2 parseOrSaveDataTask_GNSS 的等价函数：
 * 输入多条报文，返回最新的 8 个标量。
 */
export function mergeGnssVec8(lines: string[]): {
  ve: number
  vn: number
  vu: number
  lat: number
  lng: number
  alt: number
  time: number
  hdop: number
} {
  let ve = 0,
    vn = 0,
    vu = 0,
    lat = 0,
    lng = 0,
    alt = 0,
    time = 0,
    hdop = 0

  for (const raw of lines) {
    const k = detectGnssKind(raw)
    if (k === null) continue
    if (k === 'GPGGA') {
      const d = parseGPGGA(raw)
      if (!d) continue
      lat = d.latitude
      lng = d.longitude
      alt = d.altitude
      time = Number(d.utcTime) || 0
      hdop = d.hdop
    } else if (k === 'GPVTG') {
      const d = parseGPVTG(raw)
      if (!d) continue
      const rad = d.trueHeading * DEG
      ve = (d.speedKmh / 3.6) * Math.sin(rad)
      vn = (d.speedKmh / 3.6) * Math.cos(rad)
      vu = 0
    } else if (k === 'BESTVEL') {
      const d = parseNovAV(raw)
      if (!d) continue
      const rad = d.heading * DEG
      ve = d.velocityH * Math.sin(rad)
      vn = d.velocityH * Math.cos(rad)
      vu = d.velocityU
    } else if (k === 'BESTPOS') {
      const d = parseNovAP(raw)
      if (!d) continue
      lat = d.latitude
      lng = d.longitude
      alt = d.height
      time = Number(d.timestamp) || 0
      hdop = d.hdop
    }
  }

  return { ve, vn, vu, lat, lng, alt, time, hdop }
}
