import { createRouter } from '@/lib/create-app'

interface ApiKey {
  id: string
  key: string
  model: string
  status: 'available' | 'failed' | 'rate_limited'
  last_tested: string
  response_time: number
  test_result: string
}

interface ApiPoolResponse {
  endpoint: string
  last_updated: string
  total_keys: number
  available_keys: number
  keys: ApiKey[]
}

const router = createRouter()

// 密钥池数据（从文件读取，无数据时使用空示例）
let apiPoolData: ApiPoolResponse = {
  endpoint: 'https://api.example.com/v1',
  last_updated: new Date().toISOString(),
  total_keys: 0,
  available_keys: 0,
  keys: []
}

// 获取密钥池
router.get('/api/api-pool', async (c) => {
  return c.json(apiPoolData)
})

// 刷新密钥池（触发重新测试）
router.post('/api/api-pool/refresh', async (c) => {
  // 这里可以添加重新测试的逻辑
  apiPoolData.last_updated = new Date().toISOString()
  return c.json({ success: true, message: '刷新已触发', last_updated: apiPoolData.last_updated })
})

export default router
