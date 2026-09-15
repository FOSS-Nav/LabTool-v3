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
export {};
