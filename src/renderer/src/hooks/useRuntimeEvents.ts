/**
 * LabTool-V3 runtime 事件桥 hook
 *
 * 渲染端挂载时调用一次 useRuntimeEvents()，
 * 它负责：
 *   - 订阅 IPC 事件 → 更新 store
 *   - 启动时拉取一次串口列表
 *   - 切换 GNSS 量测类型时通知主进程
 */

import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { GnssMeasType } from '@shared'
import { createTraceState, updateTrace } from '@shared/gnss/trace'

// Window.labtool 类型由 src/preload/types.ts 全局声明
export { }

export function useRuntimeEvents(): void {
  const traceStateRef = useRef(createTraceState())
  const lastGnss = useStore((s) => s.lastGnss)
  const gnssMeasType = useStore((s) => s.gnss.measType)

  /* 初始化：拉取串口列表 */
  useEffect(() => {
    void window.labtool.listPorts().then((ports) => {
      useStore.getState().setAvailablePorts(ports)
    })
    const onErr = (p: { device?: string; message: string }): void => {
      // 这里只 console；UI 已经在 SerialStatusChanged 中处理具体状态
      console.error('[main error]', p)
    }
    const offErr = window.labtool.onError(onErr)

    return () => {
      offErr()
    }
  }, [])

  /* 串口状态 */
  useEffect(() => {
    const off = window.labtool.onSerialStatus((p) => {
      if (p.device === 'IMU') useStore.getState().setImuStatus(p.status, p.error)
      else useStore.getState().setGnssStatus(p.status, p.error)
    })
    return off
  }, [])

  /* IMU 解析帧 */
  useEffect(() => {
    const off = window.labtool.onFrames((p) => {
      useStore.getState().pushFrames(p.frames)
    })
    return off
  }, [])

  /* GNSS 合并向量 */
  useEffect(() => {
    const off = window.labtool.onGnss((p) => {
      useStore.getState().pushGnss(p.vec)
      const projected = updateTrace(traceStateRef.current, p.vec.lat, p.vec.lng)
      useStore.getState().pushGnssTrace(projected)
    })
    return off
  }, [])

  /* GNSS 量测类型变化 → 主进程 */
  useEffect(() => {
    void window.labtool.setGnssMeasType(gnssMeasType as GnssMeasType)
  }, [gnssMeasType])

  /* 关闭串口时重置轨迹原点 */
  useEffect(() => {
    if (!lastGnss) return
  }, [lastGnss])
}
