import type { Hono } from 'hono'
import type { WSContext } from 'hono/ws'
import type { AppBindings } from '@/lib/create-app'
import { createNodeWebSocket } from '@hono/node-ws'
import { logger } from '@/lib/logger'
import { getBaseInfo } from '@/lib/base-info'
import { getAllAgentStates } from './agent-state'
import {
  collectSystemStats,
  getHistory,
  startStatsPump,
  stopStatsPump,
} from '@/lib/system-stats'
import { pushLog, getRecentLogs, setBroadcastFn } from '@/lib/activity-log'

const STATS_INTERVAL_MS = 5000

// 暴露给其他模块的广播入口
let _wsBroadcast: ((p: Record<string, unknown>) => void) | null = null
export function broadcastToAll(payload: Record<string, unknown>) {
  _wsBroadcast?.(payload)
}

export function attachWebSocket(app: Hono<AppBindings>) {
  const log = logger.child('ws')
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

  const peers = new Map<WSContext, number>()
  const STALE_MS = 90_000

  function broadcast(payload: Record<string, unknown>) {
    const str = JSON.stringify(payload)
    for (const peer of peers.keys()) peer.send(str)
  }
  _wsBroadcast = broadcast

  // 任何 log entry 自动广播给所有 WS 客户端
  setBroadcastFn((entry) => {
    broadcast({ type: 'log_entry', log: entry })
  })

  function broadcastOnline() {
    broadcast({ type: 'online', count: peers.size, ts: Date.now() })
  }

  function touch(ws: WSContext) {
    peers.set(ws, Date.now())
  }

  // 任何 peer 在线时泵开
  function anyOnline(): boolean {
    return peers.size > 0
  }

  function evaluatePump() {
    if (anyOnline()) {
      startStatsPump(
        STATS_INTERVAL_MS,
        stats => broadcast({ type: 'system_stats', data: stats, ts: Date.now() }),
        anyOnline,
      )
    } else {
      stopStatsPump()
    }
  }

  // 僵尸连接清扫
  const sweepTimer = setInterval(() => {
    const now = Date.now()
    let removed = 0
    for (const [peer, last] of peers) {
      if (now - last > STALE_MS) {
        try { peer.close() } catch {}
        peers.delete(peer)
        removed++
      }
    }
    if (removed > 0) {
      log.info(`swept ${removed} stale connections, total=${peers.size}`)
      broadcastOnline()
      evaluatePump()
    }
  }, 30_000)
  sweepTimer.unref?.()

  // ─── WebSocket 路由 ───
  app.get(
    '/api/ws',
    upgradeWebSocket(() => ({
      onOpen(_evt, ws) {
        peers.set(ws, Date.now())
        log.info(`open, total=${peers.size}`)
        pushLog('connection', `新连接 (总数: ${peers.size})`)
        broadcastOnline()
        evaluatePump()
        // 推送一条最新 base_info
        getBaseInfo().then(info => {
          ws.send(JSON.stringify({ type: 'base_info', data: info, ts: Date.now() }))
        })
        // 推历史数据
        const history = getHistory()
        if (history.length > 0) {
          ws.send(JSON.stringify({ type: 'stats_history', data: history, ts: Date.now() }))
        }
        // 推送所有 agent 的当前状态
        const agents = getAllAgentStates()
        for (const agent of agents) {
          ws.send(JSON.stringify({ type: 'agent_state', agent, ts: Date.now() }))
        }
        // 推送最近活动日志
        const recentLogs = getRecentLogs(50)
        if (recentLogs.length > 0) {
          ws.send(JSON.stringify({ type: 'logs_history', logs: recentLogs, ts: Date.now() }))
        }
      },
      onMessage(_evt, ws) {
        touch(ws)
      },
      onClose(_evt, ws) {
        peers.delete(ws)
        log.info(`closed, total=${peers.size}`)
        pushLog('connection', `连接断开 (总数: ${peers.size})`)
        broadcastOnline()
        evaluatePump()
      },
      onError(evt, ws) {
        peers.delete(ws)
        log.warn(`error: ${String(evt)}`)
        pushLog('connection', `连接异常: ${String(evt).slice(0, 100)}`)
        broadcastOnline()
        evaluatePump()
      },
    })),
  )

  return injectWebSocket
}
