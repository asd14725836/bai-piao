import type { Hono } from 'hono'
import type { AppBindings } from '@/lib/create-app'

import { serve } from '@hono/node-server'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { config } from '@/config'
import { collectBaseInfo } from '@/lib/base-info'
import { loadHistory } from '@/lib/system-stats'
import createApp from '@/lib/create-app'
import { logger } from '@/lib/logger'
import { setupStatic } from '@/lib/static'
import { setupSpaFallback } from '@/lib/static'
import signalLight from './api/signal-light'
import health from './api/health'
import agentState from './api/agent-state'
import openclawMonitor from './api/openclaw-monitor'
import hermesMonitor from './api/hermes-monitor'
import disks from './api/disks'
import logs from './api/logs'
import { attachWebSocket } from './api/websocket'

// ============ 创建应用 ============
const app = createApp()

// 启动时异步采集主机信息进 cache + 加载历史 stats
void collectBaseInfo()
void loadHistory()

// 定义路由（health 路由在 health.ts 中定义，包含 /api/health 和 /api/api-pool）
const routes: Hono<AppBindings>[] = [
  health,
  signalLight,
  agentState,
  openclawMonitor,
  hermesMonitor,
  disks,
  logs,
]

// API 路由
routes.forEach(route => {
  app.route('/', route)
})

// 挂 WebSocket（必须在 serve 之前注册路由，serve 之后调用 injectWebSocket）
const injectWebSocket = attachWebSocket(app)

// 设置静态资源
setupStatic(app)

// 独立聊天页面路由
app.get('/chat', async (c) => {
  const htmlPath = path.resolve(process.env.HERMES_HOME || '/var/lib/hermes', 'chat.html')
  try {
    const content = readFileSync(htmlPath, 'utf-8')
    return c.html(content)
  } catch {
    return c.notFound()
  }
})

// SPA fallback (放在所有路由之后)
setupSpaFallback(app)

const port = config.PORT || (config.isDevelopment ? 3001 : 3000)
logger.info(`Server is running on http://0.0.0.0:${port}`)
logger.info(`WebSocket:  ws://0.0.0.0:${port}/api/ws`)

const server = serve({
  fetch: app.fetch,
  port,
})

// 把 ws 协议升级注入到底层 HTTP server
injectWebSocket(server)
