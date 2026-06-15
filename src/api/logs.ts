import { createRouter } from '@/lib/create-app'
import { getRecentLogs, clearLogs } from '@/lib/activity-log'

const router = createRouter()

// GET /api/logs/recent?limit=50 — 获取最近活动日志
router.get('/api/logs/recent', c => {
  const limitStr = c.req.query('limit')
  const limit = limitStr ? Math.min(Math.max(Number(limitStr) || 50, 1), 200) : 50
  return c.json({ logs: getRecentLogs(limit) })
})

// POST /api/logs/clear — 清空活动日志
router.post('/api/logs/clear', c => {
  clearLogs()
  return c.json({ ok: true })
})

export default router
