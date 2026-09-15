/**
 * LabTool-V3 runtime 事件桥 hook
 *
 * 渲染端挂载时调用一次 useRuntimeEvents()，
 * 它负责：
 *   - 订阅 IPC 事件 → 更新 store
 *   - 启动时拉取一次串口列表
 *   - 切换 GNSS 位置/速度报文类型时通知主进程
 *   - GNSS 关闭时清空渲染端的 GNSS 衍生状态（轨迹、详情等）
 *
 * 注：GNSS 本地投影（east/north）的原点锁定现在统一在主进程的
 *     SerialManager 里维护，渲染端只把主进程算好的 east/north 推入 store，
 *     避免主/副两端各自维护一份 trace 状态导致原点漂移。
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { GnssPosMsg, GnssVelMsg } from '@shared'

// Window.labtool 类型由 src/preload/types.ts 全局声明
export { }

export function useRuntimeEvents(): void {
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

  /* GNSS 合并向量 + 本地投影 + 报文原始结果 */
  useEffect(() => {
    const off = window.labtool.onGnss((p) => {
      const s = useStore.getState()
      s.pushGnss(p.vec)
      s.pushGnssDetail(p.lastPos ?? null, p.lastVel ?? null)
      s.pushGnssTrace({ east: p.east, north: p.north })
    })
    return off
  }, [])

  /* GNSS 关闭时清空渲染端的衍生状态（轨迹、详情、合并向量） */
  useEffect(() => {
    const off = window.labtool.onSerialStatus((p) => {
      if (p.device === 'GNSS' && p.status === 'closed') {
        useStore.getState().clearGnss()
      }
    })
    return off
  }, [])

  /* GNSS 位置/速度报文类型变化 → 主进程 */
  const posMsg = useStore((s) => s.gnss.posMsg)
  const velMsg = useStore((s) => s.gnss.velMsg)
  useEffect(() => {
    void window.labtool.setGnssPosMsg(posMsg as GnssPosMsg)
  }, [posMsg])
  useEffect(() => {
    void window.labtool.setGnssVelMsg(velMsg as GnssVelMsg)
  }, [velMsg])
}
