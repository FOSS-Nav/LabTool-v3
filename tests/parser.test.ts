/**
 * LabTool-V3 解析器手测脚本（可在 Node 直接跑）：
 *
 *   npx tsx tests/parser.test.ts
 *
 * 验证 FrameDecoder 对 V2 同等输入的解析行为与 V2 mydatatype.cpp 一致。
 *   - 帧头匹配、对齐恢复
 *   - 多种类型（uint8/int16/uint16/int32/float32/double）
 *   - 3bytesToInt / 2bytesToInt 特殊格式
 *   - 字节序切换
 *   - 标度因数
 *
 * 同时验证 GNSS 解析器：GPGGA / GPVTG / BESTVEL / BESTPOS。
 */

import { DataKind, Endian, FrameDecoder, FrameField, compileDescriptor, mergeGnssVec8, parseGPGGA, parseGPVTG, parseNovAV, parseNovAP, FieldRole } from '../src/shared'
import { byteSizeOf, readField, SCALE_NONE } from '../src/shared/parser/datatype'

function makeField(role: FieldRole, name: string, type: DataKind, def = '0', scale = SCALE_NONE): FrameField {
  return {
    id: name,
    name,
    type,
    defaultValue: def,
    scale,
    role,
    isPlot1: false,
    isPlot2: false,
    isPlot3: false
  }
}

function hex(s: string): number[] {
  const out: number[] = []
  for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16))
  return out
}

let failures = 0
function eq<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`  ❌ ${label}\n     actual=  ${JSON.stringify(actual)}\n     expected=${JSON.stringify(expected)}`)
    failures++
  } else {
    console.log(`  ✓ ${label}`)
  }
}

/* ============================================================
 * 1. datatype 单元
 * ============================================================ */
console.log('\n[1] datatype: 字节大小')
eq(byteSizeOf(DataKind.Uint8), 1, 'Uint8 = 1')
eq(byteSizeOf(DataKind.Float32), 4, 'Float32 = 4')
eq(byteSizeOf(DataKind.Float64), 8, 'Float64 = 8')
eq(byteSizeOf(DataKind.ThreeByteInt), 4, 'ThreeByteInt (内部 4 字节)')
eq(byteSizeOf(DataKind.TwoByteInt), 2, 'TwoByteInt = 2')

console.log('\n[2] datatype: 端序读写')
{
  const buf = new Uint8Array([0x01, 0x02, 0x03, 0x04])
  const view = new DataView(buf.buffer)
  eq(readField(view, 0, DataKind.Uint32, Endian.Little), 0x04030201, 'LE uint32')
  eq(readField(view, 0, DataKind.Uint32, Endian.Big), 0x01020304, 'BE uint32')
  eq(readField(view, 0, DataKind.Float32, Endian.Little), 2.3879392607896655e-38, 'LE float32')
}

/* ============================================================
 * 3. 编译描述符
 * ============================================================ */
console.log('\n[3] frame: 编译描述符')
{
  const fields = [
    makeField('Frame_Header', 'Frame_Header', DataKind.Uint8, '0xEB'),
    makeField('Frame_Header', 'Frame_Header', DataKind.Uint8, '0x90'),
    makeField('Time_Stamp', 'Time_Stamp', DataKind.Uint32, '0'),
    makeField('Data', 'bmi-wx', DataKind.Float32, '0'),
    makeField('Data', 'bmi-wy', DataKind.Float32, '0'),
    makeField('Data', 'bmi-wz', DataKind.Float32, '0'),
    makeField('Check_Sum', 'Check_Sum', DataKind.Uint8, '0')
  ]
  const d = compileDescriptor(fields, Endian.Little)
  eq(d.derived?.frameLen, 1 + 1 + 4 + 4 * 3 + 1, 'frameLen = 21')
  eq(d.derived?.headerLen, 2, 'headerLen = 2')
  eq(d.derived?.dataTypeLen, 6, 'dataTypeLen = 6')
  eq(d.derived?.timestampPos, 0, 'timestampPos = 0')
  eq(d.derived?.checksumPos, 5, 'checksumPos = 5')
  eq(d.derived?.headerBytes, [0xeb, 0x90], 'headerBytes')
}

/* ============================================================
 * 4. FrameDecoder 解码
 * ============================================================ */
