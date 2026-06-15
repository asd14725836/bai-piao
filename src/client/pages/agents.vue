<script setup lang="ts">
import { cardEntrance, dataUpdateWave } from '@client/composables/useAnimations'
import ParticlesBg from '@client/components/ParticlesBg.vue'
import RingGauge from '@client/components/RingGauge.vue'
import DonutChart from '@client/components/DonutChart.vue'

// ─── 粒子背景开关（默认开启，记忆偏好） ───
const showParticles = ref(localStorage.getItem('mini-watch-particles') !== 'off')

watch(showParticles, (v) => {
  localStorage.setItem('mini-watch-particles', v ? 'on' : 'off')
})

// ─── OpenClaw 监控 ───
const openclawStats = ref<any>(null)
const openclawRecent = ref<any[]>([])
const openclawErrors = ref<any[]>([])
const openclawPeriod = ref('today')

// ─── Hermes 监控 ───
const hermesStats = ref<any>(null)
const hermesSessions = ref<any[]>([])
const hermesModel = ref<any>(null)
const hermesPeriod = ref('today')

// ─── 加载数据 ───
async function loadOpenclawStats() {
  try {
    const [statsRes, recentRes, errorsRes] = await Promise.all([
      fetch(`/api/openclaw/stats?period=${openclawPeriod.value}`),
      fetch('/api/openclaw/recent?limit=10'),
      fetch('/api/openclaw/errors?limit=20'),
    ])
    openclawStats.value = await statsRes.json()
    const recentData = await recentRes.json()
    openclawRecent.value = recentData.calls || []
    const errorsData = await errorsRes.json()
    openclawErrors.value = errorsData.errors || []
  } catch (e) {
    console.error('Failed to load OpenClaw stats:', e)
  }
}

async function loadHermesStats() {
  try {
    const [statsRes, sessionsRes, modelRes] = await Promise.all([
      fetch(`/api/hermes/stats?period=${hermesPeriod.value}`),
      fetch('/api/hermes/sessions'),
      fetch('/api/hermes/model'),
    ])
    hermesStats.value = await statsRes.json()
    const sessionsData = await sessionsRes.json()
    hermesSessions.value = sessionsData.sessions || []
    hermesModel.value = await modelRes.json()
  } catch (e) {
    console.error('Failed to load Hermes stats:', e)
  }
}

// ─── 工具颜色映射（赛博色板） ───
const TOOL_PALETTE = [
  '#06b6d4', // 亮青
  '#a855f7', // 紫
  '#f59e0b', // 琥珀
  '#ec4899', // 粉
  '#10b981', // 翠绿
  '#3b82f6', // 蓝
  '#f97316', // 橙
  '#14b8a6', // 青绿
  '#e11d48', // 玫红
  '#8b5cf6', // 靛紫
]
const toolColors: Record<string, string> = {
  web_fetch: '#06b6d4',
  exec: '#a855f7',
  read: '#10b981',
  web_search: '#3b82f6',
  write: '#ec4899',
  patch: '#ec4899',
  terminal: '#a855f7',
}

const getToolColor = (name: string) => {
  if (toolColors[name]) return toolColors[name]
  const idx = Object.keys(toolColors).length % TOOL_PALETTE.length
  return TOOL_PALETTE[idx]
}

// ─── 工具 → DonutChart items ───
const toolDonutItems = computed(() => {
  if (!openclawStats.value?.byTool?.length) return []
  return openclawStats.value.byTool.map((t: any) => ({
    value: t.count,
    label: t.name,
    color: getToolColor(t.name),
  }))
})

// ─── 平台颜色映射 ───
const platformColors: Record<string, string> = {
  weixin: '#10b981',
  wechat: '#10b981',
  telegram: '#3b82f6',
  cron: '#f59e0b',
  discord: '#8b5cf6',
}

const getPlatformColor = (name: string) => {
  if (platformColors[name]) return platformColors[name]
  return '#6b7280'
}

