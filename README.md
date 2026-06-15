# mini-watch · 服务监控面板

> 轻量级服务器监控面板，实时查看 CPU、内存、磁盘、Token 消耗和 Agent 状态。

## 功能

- 📊 **系统总览** — CPU/内存/磁盘仪表盘，实时刷新
- 🤖 **Agent 监控** — Hermes/OpenClaw 运行状态、Token 统计
- 🔑 **API 备用池** — 管理多个 API 密钥，自动检测连通性
- 💾 **磁盘分析** — 各分区使用详情
- 📋 **日志查看** — 实时日志浏览
- 🎨 **Cyberpunk 风格** — 霓虹粒子背景，动画仪表盘

## 技术栈

- **后端：** Hono (TypeScript)
- **前端：** Vue 3 + Tailwind CSS + Pinia
- **构建：** esbuild（单文件打包）
- **数据源：** Hermes SQLite + OpenClaw trajectory

## 快速开始

```bash
# 安装依赖
pnpm install

# 复制环境变量
cp .env.example .env
# 编辑 .env 配置你的路径

# 开发模式（两个终端）
pnpm dev          # Hono 后端 (端口 3001)
pnpm dev:client   # Vite 前端 (端口 3000)

# 生产构建
pnpm bundle

# 运行
pnpm start
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `HERMES_STATE_DB` | Hermes SQLite 数据库路径 | `/var/lib/hermes/state.db` |
| `API_POOL_PATH` | API 备用池文件路径 | `/var/lib/hermes/api_pool.json` |
| `OPENCLAW_SESSIONS` | OpenClaw 会话目录 | `/var/lib/openclaw/sessions` |
| `LOG_LEVEL` | 日志级别 | `info` |

## 截图

（欢迎 PR 补充截图）

## 开源协议

MIT