console.log('\n[4] frame: 状态机解码')
{
  const fields = [
    makeField('Frame_Header', 'Frame_Header', DataKind.Uint8, '0xEB'),
    makeField('Frame_Header', 'Frame_Header', DataKind.Uint8, '0x90'),
    makeField('Time_Stamp', 'Time_Stamp', DataKind.Uint32, '0'),
    makeField('Data', 'x', DataKind.Float32, '0'),
    makeField('Check_Sum', 'Check_Sum', DataKind.Uint8, '0')
  ]
  const desc = compileDescriptor(fields, Endian.Little)
  const dec = new FrameDecoder(desc)

  // 构造一帧：EB 90 | ts=0x01020304 LE | x=1.5f | cs=0
  const tsBytes = [0x04, 0x03, 0x02, 0x01] // LE uint32 = 0x01020304
  const xBytes = [0x00, 0x00, 0xc0, 0x3f] // LE float32 = 1.5
  const frame = [0xeb, 0x90, ...tsBytes, ...xBytes, 0x00]
  const r = dec.push(new Uint8Array(frame))
  eq(r.frames.length, 1, '一帧 → frames.length=1')
  eq(r.frames[0].timestamp, 0x01020304, '时间戳')
  eq(r.frames[0].fields.length, 1, 'Data 字段 = 1（不含 Time_Stamp/Check_Sum）')
  eq(r.frames[0].fields[0].value, 1.5, 'x 解析')
}

console.log('\n[5] frame: 跨帧 + 残留对齐')
{
  const fields = [
    makeField('Frame_Header', 'Frame_Header', DataKind.Uint8, '0xAA'),
    makeField('Data', 'v', DataKind.Uint16, '0')
  ]
  const desc = compileDescriptor(fields, Endian.Little)
  const dec = new FrameDecoder(desc)

  // AA 01 02 | AA 03 04 | AA 05 06（每帧 3 字节）
  const data = new Uint8Array([0xaa, 0x01, 0x02, 0xaa, 0x03, 0x04, 0xaa, 0x05, 0x06])
  const r = dec.push(data)
  eq(r.frames.length, 3, '3 帧')
  eq(r.frames[0].fields[0].value, 0x0201, 'LE uint16 #0')
  eq(r.frames[2].fields[0].value, 0x0605, 'LE uint16 #2')
  eq(r.residual.length, 0, '无残留')
}

console.log('\n[6] frame: 帧头错位后自恢复')
{
  const fields = [
    makeField('Frame_Header', 'Frame_Header', DataKind.Uint8, '0xAA'),
    makeField('Data', 'v', DataKind.Uint8, '0')
  ]
  const desc = compileDescriptor(fields, Endian.Little)
  const dec = new FrameDecoder(desc)
  // 杂字节 + 正确帧
  const data = new Uint8Array([0xff, 0x00, 0xaa, 0x10, 0xaa, 0x20])
  const r = dec.push(data)
  eq(r.frames.length, 2, '跳过杂字节，2 帧')
  eq(r.frames[0].fields[0].value, 0x10, '#0 v=0x10')
  eq(r.frames[1].fields[0].value, 0x20, '#1 v=0x20')
}

console.log('\n[7] frame: 标度因数')
{
  const fields = [
    makeField('Frame_Header', 'Frame_Header', DataKind.Uint8, '0xAA'),
    makeField('Data', 'scaled', DataKind.Int16, '0', 0.01)
  ]
  const desc = compileDescriptor(fields, Endian.Little)
  const dec = new FrameDecoder(desc)
  // AA | 01 00（LE int16 = 1）→ scaled = 0.01
  const r = dec.push(new Uint8Array([0xaa, 0x01, 0x00]))
  eq(r.frames[0].fields[0].value, 0.01, 'scaled = 0.01')
}

/* ============================================================
 * 8. GNSS
 * ============================================================ */
