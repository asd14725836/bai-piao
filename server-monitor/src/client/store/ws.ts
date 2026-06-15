import type { WsStatus, BaseInfo, SystemStats, HistoryPoint, AgentInfo, LogEntry } from '@client/types/ws'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let started = false

const PING_MS = 25_000
const RECONNECT_MS = 3_000

export const useWsStore = defineStore('ws', () => {
  const status = ref<WsStatus>('closed')
  const onlineCount = ref(0)
  const baseInfo = ref<BaseInfo | null>(null)
  const latestStats = ref<SystemStats | null>(null)
  const statsHistory = ref<HistoryPoint[]>([])
  const agents = ref<AgentInfo[]>([])
  const signalLight = ref<string>('idle')
  const recentLogs = ref<LogEntry[]>([])

  function _connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${location.host}/api/ws`
    status.value = 'connecting'
    ws = new WebSocket(url)

    ws.onopen = () => {
      status.value = 'open'
      if (pingTimer) clearInterval(pingTimer)
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
        }
      }, PING_MS)
    }

    ws.onclose = () => {
      status.value = 'closed'
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(_connect, RECONNECT_MS)
    }

    ws.onerror = () => {}

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        switch (msg.type) {
          case 'online':
            onlineCount.value = msg.count ?? 0
            break
          case 'base_info':
            if (msg.data) baseInfo.value = msg.data as BaseInfo
            break
          case 'system_stats':
            if (msg.data) latestStats.value = msg.data as SystemStats
            break
          case 'stats_history':
            if (Array.isArray(msg.data)) statsHistory.value = msg.data as HistoryPoint[]
            break
          case 'agent_state':
            if (msg.agent) {
              const idx = agents.value.findIndex(a => a.name === msg.agent.name)
              if (idx >= 0) {
                agents.value[idx] = msg.agent as AgentInfo
              } else {
                agents.value.push(msg.agent as AgentInfo)
              }
            }
            break
          case 'signal_light':
            if (msg.aggregate) signalLight.value = msg.aggregate as string
            break
          case 'logs_history':
            if (Array.isArray(msg.logs)) recentLogs.value = msg.logs as LogEntry[]
            break
          case 'log_entry':
            if (msg.log) {
              recentLogs.value.unshift(msg.log as LogEntry)
              if (recentLogs.value.length > 200) recentLogs.value.length = 200
            }
            break
        }
      } catch {}
    }
  }

  function init() {
    if (started) return
    started = true
    _connect()
  }

  function send(payload: Record<string, unknown>) {
    if (status.value !== 'open' || !ws) return
    ws.send(JSON.stringify({ ...payload, ts: payload.ts ?? Date.now() }))
  }

  return {
    status,
    onlineCount,
    baseInfo,
    latestStats,
    statsHistory,
    agents,
    signalLight,
    recentLogs,
    init,
    send,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWsStore, import.meta.hot))
  import.meta.hot.dispose(() => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
    if (ws) {
      ws.onopen = null; ws.onclose = null; ws.onerror = null; ws.onmessage = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'hmr')
      }
      ws = null
    }
    started = false
  })
}
