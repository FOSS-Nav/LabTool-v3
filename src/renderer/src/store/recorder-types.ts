/** Recorder 状态类型（与主进程 RecorderState 对应） */

export interface RecorderState {
  baseName: string
  outDir: string
  imuHexPath: string
  gnssTxtPath: string | null
  parsedBinPath: string
  parsedTxtPath: string
  imuHexBytes: number
  gnssTxtBytes: number
  parsedBinFrames: number
  parsedTxtBytes: number
}
