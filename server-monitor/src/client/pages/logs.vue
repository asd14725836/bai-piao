<script setup lang="ts">
import { useWsStore } from '@client/store/ws'
import { Badge } from '@client/components/ui/badge'
import ParticlesBg from '@client/components/ParticlesBg.vue'
import { pageEntrance } from '@client/composables/useAnimations'
import type { LogEntry } from '@client/types/ws'
import { animate } from 'animejs'

const wsStore = useWsStore()
const { recentLogs, status } = storeToRefs(wsStore)
wsStore.init()

// ─── 粒子背景 ───
const showParticles = ref(localStorage.getItem('mini-watch-particles') !== 'off')
watch(showParticles, (v) => {
  localStorage.setItem('mini-watch-particles', v ? 'on' : 'off')
})

// ─── 筛选标签 ───
const filterTabs = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '系统' },
  { key: 'agent', label: 'Agent' },
  { key: 'connection', label: '连接' },
  { key: 'error', label: '错误' },
]

const activeFilter = ref('all')

const filteredLogs = computed(() => {
  if (activeFilter.value === 'all') return recentLogs.value
  return recentLogs.value.filter(l => l.type === activeFilter.value)
})

const filterCount = (key: string) => {
  if (key === 'all') return recentLogs.value.length
  return recentLogs.value.filter(l => l.type === key).length
}

// ─── 类型->颜色映射 ───
type LogColorKey = 'system' | 'agent' | 'signal' | 'connection' | 'error'

