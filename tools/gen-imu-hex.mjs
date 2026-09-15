/**
 * LabTool-V3 IMU 测试数据生成器
 *
 * 按 V3 FrameEditor 默认帧格式生成 hex 测试数据：
 *   [EB 90] | uint32 LE timestamp | float32 LE × 6 | uint8 checksum
 *
 * 用法：node tools/gen-imu-hex.mjs
 */

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/* ============================================================
 * 与 V3 项目 src/shared/parser/sine.ts 的 packImuFrame 等价实现
 * 字段顺序、字节序、checksum 算法完全一致
 * ============================================================ */
function packImuFrame(values, sampleIndex, opts) {
  const chBytes = opts.channelBytes
  const tailBytes = opts.appendChecksum ? 1 : 0
  const size = opts.header.length + 4 + values.length * chBytes + tailBytes
  const buf = new Uint8Array(size)
  const view = new DataView(buf.buffer)
  let off = 0

  for (const b of opts.header) buf[off++] = b
  view.setUint32(off, opts.startTimestamp + sampleIndex, opts.endian === 'little')
  off += 4
  for (const v of values) {
    if (chBytes === 4) view.setFloat32(off, v, opts.endian === 'little')
    else view.setFloat64(off, v, opts.endian === 'little')
    off += chBytes
  }
  if (opts.appendChecksum) {
    let sum = 0
    for (let i = 0; i < off; i++) sum = (sum + buf[i]) & 0xff
    buf[off] = sum
  }
  return buf
}

/* ============================================================
 * Box-Muller 高斯白噪声（用于手动生成有噪声的测试样本）
 * ============================================================ */
function gaussianNoise(std = 1, mean = 0) {
  let u1 = Math.random()
  while (u1 === 0) u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return z0 * std + mean
}

/* ============================================================
 * 默认 IMU 配置（与 LabTool-test/src/main/sim/imu-sim.ts 一致）
 * ============================================================ */
const config = {
  header: [0xEB, 0x90],
  endian: 'little',
  channelBytes: 4,
  appendChecksum: true,
  startTimestamp: 0,
  channels: [
    { name: 'wx', amplitude: 0.01,  frequency: 0.5, phase: 0,             offset: 0,   noiseStd: 0 },
    { name: 'wy', amplitude: 0.02,  frequency: 0.3, phase: Math.PI / 2,   offset: 0,   noiseStd: 0 },
    { name: 'wz', amplitude: 0.005, frequency: 1.0, phase: Math.PI,       offset: 0,   noiseStd: 0 },
    { name: 'ax', amplitude: 0.1,   frequency: 2.0, phase: 0,             offset: 0,   noiseStd: 0 },
    { name: 'ay', amplitude: 0.15,  frequency: 1.5, phase: Math.PI / 4,   offset: 0,   noiseStd: 0 },
    { name: 'az', amplitude: 0.05,  frequency: 3.0, phase: Math.PI / 3,   offset: 1.0, noiseStd: 0 }
  ]
}

function computeSample(t, channels) {
  return channels.map((ch) => {
    const omega = 2 * Math.PI * ch.frequency
    return ch.amplitude * Math.sin(omega * t + ch.phase) + ch.offset
      + (ch.noiseStd > 0 ? gaussianNoise(ch.noiseStd) : 0)
  })
}

function toHex(bytes, withSpaces = true) {
  const sep = withSpaces ? ' ' : ''
  return Array.from(bytes).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(sep)
}