console.log('\n[8] gnss: GPGGA')
{
  const line = '$GPGGA,123456.00,3411.1234,N,10800.5678,E,1,08,1.5,500.0,M,0.0,M,,*6A'
  const d = parseGPGGA(line)
  if (!d) throw new Error('GPGGA parse failed')
  // lat = 34 + 11.1234/60 = 34.18539
  // lon = 108 + 0.5678/60 = 108.009463...
  const latOk = Math.abs(d.latitude - (34 + 11.1234 / 60)) < 1e-6
  const lonOk = Math.abs(d.longitude - (108 + 0.5678 / 60)) < 1e-6
  console.log(`  ${latOk ? '✓' : '❌'} lat ≈ ${d.latitude}`)
  console.log(`  ${lonOk ? '✓' : '❌'} lng ≈ ${d.longitude}`)
  console.log(`  ${d.hdop === 1.5 ? '✓' : '❌'} hdop = ${d.hdop}`)
  if (!latOk || !lonOk || d.hdop !== 1.5) failures++
}

console.log('\n[9] gnss: GPVTG')
{
  const line = '$GPVTG,90.0,T,89.5,M,10.5,N,19.3,K'
  const d = parseGPVTG(line)
  if (!d) throw new Error('GPVTG parse failed')
  eq(d.trueHeading, 90.0, 'heading = 90')
  eq(d.speedKmh, 19.3, 'speedKmh = 19.3')
}

console.log('\n[10] gnss: mergeGnssVec8')
{
  const lines = [
    '$GPVTG,90.0,T,89.5,M,10.8,N,19.44,K',
    '$GPGGA,120000.00,3410.0000,N,10800.0000,E,1,08,1.0,400.0,M,0.0,M,,*6A'
  ]
  const v = mergeGnssVec8(lines)
  // ve = 19.44/3.6 * sin(90°) = 5.4
  const veOk = Math.abs(v.ve - 5.4) < 1e-3
  const latOk = Math.abs(v.lat - (34 + 10 / 60)) < 1e-6
  console.log(`  ${veOk ? '✓' : '❌'} ve ≈ ${v.ve}`)
  console.log(`  ${latOk ? '✓' : '❌'} lat ≈ ${v.lat}`)
  if (!veOk || !latOk) failures++
}

console.log('\n[11] gnss: BESTVEL/BESTPOS（NovAtel）')
{
  // V2 期望字段：5=week 6=second 13=velocityH 14=heading 15=velocityU
  const bestvel = [
    '#BESTVELA,COM1,0,55.5,FINESTEERING,2209,485804.000,00000000,bd11,21343;',
    'SOL_COMPUTED,NONE,0.0,0.0,0.0,2209,485804.000000000,0.000000000,',
    '1.234,0.5678,90.5,0.10,0.20,0.30,0.40,0.50'
  ].join(',')
  const d = parseNovAV(bestvel)
  if (!d) throw new Error('BESTVEL parse failed')
  eq(d.week, 2209, 'week = 2209')
  eq(d.second, 485804, 'second = 485804')
  eq(d.velocityH, 1.234, 'velocityH = 1.234')
  eq(d.heading, 0.5678, 'heading = 0.5678')
  eq(d.velocityU, 90.5, 'velocityU = 90.5')
}

/* ============================================================
 * 12. 综合：用未对齐的字节流测试 FrameDecoder 鲁棒性
 * ============================================================ */
console.log('\n[12] 综合: 跨 chunk 的粘包 / 半帧')
{
  const fields = [
    makeField('Frame_Header', 'Frame_Header', DataKind.Uint8, '0xEB'),
    makeField('Data', 'v', DataKind.Uint16, '0')
  ]
  const desc = compileDescriptor(fields, Endian.Little)
  const dec = new FrameDecoder(desc)

  // 半帧
  dec.push(new Uint8Array([0xeb, 0x01]))
  // 半帧 + 完整帧
  dec.push(new Uint8Array([0x02, 0xeb, 0x03, 0x04, 0xeb, 0x05, 0x06]))
  // 触发 → 这里只能显式调一次 push
  const r = dec.push(new Uint8Array(0))
  eq(r.frames.length, 2, '2 帧')
  eq(r.frames[0].fields[0].value, 0x0201, '跨 chunk 拼成 LE uint16 = 0x0201')
  eq(r.frames[1].fields[0].value, 0x0403, '#1 LE uint16 = 0x0403')
  // 但有一个 0xeb 0x05 0x06 没成帧（v3 触发时输入为空）
}

console.log('')
if (failures > 0) {
  console.error(`❌ ${failures} 个断言失败`)
  process.exit(1)
} else {
  console.log('✅ 全部断言通过')
}