const LOG_COLORS: Record<LogColorKey, { badge: string; dot: string }> = {
  system: { badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', dot: 'bg-cyan-400' },
  agent: { badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' },
  signal: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  connection: { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  error: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-400' },
}

const LOG_LABELS: Record<string, string> = {
  system: '系统',
  agent: 'Agent',
  signal: '信号',
  connection: '连接',
  error: '错误',
}

// ─── 时间格式化 ───
function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── 自动滚动管理 ───
const SCROLL_THRESHOLD = 60
const scrollContainer = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const newLogIds = ref<Set<number>>(new Set())

function onScroll() {
  if (!scrollContainer.value) return
  // 如果用户滚动了超过阈值，关闭自动滚动
  if (scrollContainer.value.scrollTop > SCROLL_THRESHOLD) {
    autoScroll.value = false
  }
}

function scrollToTop() {
  if (!scrollContainer.value) return
  scrollContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
  autoScroll.value = true
}

// ─── 日志入场动画 ───
function animateNewLog(el: HTMLElement | null) {
  if (!el) return
  animate(el, {
    translateY: [-30, 0],
    opacity: [0, 1],
    duration: 400,
    ease: 'outCubic',
  })
}

// ─── 监听新日志：自动滚动 + 动画 ───
const logRefs = ref<Map<number, HTMLElement>>(new Map())

function setLogRef(el: HTMLElement | null, id: number) {
  if (!el) { logRefs.value.delete(id); return }
  logRefs.value.set(id, el)
  // 新条目入场动画
  if (newLogIds.value.has(id)) {
    animateNewLog(el)
    newLogIds.value.delete(id)
  }
}

watch(recentLogs, (newLogs, oldLogs) => {
  if (!oldLogs?.length) return
  // 找出新增的条目（unshift 在数组头部，所以看前面）
  const added = newLogs.slice(0, newLogs.length - oldLogs.length)
  for (const log of added) {
    newLogIds.value.add(log.id)
  }

  // 自动滚动到顶部
  if (autoScroll.value && scrollContainer.value) {
    nextTick(() => {
      scrollContainer.value?.scrollTo({ top: 0, behavior: 'instant' })
    })
  }
}, { deep: true })

// ─── 清空日志 ───
async function clearLogs() {
  try {
    await fetch('/api/logs/clear', { method: 'POST' })
    recentLogs.value = []
  } catch (e) {
    console.error('clear logs failed:', e)
  }
}

// ─── 页面入口动画 ───
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (containerRef.value) pageEntrance(containerRef.value)
})
</script>

<template>
  <ParticlesBg :show="showParticles" />

  <div ref="containerRef" class="tech-bg min-h-screen p-4 relative z-10">
    <div class="mx-auto max-w-4xl space-y-4">
      <!-- 头部 -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">
          <span class="gradient-text glitch-target" data-text="活动日志">活动日志</span>
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
          <!-- 自动滚动开关 -->
          <button
            class="rounded-lg border px-2.5 py-1 text-[10px] transition-all"
            :class="autoScroll
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
              : 'bg-white/5 text-zinc-500 border-white/10 hover:text-zinc-300'"
            @click="autoScroll = !autoScroll"
          >
            {{ autoScroll ? '▼ 自动' : '▣ 暂停' }}
          </button>
          <!-- 清空 -->
          <button
            class="rounded-lg border px-2.5 py-1 text-[10px] transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
            :class="recentLogs.length > 0
              ? 'bg-white/5 text-zinc-400 border-white/10'
              : 'bg-white/5 text-zinc-600 border-white/10 cursor-not-allowed'"
            :disabled="recentLogs.length === 0"
            @click="clearLogs"
          >
            ✕ 清空
          </button>
          <!-- 桌面导航 -->
          <div class="hidden sm:flex items-center gap-1.5">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务状态</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token趋势</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘分区</router-link>
            <router-link to="/agents" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Agent监控</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
          </div>
          <!-- 移动端导航 -->
          <div class="sm:hidden flex items-center gap-1.5 flex-wrap justify-end">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
            <router-link to="/agents" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Agent</router-link>
            <router-link to="/" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">← 返回</router-link>
          </div>
        </div>
      </div>

      <!-- 筛选标签 -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          class="rounded-lg px-3 py-1.5 text-xs transition-all"
          :class="activeFilter === tab.key
            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
            : 'bg-white/5 text-zinc-500 border border-white/10 hover:text-zinc-300'"
          @click="activeFilter = tab.key"
        >
          {{ tab.label }}
          <span class="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{{ filterCount(tab.key) }}</span>
        </button>
      </div>

      <!-- 日志瀑布流 -->
      <div
        ref="scrollContainer"
        class="glass-card overflow-y-auto"
        :style="{ maxHeight: 'calc(100vh - 240px)' }"
        @scroll="onScroll"
      >
        <div v-if="filteredLogs.length === 0" class="flex flex-col items-center justify-center py-16 text-zinc-600">
          <svg class="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="text-xs">暂无{{ activeFilter !== 'all' ? filterTabs.find(t => t.key === activeFilter)?.label : '' }}日志</span>
        </div>

        <div v-for="log in filteredLogs" :key="log.id">
          <div
            :ref="(el: any) => setLogRef(el as HTMLElement | null, log.id)"
            class="log-row flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.04] transition-colors cursor-default"
            :class="log.type === 'error' ? 'bg-red-500/[0.04]' : ''"
          >
            <!-- 时间戳 -->
            <span class="w-[76px] shrink-0 font-mono text-[11px] text-zinc-500 tabular-nums">{{ formatTime(log.ts) }}</span>
            <!-- 类型 Badge -->
            <span
              class="inline-flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium border"
              :class="LOG_COLORS[log.type as LogColorKey]?.badge || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'"
            >
              <span
                class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                :class="LOG_COLORS[log.type as LogColorKey]?.dot || 'bg-zinc-400'"
              />
              {{ LOG_LABELS[log.type] || log.type }}
            </span>
            <!-- 消息 -->
            <span class="flex-1 truncate text-xs text-zinc-300 font-mono tabular-nums">{{ log.message }}</span>
          </div>
        </div>
      </div>

      <!-- 未连接提示 -->
      <div v-if="status === 'closed'" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-400">
        WebSocket 未连接，日志数据不实时
      </div>
    </div>

    <!-- "最新" 浮动按钮 -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 translate-y-4"
      leave-to-class="opacity-0 translate-y-4"
    >
      <button
        v-if="!autoScroll && filteredLogs.length > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
               rounded-full px-4 py-2 text-xs font-medium
               bg-indigo-500/80 text-white border border-indigo-400/40
               shadow-lg shadow-indigo-500/20
               hover:bg-indigo-500 hover:shadow-indigo-500/30
               transition-all backdrop-blur-sm"
        @click="scrollToTop"
      >
        ↑ 最新
      </button>
    </Transition>
  </div>
    </template>

<style scoped>
.log-row:first-child {
  border-top-left-radius: var(--radius);
  border-top-right-radius: var(--radius);
}

.log-row:last-child {
  border-bottom: none;
  border-bottom-left-radius: var(--radius);
  border-bottom-right-radius: var(--radius);
}

.log-row:nth-child(even) {
  background: rgba(255, 255, 255, 0.015);
}
.log-row:nth-child(even):hover {
  background: rgba(255, 255, 255, 0.055);
}
</style>
