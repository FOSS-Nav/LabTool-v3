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

import { GpggaData, GpvtgData, GnssLastPos, GnssLastVel, NovAPData, NovAVData } from '../types'

const PI = Math.PI
const DEG = PI / 180.0

function splitFields(s: string): string[] {
  return s.split(',')
}

/* ============================================================
 * GPGGA
 * 字段：$GPGGA,hhmmss.sss,ddmm.mmmm,N,dddmm.mmmm,E,f,x,satellites,HDOP,altitude,M,geoidHeight,M[,age[,diffId]]*cs
 *
 * V2 check 写的是 f.length < 14（包含 *cs 在内），但本函数先把
 * '*cs' 剥掉了，导致字段少 1 个。
 * 现实里很多 GNSS 接收机省略最后两个 age/diffId 字段，
 * 所以这里最少 9 个字段（time/lat/N/lng/E/qual/sats/hdop/alt）就能解析。
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
  // 至少需要 utcTime(0) + lat(1) + N(2) + lng(3) + E(4) + qual(5) + sats(6) + hdop(7) + alt(8) = 9 个字段
  if (f.length < 9) return null

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
    geoidHeight: num(f[10]) // f[9] 是 M 单位字符；真正的高度分离在 f[10]
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
 * V2 行为：去掉前缀 "$BESTPOS,"（V3 实际以 "#BESTPOSA" 开头；
 *        我们用 /#BESTPOS\w*,/ 匹配），然后 split 出 8 个字段
 *        lat,lon,height,hdop,vdop,status,timestamp[,]
 *
 * 注意：V3 早期实现忘了剥离前缀，导致把 "#BESTPOS" 当作纬度。
 * ============================================================ */
export function parseNovAP(line: string): NovAPData | null {
  if (!line.startsWith('#BESTPOS')) return null
  const body = line.replace(/[\r\n]+$/, '')
  // 去掉 "#BESTPOSA,"（也兼容 "#BESTPOS,"）
  const m = /^#BESTPOS\w*,/.exec(body)
  if (!m) return null
  const cleaned = body.slice(m[0].length)
  const f = splitFields(cleaned)
  // V2: split 后 size == 8；这里容许 7 或 8（末尾可能多一个空字段）
  if (f.length < 7) return null

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

/**
 * 提取"最近一次"的位置报文与速度报文原始解析结果。
 * 给数据表/详情面板用，比 mergeGnssVec8 多保留 kind-specific 字段。
 *
 * 输入多条报文 → 输出 { lastPos, lastVel }（可能为 undefined）。
 */
export function lastGnssPosVel(lines: string[]): {
  lastPos?: GnssLastPos
  lastVel?: GnssLastVel
} {
  let lastPos: GnssLastPos | undefined
  let lastVel: GnssLastVel | undefined
  for (const raw of lines) {
    const k = detectGnssKind(raw)
    if (k === null) continue
    if (k === 'GPGGA') {
      const d = parseGPGGA(raw)
      if (!d) continue
      lastPos = {
        kind: 'GPGGA',
        utcTime: d.utcTime,
        latitude: d.latitude,
        longitude: d.longitude,
        altitude: d.altitude,
        hdop: d.hdop,
        fixQuality: d.fixQuality,
        numSatellites: d.numSatellites,
        geoidHeight: d.geoidHeight,
        latitudeDirection: d.latitudeDirection,
        longitudeDirection: d.longitudeDirection
      }
    } else if (k === 'BESTPOS') {
      const d = parseNovAP(raw)
      if (!d) continue
      lastPos = {
        kind: 'BESTPOS',
        utcTime: '',
        latitude: d.latitude,
        longitude: d.longitude,
        altitude: d.height,
        hdop: d.hdop,
        vdop: d.vdop,
        status: d.status,
        timestamp: d.timestamp
      }
    } else if (k === 'GPVTG') {
      const d = parseGPVTG(raw)
      if (!d) continue
      lastVel = {
        kind: 'GPVTG',
        trueHeading: d.trueHeading,
        magneticHeading: d.magneticHeading,
        speedKnots: d.speedKnots,
        speedKmh: d.speedKmh
      }
    } else if (k === 'BESTVEL') {
      const d = parseNovAV(raw)
      if (!d) continue
      lastVel = {
        kind: 'BESTVEL',
        velocityH: d.velocityH,
        heading: d.heading,
        velocityU: d.velocityU,
        week: d.week,
        second: d.second
      }
    }
  }
  return { lastPos, lastVel }
}
