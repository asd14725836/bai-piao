export type LogType = 'system' | 'agent' | 'signal' | 'connection'

export interface LogEntry {
  id: number
  ts: number
  type: LogType
  message: string
}

const MAX_LOGS = 200
const logs: LogEntry[] = []
let nextId = 1

/** 注册日志广播回调（由 websocket.ts 在初始化时设置） */
let _broadcast: ((entry: LogEntry) => void) | null = null
export function setBroadcastFn(fn: (entry: LogEntry) => void) {
  _broadcast = fn
}

/** 推入一条新日志，超限时丢弃最旧条目 */
export function pushLog(type: LogType, message: string): LogEntry {
  const entry: LogEntry = { id: nextId++, ts: Date.now(), type, message }
  if (logs.length >= MAX_LOGS) logs.shift()
  logs.push(entry)
  _broadcast?.(entry)
  return entry
}

/** 获取最近 N 条日志 */
export function getRecentLogs(limit = 50): LogEntry[] {
  return logs.slice(-limit)
}

/** 清空所有日志 */
export function clearLogs(): void {
  logs.length = 0
  nextId = 1
}
