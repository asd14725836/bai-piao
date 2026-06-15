import { createRouter } from '@/lib/create-app'
import { logger } from '@/lib/logger'
import { broadcastToAll } from './websocket'
import { pushLog } from '@/lib/activity-log'

const log = logger.child('agent-state')

// ─── Agent 状态常量 ───
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'blocked' | 'attention' | 'off'

interface AgentEntry {
  name: string
  status: AgentStatus
  message?: string
  updatedAt: number
}

const agents: Record<string, AgentEntry> = {}

// 导出获取所有 agent 状态的函数，供 websocket.ts 在 onOpen 时调用
export function getAllAgentStates(): AgentEntry[] {
  // 清理超过 5 分钟未更新的僵尸
  const now = Date.now()
  for (const [k, v] of Object.entries(agents)) {
    if (now - v.updatedAt > 5 * 60 * 1000) delete agents[k]
  }
  return Object.values(agents)
}

const router = createRouter()

// PATCH /api/agent-state/:name — Agent 上报状态
router.patch('/api/agent-state/:name', async c => {
  const name = c.req.param('name')
  if (!name) return c.json({ error: 'missing_name' }, 400)

  let body: any
  try { body = await c.req.json() }
  catch { return c.json({ error: 'invalid_json' }, 400) }

  const status = String(body?.status ?? '').trim()
  if (!status) return c.json({ error: 'missing_status' }, 400)
  if (!['idle', 'thinking', 'working', 'blocked', 'attention', 'off'].includes(status)) {
    return c.json({ error: 'invalid_status' }, 400)
  }

  const now = Date.now()
  const prev = agents[name]
  agents[name] = {
    name,
    status: status as AgentStatus,
    message: body?.message ? String(body.message).slice(0, 200) : undefined,
    updatedAt: now,
  }

  // 只在状态真正变化时记录日志
  if (!prev || prev.status !== status) {
    const msg = body?.message ? ` (${String(body.message).slice(0, 60)})` : ''
    pushLog('agent', `Agent ${name} → ${status}${msg}`)
  }

  // 广播给前端
  broadcastToAll({
    type: 'agent_state',
    agent: agents[name],
    ts: now,
  })

  log.info(`agent=${name} status=${status}`)
  return c.json({ ok: true, agent: agents[name] })
})

// GET /api/agent-state — 查询所有 Agent 状态
router.get('/api/agent-state', async c => {
  // 清理超过 5 分钟未更新的僵尸
  const now = Date.now()
  for (const [k, v] of Object.entries(agents)) {
    if (now - v.updatedAt > 5 * 60 * 1000) delete agents[k]
  }
  return c.json({ agents: Object.values(agents) })
})

export default router
