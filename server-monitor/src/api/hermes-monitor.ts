import { createRouter } from '@/lib/create-app'
import { logger } from '@/lib/logger'
import { DatabaseSync } from 'node:sqlite'

const log = logger.child('hermes-monitor')

const STATE_DB = process.env.HERMES_STATE_DB || '/var/lib/hermes/state.db'
const CONFIG_FILE = process.env.HERMES_CONFIG || '/etc/hermes/config.yaml'
import { readFile } from 'node:fs/promises'

// ─── SQLite 连接 ───

function getDb() {
  try {
    return new DatabaseSync(STATE_DB, { open: true, readOnly: true })
  } catch (err) {
    log.warn('Failed to open state.db', { err })
    return null
  }
}

// ─── 时间窗口 ───

function getTimeRange(period: string): { from: number, to: number } {
  const now = Date.now() / 1000
  if (period === 'month') {
    const d = new Date()
    const from = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime() / 1000
    return { from, to: now }
  }
  // today
  const d = new Date()
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime() / 1000
  return { from, to: now }
}

// ─── Config 解析 ───

async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8')

    const getModel = () => {
      const m = raw.match(/^  default:\s*(.+)$/m)
      return m?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? 'unknown'
    }

    const getProvider = () => {
      const lines = raw.split('\n')
      let inModel = false
      for (const line of lines) {
        if (/^model:\s*$/.test(line.trim())) {
          inModel = true
          continue
        }
        if (inModel && /^\w/.test(line) && !line.startsWith(' ')) {
          inModel = false
          continue
        }
        if (inModel) {
          const m = line.trim().match(/^provider:\s*(.+)$/)
          if (m) return m[1].trim().replace(/^['"]|['"]$/g, '')
        }
      }
      return 'unknown'
    }

    const getMaxTurns = () => {
      const m = raw.match(/max_turns:\s*(\d+)/)
      return m ? Number.parseInt(m[1], 10) : 30
    }

    return {
      model: getModel(),
      provider: getProvider(),
      maxTurns: getMaxTurns(),
      contextWindow: null as number | null,
    }
  }
  catch (err) {
    log.warn('Failed to read config.yaml', { err })
    return { model: 'unknown', provider: 'unknown', maxTurns: 30, contextWindow: null }
  }
}

// ─── 路由 ───

const router = createRouter()

