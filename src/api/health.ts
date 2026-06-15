import { createRouter } from '@/lib/create-app'
import { readFileSync, existsSync } from 'fs'

const POOL_PATH = process.env.API_POOL_PATH || '/var/lib/hermes/api_pool.json'

function loadPool() {
  try {
    if (!existsSync(POOL_PATH)) return null
    const raw = readFileSync(POOL_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const router = createRouter()

// Health 路由（含apiPool摘要，不含完整密钥）
router.get('/api/health', (c) => {
  const pool = loadPool()
  const summary = pool ? {
    endpoint: pool.api_endpoint,
    last_updated: pool.last_updated,
    total_keys: pool.total_keys ?? pool.keys.length,
    available_keys: pool.available_keys ?? pool.keys.filter((k:any) => k.status === 'available').length,
    keys: pool.keys.map((k:any, i:number) => ({
      id: `key-${i + 1}`,
      key_preview: k.key.slice(0, 8) + '...' + k.key.slice(-4),
      model: k.model,
      model_name: k.model_name || k.model,
      company: k.company || '',
      description: k.description || '',
      status: k.status,
      last_tested: k.last_tested,
      response_time: k.response_time,
      test_result: k.test_result
    }))
  } : { endpoint: '', last_updated: '', total_keys: 0, available_keys: 0, keys: [] }

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    apiPool: summary
  })
})

// API池详情（用于前端备用池页面，含完整密钥可复制）
router.get('/api/api-pool', (c) => {
  const pool = loadPool()
  if (!pool) return c.json({ keys: [], last_updated: '', api_endpoint: '' })
  return c.json({
    endpoint: pool.api_endpoint,
    last_updated: pool.last_updated,
    keys: pool.keys.map((k:any, i:number) => ({
      id: `key-${i + 1}`,
      key: k.key,
      key_preview: k.key.slice(0, 8) + '...' + k.key.slice(-4),
      model: k.model,
      model_name: k.model_name || k.model,
      company: k.company || '',
      description: k.description || '',
      status: k.status,
      last_tested: k.last_tested,
      response_time: k.response_time,
      test_result: k.test_result
    }))
  })
})

export default router