function annotate(frame, ts, values) {
  const header = `${frame[0].toString(16).toUpperCase().padStart(2, '0')} ${frame[1].toString(16).toUpperCase().padStart(2, '0')}`
  const tsBytes = Array.from(frame.slice(2, 6)).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
  const channels = []
  for (let i = 0; i < 6; i++) {
    const b = Array.from(frame.slice(6 + i * 4, 10 + i * 4))
      .map((x) => x.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ')
    channels.push(`${config.channels[i].name}=${b}`)
  }
  const cs = frame[frame.length - 1].toString(16).toUpperCase().padStart(2, '0')
  return {
    hex: toHex(frame),
    breakdown: `header=[${header}] ts=[${tsBytes}] = ${ts} | ${channels.join(' | ')} | cs=[${cs}] (总长 ${frame.length}B)`
  }
}

/* ============================================================
 * 输出
 * ============================================================ */
console.log('='.repeat(72))
console.log('LabTool-V3 IMU 测试数据生成器')
console.log('='.repeat(72))
console.log()
console.log('帧格式（与 V3 FrameEditor 一致）:')
console.log('  [EB 90] | [uint32 LE timestamp] | [float32 LE x 6] | [uint8 checksum]')
console.log('   2 字节 +      4 字节            +   24 字节     +    1 字节')
console.log('总长 31 字节')
console.log()
console.log('默认通道参数（与 LabTool-test imu-sim 一致）:')
for (const ch of config.channels) {
  console.log(`  ${ch.name.padEnd(4)} A=${ch.amplitude.toString().padEnd(7)} f=${ch.frequency}Hz  phi=${(ch.phase * 180 / Math.PI).toFixed(1).padStart(5)}deg  offset=${ch.offset}`)
}
console.log()
console.log('─'.repeat(72))
console.log('1. 单帧示例（t = 0.05s，timestamp = 0）')
console.log('─'.repeat(72))

const t0 = 0.05
const v0 = computeSample(t0, config.channels)
const f0 = packImuFrame(v0, 0, config)
const a0 = annotate(f0, 0, v0)
console.log(`HEX:    ${a0.hex}`)
console.log(`拆解:   ${a0.breakdown}`)
console.log()

console.log('─'.repeat(72))
console.log('2. 单帧示例（t = 1.0s，timestamp = sampleIndex）')
console.log('─'.repeat(72))

let sampleIndex = 1
const t1 = 1.0
const v1 = computeSample(t1, config.channels)
const f1 = packImuFrame(v1, sampleIndex, config)
const a1 = annotate(f1, sampleIndex, v1)
console.log(`HEX:    ${a1.hex}`)
console.log(`拆解:   ${a1.breakdown}`)
console.log()

console.log('─'.repeat(72))
console.log('3. 连续 5 帧（100Hz 间隔，155 字节 = 31 x 5）')
console.log('─'.repeat(72))

const frames = []
for (let i = 0; i < 5; i++) {
  const t = 0.05 + i * 0.01
  const values = computeSample(t, config.channels)
  sampleIndex++
  frames.push(packImuFrame(values, sampleIndex, config))
}
const concat = Buffer.concat(frames)
console.log('5 帧拼接:')
console.log(toHex(concat))
console.log()
console.log('单帧 HEX（可单独复制测试）:')
frames.forEach((b, i) => {
  console.log(`  [${i}]  ${toHex(b)}`)
})
console.log()

console.log('─'.repeat(72))
console.log('4. 边界值测试')
console.log('─'.repeat(72))

{
  const f = packImuFrame([0, 0, 0, 0, 0, 0], 0, config)
  console.log(`ts=0 全零通道:    ${toHex(f)}`)
}
{
  const f = packImuFrame([0, 0, 0, 0, 0, 0], 1, config)
  console.log(`ts=1:             ${toHex(f)}`)
}
{
  const f = packImuFrame([0, 0, 0, 0, 0, 0], 0xFFFFFFFF, config)
  console.log(`ts=0xFFFFFFFF:    ${toHex(f)}`)
}
{
  // 关闭 checksum
  const cfg2 = { ...config, appendChecksum: false }
  const f = packImuFrame([1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 100, cfg2)
  console.log(`no-checksum:      ${toHex(f)}`)
}
console.log()

console.log('─'.repeat(72))
console.log('5. 简单 C 数组（直接复制）')
console.log('─'.repeat(72))
console.log()
console.log('// LabTool-V3 IMU 测试数据（31 字节/帧）')
console.log('// 帧格式: [EB 90] [uint32 LE ts] [float32 LE x 6] [uint8 cs]')
console.log('// 通道顺序: wx wy wz ax ay az')
console.log()
console.log('// 单帧:')
const t0str = toHex(f0, false)
const t1str = toHex(f1, false)
console.log(`// t=0.05s, ts=0    : ${t0str}`)
console.log(`// t=1.00s, ts=1    : ${t1str}`)
console.log()
console.log('// 5 帧拼接（连续发送测试）:')
const burstStr = toHex(concat, false)
console.log(`// ${burstStr}`)
console.log()

/* ============================================================
 * 写出二进制文件
 * ============================================================ */
const outDir = join(ROOT, 'out')
const outFile = join(outDir, 'imu-test-data.bin')
writeFileSync(outFile, concat)
console.log('─'.repeat(72))
console.log('6. 二进制文件')
console.log('─'.repeat(72))
console.log(`路径: ${outFile}`)
console.log(`大小: ${concat.length} 字节 (5 帧)`)
console.log()
console.log('用串口调试工具（SSCOM、PuTTY、XCOM 等）打开此二进制，')
console.log('逐字节发送到 V3 IMU 串口（COMx），即可触发解析。')