// ─── 平台 → DonutChart items ───
const platformDonutItems = computed(() => {
  if (!hermesStats.value?.byPlatform?.length) return []
  return hermesStats.value.byPlatform.map((p: any) => ({
    value: p.tokens,
    label: p.platform,
    color: getPlatformColor(p.platform),
  }))
})

// ─── 格式化数字 ───
function fmtNum(n: number | undefined | null) {
  if (n == null || isNaN(n)) return '-'
  return n.toLocaleString()
}

// ─── Hermes 缓存命中率 ───
const hermesCacheRate = computed(() => {
  if (!hermesStats.value?.totalTokens || !hermesStats.value?.totalCache) return 0
  return Math.round((hermesStats.value.totalCache / hermesStats.value.totalTokens) * 10000) / 100
})

// ─── Hermes Token 分解 → Donut items ───
const tokenBreakdownItems = computed(() => {
  if (!hermesStats.value) return []
  return [
    { value: hermesStats.value.totalCache ?? 0, label: '缓存', color: '#10b981' },
    { value: hermesStats.value.totalInput ?? 0, label: '输入', color: '#06b6d4' },
    { value: hermesStats.value.totalOutput ?? 0, label: '输出', color: '#a855f7' },
  ]
})

// ─── Cron会话名格式化 ───
function formatCronName(key: string) {
  if (!key) return '-'
  // 提取cron_xxx_yyyymmdd_hhmmss 中的名字部分
  const parts = key.split('_')
  if (parts.length >= 4) {
    const id = parts.slice(0, -3).join('_') || parts[0]
    return id.substring(0, 25)
  }
  return key.substring(0, 25)
}

// ─── 初始化 ───
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  loadOpenclawStats()
  loadHermesStats()
  // 卡片交错飞入
  if (containerRef.value) {
    cardEntrance(containerRef.value, '.glass-card')
  }
  // 每60秒刷新
  setInterval(() => {
    loadOpenclawStats()
    loadHermesStats()
  }, 60000)
})

// ─── 数据刷新时波动动画 ───
watch(openclawStats, () => {
  nextTick(() => {
    const cards = containerRef.value?.querySelectorAll('.glass-card')
    if (cards?.length) dataUpdateWave(cards, 50)
  })
})

watch(hermesStats, () => {
  nextTick(() => {
    const cards = containerRef.value?.querySelectorAll('.glass-card')
    if (cards?.length) dataUpdateWave(cards, 50)
  })
})

// ─── 监听周期变化 ───
watch(openclawPeriod, () => loadOpenclawStats())
watch(hermesPeriod, () => loadHermesStats())
</script>

