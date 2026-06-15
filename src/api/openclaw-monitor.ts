import { createRouter } from '@/lib/create-app'
import { logger } from '@/lib/logger'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const log = logger.child('openclaw-monitor')

const SESSIONS_DIR = process.env.OPENCLAW_SESSIONS || '/var/lib/openclaw/sessions'

// ─── 数据类型 ───

interface ToolCallRecord {
  ts: string
  toolName: string
  toolCallId: string
  isError: boolean
  error?: string
  usage?: { input: number, output: number, total: number, cost?: number }
  arguments?: Record<string, unknown>
  durationMs?: number
}

interface TrajectoryEvent {
  traceSchema: string
  type: string
  ts: string
  data: {
    usage?: { input: number, output: number, total: number, cost?: { total: number } }
    messagesSnapshot?: Message[]
    [key: string]: unknown
  }
}

interface Message {
  role: string
  toolCallId?: string
  toolName?: string
  isError?: boolean
  details?: { status?: string, error?: string }
  content?: Array<{ type: string, name?: string, id?: string, arguments?: Record<string, unknown>, text?: string }>
  timestamp?: number
  [key: string]: unknown
}

// ─── 文件解析 ───

async function loadToolCalls(sinceTs?: string): Promise<ToolCallRecord[]> {
  const records: ToolCallRecord[] = []

  let files: string[]
  try {
    const entries = await readdir(SESSIONS_DIR)
    files = entries.filter(f => f.endsWith('.trajectory.jsonl'))
  } catch (err) {
    log.warn('Failed to read sessions directory', { err })
    return records
  }

  for (const file of files) {
    let content: string
    try {
      content = await readFile(join(SESSIONS_DIR, file), 'utf-8')
    } catch (err) {
      log.warn(`Failed to read file ${file}`, { err })
      continue
    }

    const lines = content.split('\n').filter(l => l.trim())
    for (const line of lines) {
      let event: TrajectoryEvent
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }

      if (event.type !== 'model.completed') continue
      if (sinceTs && event.ts < sinceTs) continue

      const snapshot = event.data?.messagesSnapshot ?? []
      // 找到 toolResult 消息，建立 callId -> result 映射
      const resultMap = new Map<string, Message>()
      for (const msg of snapshot) {
        if (msg.role === 'toolResult' && msg.toolCallId) {
          resultMap.set(msg.toolCallId, msg)
        }
      }

      // 遍历所有 assistant 消息中的 toolCall
      for (const msg of snapshot) {
        if (msg.role !== 'assistant') continue
        const contents = msg.content ?? []
        for (const c of contents) {
          if (c.type !== 'toolCall') continue
          const callId = c.id ?? ''
          const result = resultMap.get(callId)
          const toolName = c.name ?? 'unknown'

          records.push({
            ts: event.ts,
            toolName,
            toolCallId: callId,
            isError: result?.isError ?? false,
            error: result?.details?.error,
            usage: event.data?.usage
              ? {
                  input: event.data.usage.input ?? 0,
                  output: event.data.usage.output ?? 0,
                  total: event.data.usage.total ?? 0,
                  cost: event.data.usage.cost?.total,
                }
              : undefined,
            arguments: c.arguments,
            durationMs: result?.timestamp ? result.timestamp - new Date(event.ts).getTime() : undefined,
          })
        }
      }
    }
  }

  // 按时间倒序
  records.sort((a, b) => b.ts.localeCompare(a.ts))
  return records
}

// ─── 时间窗口 ───

function getSinceTs(period: string): string | undefined {
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }
  if (period === '7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return start.toISOString()
  }
  return undefined
}

// ─── 路由 ───

const router = createRouter()

// GET /api/openclaw/stats?period=today|7d — 工具调用统计
router.get('/api/openclaw/stats', async (c) => {
  const period = c.req.query('period') ?? 'today'
  const sinceTs = getSinceTs(period)

  const records = await loadToolCalls(sinceTs)

  const total = records.length
  const errors = records.filter(r => r.isError).length
  const successRate = total > 0 ? Math.round(((total - errors) / total) * 10000) / 100 : 100
  let totalTokens = 0

  // 按工具名聚合
  const toolMap = new Map<string, { count: number, errors: number, tokens: number }>()
  for (const r of records) {
    const entry = toolMap.get(r.toolName) ?? { count: 0, errors: 0, tokens: 0 }
    entry.count++
    if (r.isError) entry.errors++
    if (r.usage?.total) entry.tokens += r.usage.total
    totalTokens += r.usage?.total ?? 0
    toolMap.set(r.toolName, entry)
  }

  const byTool = Array.from(toolMap.entries())
    .map(([name, stats]) => ({ name, count: stats.count, errors: stats.errors, tokens: stats.tokens }))
    .sort((a, b) => b.count - a.count)

  return c.json({ total, totalTokens, byTool, successRate, period })
})

// GET /api/openclaw/recent?limit=10 — 最近工具调用记录
router.get('/api/openclaw/recent', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? '10'), 100)
  const records = await loadToolCalls()

  const calls = records.slice(0, limit).map(r => ({
    ts: r.ts,
    tool: r.toolName,
    duration: r.durationMs ?? null,
    success: !r.isError,
    tokens: r.usage?.total ?? 0,
  }))

  return c.json({ calls })
})

// GET /api/openclaw/errors?limit=20 — 最近失败的工具调用
router.get('/api/openclaw/errors', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? '20'), 100)
  const records = await loadToolCalls()

  const errors = records
    .filter(r => r.isError)
    .slice(0, limit)
    .map(r => ({
      ts: r.ts,
      tool: r.toolName,
      error: r.error ?? 'unknown error',
      params: r.arguments ?? {},
    }))

  return c.json({ errors })
})

export default router
