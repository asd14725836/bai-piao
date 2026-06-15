<script setup lang="ts">
import LineChart from '@client/components/LineChart.vue'
import ParticlesBg from '@client/components/ParticlesBg.vue'
import { pageEntrance } from '@client/composables/useAnimations'

// ─── 粒子背景 ───
const showParticles = ref(localStorage.getItem('mini-watch-particles') !== 'off')
watch(showParticles, (v) => {
  localStorage.setItem('mini-watch-particles', v ? 'on' : 'off')
})

// ─── 范围 / 粒度 ───
type RangeKey = '6h' | '24h' | '7d' | '30d'

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '6h', label: '6小时' },
  { key: '24h', label: '24小时' },
  { key: '7d', label: '7天' },
  { key: '30d', label: '30天' },
]

const range = ref<RangeKey>('24h')

function granularity(range: RangeKey): string {
  if (range === '7d' || range === '30d') return 'day'
  return 'hour'
}

function rangeLabel(range: RangeKey): string {
  const opt = RANGE_OPTIONS.find(o => o.key === range)
  return opt?.label ?? range
}

// ─── 数据加载 ───
interface TrendPoint {
  ts: number
  input: number
  output: number
  cache: number
}

const points = ref<TrendPoint[]>([])
const loading = ref(true)
const error = ref('')
const lastRefresh = ref('')

async function loadData() {
  try {
    loading.value = true
    error.value = ''
    const g = granularity(range.value)
    const res = await fetch(`/api/hermes/token-trend?granularity=${g}&range=${range.value}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    points.value = (data.points || []) as TrendPoint[]
    lastRefresh.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch (e: any) {
    error.value = e.message || '加载失败'
    points.value = []
  } finally {
    loading.value = false
  }
}

// 切换范围重新加载
watch(range, () => loadData())

// ─── LineChart 数据转换 ───
const lines = computed(() => [
  {
    key: 'input',
    label: '输入',
    data: points.value.map(p => ({ ts: p.ts, value: p.input })),
    color: '#06b6d4',
  },
  {
    key: 'output',
    label: '输出',
    data: points.value.map(p => ({ ts: p.ts, value: p.output })),
    color: '#a855f7',
  },
  {
    key: 'cache',
    label: '缓存',
    data: points.value.map(p => ({ ts: p.ts, value: p.cache })),
    color: '#10b981',
  },
])

// ─── 统计汇总 ───
const totals = computed(() => {
  const total = points.value.reduce((s, p) => s + p.input + p.output + p.cache, 0)
  const input = points.value.reduce((s, p) => s + p.input, 0)
  const output = points.value.reduce((s, p) => s + p.output, 0)
  const cache = points.value.reduce((s, p) => s + p.cache, 0)
  return { total, input, output, cache }
})

function fmtNum(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}

// ─── 入口动画 ───
const containerRef = ref<HTMLElement | null>(null)
onMounted(() => {
  loadData()
  if (containerRef.value) {
    pageEntrance(containerRef.value)
  }
})
</script>

<template>
  <ParticlesBg :show="showParticles" />

  <div ref="containerRef" class="tech-bg min-h-screen p-4 relative z-10">
    <div class="mx-auto max-w-5xl space-y-4">
      <!-- 头部 -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">
          <span class="gradient-text" data-text="Token 趋势">Token 趋势</span>
        </h1>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border px-2.5 py-1 text-[10px] transition-all"
            :class="showParticles
              ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
              : 'bg-white/5 text-zinc-500 border-white/10 hover:text-zinc-300'"
            @click="showParticles = !showParticles"
          >
            ✦ 粒子
          </button>
          <button
            class="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
            :disabled="loading"
            @click="loadData"
          >
            ↻ 刷新
          </button>
          <!-- 桌面导航 -->
          <div class="hidden sm:flex items-center gap-1.5">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务状态</router-link>
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">活动日志</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘分区</router-link>
            <router-link to="/agents" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Agent监控</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
          </div>
          <!-- 移动端导航 -->
          <div class="sm:hidden flex items-center gap-1.5 flex-wrap justify-end">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务</router-link>
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">日志</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
            <router-link to="/agents" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Agent</router-link>
            <router-link to="/" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">← 返回</router-link>
          </div>
        </div>
      </div>

      <!-- 时间范围选择器 -->
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="opt in RANGE_OPTIONS"
          :key="opt.key"
          class="rounded-lg px-3 py-1.5 text-xs transition-all font-medium"
          :class="range === opt.key
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
            : 'bg-white/5 text-zinc-500 border border-white/10 hover:text-zinc-300 hover:bg-white/10'"
          @click="range = opt.key"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- 图表卡片 -->
      <div class="glass-card p-4 sm:p-5">
        <!-- 加载状态 -->
        <div v-if="loading && points.length === 0" class="flex items-center justify-center py-16">
          <div class="flex flex-col items-center gap-2">
            <div class="h-6 w-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            <span class="text-[10px] text-zinc-500">加载中…</span>
          </div>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-400">
          加载失败: {{ error }}
        </div>

        <!-- 图表 -->
        <div v-else class="flex flex-col items-center">
          <LineChart
            :lines="lines"
            :width="700"
            :height="280"
            :time-range="rangeLabel(range)"
            :format-value="(v: number) => fmtNum(v)"
            :show-legend="false"
          />

          <!-- 内置图例（用 LineChart 隐藏自带图例，我们自己画） -->
          <div class="flex items-center gap-4 mt-3 flex-wrap justify-center">
            <div v-for="line in lines" :key="'leg-' + line.key" class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ background: line.color, boxShadow: `0 0 6px ${line.color}` }" />
              <span class="text-[10px] font-mono text-zinc-400">{{ line.label }}</span>
            </div>
            <span v-if="points.length > 0" class="text-[9px] font-mono text-zinc-600 ml-2">
              {{ points.length }} 个数据点
            </span>
          </div>
        </div>
      </div>

      <!-- 统计汇总卡片 -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="glass-card p-3 sm:p-4">
          <div class="stat-label">总 Token</div>
          <div class="stat-value text-sm sm:text-lg gradient-text truncate mt-1">
            {{ fmtNum(totals.total) }}
          </div>
        </div>
        <div class="glass-card p-3 sm:p-4">
          <div class="stat-label">输入</div>
          <div class="stat-value text-sm sm:text-lg text-cyan-400 truncate mt-1">
            {{ fmtNum(totals.input) }}
          </div>
        </div>
        <div class="glass-card p-3 sm:p-4">
          <div class="stat-label">输出</div>
          <div class="stat-value text-sm sm:text-lg text-purple-400 truncate mt-1">
            {{ fmtNum(totals.output) }}
          </div>
        </div>
        <div class="glass-card p-3 sm:p-4">
          <div class="stat-label">缓存</div>
          <div class="stat-value text-sm sm:text-lg text-emerald-400 truncate mt-1">
            {{ fmtNum(totals.cache) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