<template>
  <!-- 粒子背景层（共享状态，通过localStorage同步开关状态） -->
  <ParticlesBg :show="showParticles" />

  <div ref="containerRef" class="tech-bg min-h-screen p-4 relative z-10">
    <div class="mx-auto max-w-6xl space-y-6">
      <!-- 头部 -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">
          <span class="gradient-text">Agent 监控中心</span>
        </h1>
        <div class="flex items-center gap-2">
          <!-- 粒子开关 -->
          <button
            class="rounded-lg border px-2.5 py-1 text-[10px] transition-all"
            :class="showParticles
              ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
              : 'bg-white/5 text-zinc-500 border-white/10 hover:text-zinc-300'"
            @click="showParticles = !showParticles"
          >
            ✦ 粒子
          </button>
          <!-- 桌面导航 -->
          <div class="hidden sm:flex items-center gap-1.5">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务状态</router-link>
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">活动日志</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token趋势</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘分区</router-link>
          </div>
          <!-- 移动端导航 -->
          <div class="sm:hidden flex items-center gap-1.5 flex-wrap justify-end">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务</router-link>
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">日志</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
            <router-link to="/" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">← 返回</router-link>
          </div>
          <div class="text-[10px] text-zinc-600">自动刷新</div>
        </div>
      </div>

      <!-- ===== OpenClaw 监控模块 ===== -->
      <div class="glass-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="status-dot status-dot-green pulse-dot"></span>
            <span class="stat-label text-base">OpenClaw · 工具执行核心</span>
          </div>
          <div class="flex gap-2">
            <button
              class="rounded-lg px-3 py-1 text-xs transition-all"
              :class="openclawPeriod === 'today' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-zinc-500 border border-white/10'"
              @click="openclawPeriod = 'today'"
            >今日</button>
            <button
              class="rounded-lg px-3 py-1 text-xs transition-all"
              :class="openclawPeriod === '7d' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-zinc-500 border border-white/10'"
              @click="openclawPeriod = '7d'"
            >近7天</button>
          </div>
        </div>

        <!-- 统计卡片 -->
        <div class="mb-4 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
          <div class="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 sm:p-3 flex flex-col items-center">
            <RingGauge
              :pct="openclawStats?.successRate ?? 0"
              label="成功率"
              :value="`${openclawStats?.successRate ?? '-'}%`"
              :colors="['#10b981', '#06b6d4']"
              :size="72"
              :strokeWidth="5"
            />
          </div>
          <div class="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 sm:p-3">
            <div class="stat-label">总调用次数</div>
            <div class="stat-value text-sm sm:text-xl gradient-text-cyan truncate">{{ fmtNum(openclawStats?.total) }}</div>
            <div class="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-zinc-500 truncate">
              <span class="text-emerald-400">✓ {{ fmtNum((openclawStats?.total ?? 0) - (openclawStats?.byTool?.reduce((a: number, t: any) => a + (t.errors ?? 0), 0) ?? 0)) }}</span>
              <span class="text-zinc-600 mx-1">/</span>
              <span class="text-red-400">✗ {{ openclawStats?.byTool?.reduce((a: number, t: any) => a + (t.errors ?? 0), 0) ?? 0 }}</span>
            </div>
          </div>
          <div class="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 sm:p-3">
            <div class="stat-label">工具种类</div>
            <div class="stat-value text-sm sm:text-xl text-purple-400 truncate">{{ openclawStats?.byTool?.length ?? '-' }}</div>
          </div>
          <div class="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 sm:p-3">
            <div class="stat-label">总 Token</div>
            <div class="stat-value text-sm sm:text-xl truncate" :class="(openclawStats?.totalTokens ?? 0) > 1000000 ? 'text-amber-400' : 'text-cyan-400'">
              {{ openclawStats?.totalTokens != null ? fmtNum(openclawStats.totalTokens) : '-' }}
            </div>
            <div class="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-zinc-500 truncate">
              失败: {{ openclawStats?.byTool?.reduce((a: number, t: any) => a + (t.errors ?? 0), 0) ?? 0 }} 次
            </div>
          </div>
        </div>

        <!-- 工具调用环形图 -->
        <div class="mb-4">
          <div class="mb-3 stat-label">工具调用分布</div>
          <div class="flex flex-col items-center">
            <DonutChart
              :items="toolDonutItems"
              :size="140"
              :strokeWidth="18"
              total-label="调用"
              :center-text="fmtNum(openclawStats?.total ?? 0)"
            />
          </div>
        </div>

        <!-- 最近调用记录 -->
        <div>
          <div class="mb-3 stat-label">最近工具调用</div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-white/10 text-zinc-500">
                  <th class="pb-2 text-left font-normal">时间</th>
                  <th class="pb-2 text-left font-normal">工具</th>
                  <th class="pb-2 text-right font-normal">Token</th>
                  <th class="pb-2 text-right font-normal">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(call, i) in openclawRecent" :key="i" class="border-b border-white/5">
                  <td class="py-2 font-mono text-zinc-500">{{ new Date(call.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</td>
                  <td class="py-2">
                    <span class="rounded px-1.5 py-0.5 text-[10px] font-mono" :class="getToolColor(call.tool) + '/20 text-white'">{{ call.tool }}</span>
                  </td>
                  <td class="py-2 text-right font-mono text-zinc-400">{{ call.tokens?.total ?? '-' }}</td>
                  <td class="py-2 text-right">
                    <span v-if="call.success" class="text-emerald-400">✓</span>
                    <span v-else class="text-red-400">✗</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ===== Hermes 监控模块 ===== -->
      <div class="glass-card p-5">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="status-dot status-dot-green pulse-dot"></span>
            <span class="stat-label text-base">Hermes · 对话推理核心</span>
          </div>
          <div class="flex gap-2">
            <button
              class="rounded-lg px-3 py-1 text-xs transition-all"
              :class="hermesPeriod === 'today' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-zinc-500 border border-white/10'"
              @click="hermesPeriod = 'today'"
            >今日</button>
            <button
              class="rounded-lg px-3 py-1 text-xs transition-all"
              :class="hermesPeriod === 'month' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-zinc-500 border border-white/10'"
              @click="hermesPeriod = 'month'"
            >本月</button>
          </div>
        </div>

        <!-- 统计卡片 + 环形图 -->
        <div class="mb-5 space-y-4">
          <!-- 视觉行：Token分解 + 缓存率 -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="sm:col-span-2 rounded-lg bg-white/[0.03] border border-white/5 p-4 flex flex-col items-center">
              <div class="stat-label mb-3 self-start">Token 分解</div>
              <DonutChart
                :items="tokenBreakdownItems"
                :size="140"
                :stroke-width="20"
                :center-text="fmtNum(hermesStats?.totalTokens ?? 0)"
                total-label="总Token"
              />
            </div>
            <div class="rounded-lg bg-white/[0.03] border border-white/5 p-4 flex flex-col items-center justify-center">
              <RingGauge
                :pct="hermesCacheRate"
                label="缓存率"
                :value="`${hermesCacheRate.toFixed(1)}%`"
                :colors="['#10b981', '#06b6d4']"
                :size="100"
                :stroke-width="6"
              />
            </div>
          </div>
          <!-- 底部统计卡片 -->
          <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
            <div class="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 sm:p-3">
              <div class="stat-label">总 Token</div>
              <div class="stat-value text-sm sm:text-xl gradient-text-cyan truncate">{{ fmtNum(hermesStats?.totalTokens) }}</div>
            </div>
            <div class="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 sm:p-3">
              <div class="stat-label">输入 / 输出</div>
              <div class="text-xs sm:text-base font-bold truncate">
                <span class="text-cyan-400">{{ fmtNum(hermesStats?.totalInput) }}</span>
                <span class="text-zinc-600 mx-1">/</span>
                <span class="text-purple-400">{{ fmtNum(hermesStats?.totalOutput) }}</span>
              </div>
            </div>
            <div class="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 sm:p-3">
              <div class="stat-label">缓存命中</div>
              <div class="stat-value text-sm sm:text-xl text-emerald-400 truncate">{{ fmtNum(hermesStats?.totalCache) }}</div>
            </div>
            <div class="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 sm:p-3">
              <div class="stat-label">工具调用 / 种类</div>
              <div class="text-xs sm:text-base font-bold truncate">
                <span class="text-pink-400">{{ fmtNum(hermesStats?.totalToolCalls) }}</span>
                <span class="text-zinc-600 mx-1">/</span>
                <span class="text-purple-400">{{ hermesStats?.byPlatform?.length ?? '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 模型状态 + 平台分布 -->
        <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- 模型状态 -->
          <div class="rounded-lg bg-white/[0.03] border border-white/5 p-4">
            <div class="mb-3 stat-label">当前模型</div>
            <div class="space-y-2">
              <div class="flex justify-between text-xs">
                <span class="text-zinc-500">模型</span>
                <span class="font-mono text-white">{{ hermesModel?.model ?? '-' }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-zinc-500">Provider</span>
                <span class="font-mono text-white">{{ hermesModel?.provider ?? '-' }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-zinc-500">最大轮次</span>
                <span class="font-mono text-white">{{ hermesModel?.maxTurns ?? '-' }}</span>
              </div>
            </div>
            <!-- 按模型分组 -->
            <div v-if="hermesStats?.byModel?.length" class="mt-3 border-t border-white/5 pt-3">
              <div class="mb-2 stat-label text-[10px]">今日模型消耗</div>
              <div v-for="m in hermesStats.byModel" :key="m.model" class="flex items-center gap-2 text-xs">
                <span v-if="m.model === hermesModel?.model" class="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 pulse-dot" title="当前模型" />
                <span v-else class="h-1.5 w-1.5 rounded-full bg-zinc-600 shrink-0" title="已切换" />
                <span class="truncate font-mono flex-1" :class="m.model === hermesModel?.model ? 'text-emerald-300' : 'text-zinc-500'">{{ m.model }}</span>
                <span class="text-zinc-500">{{ m.count }}次</span>
                <span class="font-mono" :class="m.model === hermesModel?.model ? 'text-emerald-400' : 'text-zinc-500'">{{ fmtNum(m.tokens) }}</span>
              </div>
            </div>
          </div>

          <!-- 平台分布 -->
          <div class="rounded-lg bg-white/[0.03] border border-white/5 p-4">
            <div class="mb-3 stat-label">平台Token分布</div>
            <div class="flex flex-col items-center">
              <DonutChart
                :items="platformDonutItems"
                total-label="Token"
                :center-text="fmtNum(hermesStats?.totalTokens ?? 0)"
                :size="120"
                :strokeWidth="16"
              />
            </div>
          </div>
        </div>

        <!-- 会话列表 -->
        <div>
          <div class="mb-3 flex items-center justify-between">
            <span class="stat-label">微信对话</span>
            <span class="text-[10px] text-zinc-600">{{ hermesSessions.filter((s: any) => s.platform !== 'cron').length }}条</span>
          </div>
          <div class="space-y-2 mb-4">
            <div v-for="item in hermesSessions.filter((s: any) => s.platform !== 'cron').slice(0, 3)" :key="item.key" class="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <span class="h-2 w-2 rounded-full" :class="item.active ? 'bg-emerald-400 pulse-dot' : 'bg-emerald-500/50'"></span>
              <div class="min-w-0 flex-1">
                <div class="text-xs text-white truncate">
                  <span class="font-mono text-zinc-500">{{ item.platform }}</span>
                  <span class="text-zinc-600 mx-1">·</span>
                  <span class="text-zinc-300">{{ item.model }}</span>
                </div>
                <div class="text-[10px] text-zinc-500">
                  {{ new Date(item.started).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
                  {{ item.active ? '● 进行中' : '○ 已结束' }}
                </div>
              </div>
              <div class="text-[10px] text-zinc-600 flex items-center gap-2">
                <div class="font-mono text-zinc-400">{{ fmtNum(item.tokens) }} tok</div>
                <div>{{ item.messages }}条 · {{ item.toolCalls }}次工具</div>
              </div>
            </div>
          </div>
          <div v-if="hermesSessions.filter((s: any) => s.platform !== 'cron').length === 0" class="text-xs text-zinc-600 text-center py-4">暂无对话</div>

          <div v-if="hermesSessions.filter((s: any) => s.platform === 'cron').length > 0">
            <div class="mb-3 flex items-center justify-between">
              <span class="stat-label text-[10px] text-zinc-500">定时任务</span>
              <span class="text-[10px] text-zinc-600">{{ hermesSessions.filter((s: any) => s.platform === 'cron').length }}条</span>
            </div>
            <div class="space-y-2">
              <div v-for="item in hermesSessions.filter((s: any) => s.platform === 'cron').slice(0, 5)" :key="item.key" class="flex items-center gap-2 rounded-lg bg-white/[0.01] border border-white/5 p-2">
                <span class="h-1.5 w-1.5 rounded-full bg-amber-500/60"></span>
                <div class="flex-1 text-xs text-zinc-400 truncate font-mono">{{ formatCronName(item.key) }}</div>
                <div class="text-[10px] font-mono text-zinc-500">{{ fmtNum(item.tokens) }} tok</div>
                <div class="text-[10px] text-zinc-600">{{ new Date(item.started).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</div>
              </div>
            </div>
          </div>
          <div v-if="hermesSessions.filter((s: any) => s.platform === 'cron').length === 0" class="text-xs text-zinc-600 text-center py-4">暂无定时任务</div>
        </div>
      </div>
    </div>
  </div>

    </template>