// GET /api/hermes/stats?period=today|month — Token 消耗统计
router.get('/api/hermes/stats', async (c) => {
  const period = c.req.query('period') ?? 'today'
  const { from, to } = getTimeRange(period)

  const db = getDb()
  if (!db) {
    return c.json({ totalInput: 0, totalOutput: 0, totalCache: 0, totalTokens: 0, avgTokensPerTurn: 0, estimatedCost: 0, byPlatform: [] })
  }

  try {
    const stmt = db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as totalInput,
        COALESCE(SUM(output_tokens), 0) as totalOutput,
        COALESCE(SUM(cache_read_tokens), 0) as totalCache,
        COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens), 0) as totalTokens,
        COALESCE(SUM(reasoning_tokens), 0) as totalReasoning,
        COALESCE(SUM(estimated_cost_usd), 0) as totalCost,
        COUNT(*) as sessionCount,
        COALESCE(SUM(message_count), 0) as totalMessages,
        COALESCE(SUM(tool_call_count), 0) as totalToolCalls
      FROM sessions
      WHERE started_at >= ? AND started_at <= ?
    `)
    const row = stmt.get(from, to) as any

    // 按平台分组
    const platStmt = db.prepare(`
      SELECT source, COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens), 0) as tokens
      FROM sessions
      WHERE started_at >= ? AND started_at <= ?
      GROUP BY source
      ORDER BY tokens DESC
    `)
    const platforms = platStmt.all(from, to) as any[]
    const byPlatform = platforms.map((p: any) => ({
      platform: p.source,
      tokens: p.tokens,
    }))

    // 按模型分组
    const modelStmt = db.prepare(`
      SELECT model, COUNT(*) as count, COALESCE(SUM(input_tokens + output_tokens), 0) as tokens
      FROM sessions
      WHERE started_at >= ? AND started_at <= ?
      GROUP BY model
      ORDER BY tokens DESC
    `)
    const models = modelStmt.all(from, to) as any[]

    const avgTokensPerTurn = row.sessionCount > 0 ? Math.round(row.totalTokens / row.sessionCount) : 0

    return c.json({
      totalInput: row.totalInput,
      totalOutput: row.totalOutput,
      totalCache: row.totalCache,
      totalTokens: row.totalTokens,
      totalReasoning: row.totalReasoning,
      avgTokensPerTurn,
      estimatedCost: Math.round(row.totalCost * 10000) / 10000,
      sessionCount: row.sessionCount,
      totalMessages: row.totalMessages,
      totalToolCalls: row.totalToolCalls,
      byPlatform,
      byModel: models,
    })
  } catch (err) {
    log.warn('Failed to query stats', { err })
    return c.json({ totalInput: 0, totalOutput: 0, totalCache: 0, totalTokens: 0, avgTokensPerTurn: 0, estimatedCost: 0, byPlatform: [] })
  }
})

// GET /api/hermes/sessions — 活跃会话列表（微信对话优先）
router.get('/api/hermes/sessions', async (c) => {
  const db = getDb()
  if (!db) {
    return c.json({ sessions: [] })
  }

  const sourceFilter = c.req.query('source') ?? ''

  try {
    let stmt
    let rows: any[]

    if (sourceFilter) {
      stmt = db.prepare(`
        SELECT id, source, model, input_tokens, output_tokens, cache_read_tokens,
               reasoning_tokens, message_count, tool_call_count,
               estimated_cost_usd, started_at, ended_at
        FROM sessions
        WHERE source = ?
        ORDER BY started_at DESC
        LIMIT 20
      `)
      rows = stmt.all(sourceFilter) as any[]
    } else {
      // 优先返回非cron会话，再补cron
      stmt = db.prepare(`
        SELECT id, source, model, input_tokens, output_tokens, cache_read_tokens,
               reasoning_tokens, message_count, tool_call_count,
               estimated_cost_usd, started_at, ended_at
        FROM sessions
        WHERE source != 'cron'
        ORDER BY started_at DESC
        LIMIT 20
      `)
      const imRows = stmt.all() as any[]

      stmt = db.prepare(`
        SELECT id, source, model, input_tokens, output_tokens, cache_read_tokens,
               reasoning_tokens, message_count, tool_call_count,
               estimated_cost_usd, started_at, ended_at
        FROM sessions
        WHERE source = 'cron'
        ORDER BY started_at DESC
        LIMIT ?
      `)
      const cronRows = stmt.all(Math.max(0, 20 - imRows.length)) as any[]

      rows = [...imRows, ...cronRows]
    }

    const sessions = rows.map((s: any) => ({
      key: s.id,
      platform: s.source,
      model: s.model,
      tokens: s.input_tokens + s.output_tokens + s.cache_read_tokens,
      inputTokens: s.input_tokens,
      outputTokens: s.output_tokens,
      cacheTokens: s.cache_read_tokens,
      reasoningTokens: s.reasoning_tokens,
      messages: s.message_count,
      toolCalls: s.tool_call_count,
      cost: s.estimated_cost_usd,
      started: new Date(s.started_at * 1000).toISOString(),
      ended: s.ended_at ? new Date(s.ended_at * 1000).toISOString() : null,
      active: !s.ended_at,
    }))

    return c.json({ sessions })
  } catch (err) {
    log.warn('Failed to query sessions', { err })
    return c.json({ sessions: [] })
  }
})

// GET /api/hermes/model — 当前模型状态
router.get('/api/hermes/model', async (c) => {
  const config = await loadConfig()
  return c.json(config)
})

// ─── Range 解析 ───

const RANGE_SECONDS: Record<string, number> = {
  '6h': 21_600,
  '24h': 86_400,
  '7d': 604_800,
  '30d': 2_592_000,
}

const HOUR_SQL = `
  SELECT
    strftime('%s', strftime('%Y-%m-%d %H:00:00', started_at, 'unixepoch')) as bucket_ts,
    COALESCE(SUM(input_tokens), 0) as input,
    COALESCE(SUM(output_tokens), 0) as output,
    COALESCE(SUM(cache_read_tokens), 0) as cache
  FROM sessions
  WHERE started_at >= ? AND started_at <= ?
  GROUP BY strftime('%Y-%m-%d %H:00:00', started_at, 'unixepoch')
  ORDER BY bucket_ts ASC
`

const DAY_SQL = `
  SELECT
    strftime('%s', date(started_at, 'unixepoch')) as bucket_ts,
    COALESCE(SUM(input_tokens), 0) as input,
    COALESCE(SUM(output_tokens), 0) as output,
    COALESCE(SUM(cache_read_tokens), 0) as cache
  FROM sessions
  WHERE started_at >= ? AND started_at <= ?
  GROUP BY date(started_at, 'unixepoch')
  ORDER BY bucket_ts ASC
`

// GET /api/hermes/token-trend?granularity=hour|day&range=24h|7d|30d — Token 消耗趋势
router.get('/api/hermes/token-trend', async (c) => {
  const granularity = c.req.query('granularity') ?? 'hour'
  const range = c.req.query('range') ?? '24h'

  const rangeSeconds = RANGE_SECONDS[range] ?? 86_400
  const now = Math.floor(Date.now() / 1000)
  const from = now - rangeSeconds
  const to = now

  const db = getDb()
  if (!db) {
    return c.json({ granularity, points: [] })
  }

  try {
    const sql = granularity === 'day' ? DAY_SQL : HOUR_SQL
    const stmt = db.prepare(sql)
    const rows = stmt.all(from, to) as any[]

    const points = rows.map((r: any) => ({
      ts: Number(r.bucket_ts),
      input: r.input,
      output: r.output,
      cache: r.cache,
    }))

    return c.json({ granularity, points })
  } catch (err) {
    log.warn('Failed to query token trend', { err })
    return c.json({ granularity, points: [] })
  }
})

export default router
