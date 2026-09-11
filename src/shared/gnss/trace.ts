/**
 * LabTool-V3 GNSS 轨迹投影
 * 对应 V2 mapplot_update_scal：
 *   - 以第一点为原点
 *   - 用 WGS84 子午圈/卯酉圈半径近似把 lat/lng 转 local east/north（米）
 *   - 保留滑动窗口（最多 3600 点）
 */

const PI = Math.PI
const DEG = PI / 180.0
/** V2 固定 RMh = 6378136.46（与 WGS84 长半轴 a 相同） */
const RMh = 6378136.46

export interface GnssTraceState {
  /** 原点 */
  lat0: number
  lng0: number
  /** 动态计算的 clRNh = cos(lat0) * RMh */
  clRNh: number
  /** 是否已锁定原点 */
  locked: boolean
  /** 滑动窗口 */
  east: number[]
  north: number[]
}

export function createTraceState(): GnssTraceState {
  return {
    lat0: 0,
    lng0: 0,
    clRNh: 0,
    locked: false,
    east: [],
    north: []
  }
}

const MAX_POINTS = 3600

export function updateTrace(
  state: GnssTraceState,
  lat: number,
  lng: number
): { east: number; north: number } {
  if (!state.locked) {
    state.lat0 = lat
    state.lng0 = lng
    state.clRNh = Math.cos(lat * DEG) * RMh
    state.locked = true
  }

  const east = (state.lng0 - lng) * DEG * state.clRNh
  const north = (state.lat0 - lat) * DEG * RMh

  if (state.east.length >= MAX_POINTS) state.east.shift()
  if (state.north.length >= MAX_POINTS) state.north.shift()
  state.east.push(east)
  state.north.push(north)

  return { east, north }
}

export function resetTrace(state: GnssTraceState): void {
  state.lat0 = 0
  state.lng0 = 0
  state.clRNh = 0
  state.locked = false
  state.east.length = 0
  state.north.length = 0
}
