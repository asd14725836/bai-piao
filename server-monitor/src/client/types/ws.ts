/**
 * WebSocket 相关类型
 */
export type WsStatus = 'connecting' | 'open' | 'closed'

export interface BaseInfo {
  hostname: string
  platform: string
  arch: string
  osName: string
  osVersion: string
  cpuCores: number
  memoryGB: number
  bootTime: number
  uptimeMs: number
  serverStartedAt: number
}

export interface SystemStats {
  cpu: { usage: number; cores: number }
  memory: { totalGB: number; usedGB: number; usedPct: number; swapTotalGB?: number; swapUsedGB?: number; buffersGB?: number; cachedGB?: number; sReclaimableGB?: number; shmemGB?: number }
  disk: { totalGB: number; usedGB: number; availGB: number; usedPct: number }
  network: { rxKBs: number; txKBs: number; iface: string }
  uptime: number
  loadAvg: number[]
}

export interface HistoryPoint {
  ts: number
  cpu: number
  mem: number
  rx: number
  tx: number
}

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'blocked' | 'attention' | 'off'

export interface AgentInfo {
  name: string
  status: AgentStatus
  message?: string
  updatedAt: number
}

export type LogType = 'system' | 'agent' | 'signal' | 'connection' | 'error'

export interface LogEntry {
  id: number
  ts: number
  type: LogType
  message: string
}
