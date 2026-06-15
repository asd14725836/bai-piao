<script setup lang="ts">
import ParticlesBg from '@client/components/ParticlesBg.vue'
import { pageEntrance } from '@client/composables/useAnimations'

interface Partition {
  filesystem: string
  type: string
  totalGB: string
  usedGB: string
  availGB: string
  usedPct: number
  mount: string
}

// ─── 数据 ───
const disks = ref<Partition[]>([])
const loading = ref(true)
const error = ref('')
const lastRefresh = ref('')

async function loadDisks() {
  try {
    loading.value = true
    error.value = ''
    const res = await fetch('/api/disks/partitions')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    disks.value = await res.json()
    lastRefresh.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch (e: any) {
    error.value = e.message || '加载失败'
    disks.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDisks()
  setInterval(loadDisks, 30000)
})

// ─── 进度条颜色 ───
function barColor(pct: number): string {
  if (pct < 50) return 'bg-emerald-500'
  if (pct < 80) return 'bg-amber-500'
  return 'bg-red-500'
}

function barContainerClass(pct: number): string {
  if (pct >= 80) return 'after:absolute after:inset-0 after:rounded-full after:animate-pulse after:ring-1 after:ring-red-500/50'
  return ''
}

// ─── 粒子背景 ───
const showParticles = ref(localStorage.getItem('mini-watch-particles') !== 'off')

watch(showParticles, (v) => {
  localStorage.setItem('mini-watch-particles', v ? 'on' : 'off')
})

// ─── 动画: 页面入口 ───
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (containerRef.value) {
    pageEntrance(containerRef.value)
  }
})
</script>

<template>
  <ParticlesBg :show="showParticles" />

  <div ref="containerRef" class="tech-bg min-h-screen p-4 relative z-10">
    <div class="mx-auto max-w-4xl space-y-4">
      <!-- 头部 -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">
          <span class="gradient-text glitch-target" data-text="磁盘分区">磁盘分区</span>
        </h1>
        <div class="flex items-center gap-2">
          <span v-if="lastRefresh" class="text-[10px] text-zinc-500">
            {{ lastRefresh }}
          </span>
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
            @click="loadDisks"
          >
            ↻ 刷新
          </button>
          <!-- 桌面导航 -->
          <div class="hidden sm:flex items-center gap-1.5">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务状态</router-link>
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">活动日志</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token趋势</router-link>
            <router-link to="/agents" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Agent监控</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
          </div>
          <!-- 移动端导航 -->
          <div class="sm:hidden flex items-center gap-1.5 flex-wrap justify-end">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务</router-link>
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">日志</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token</router-link>
            <router-link to="/agents" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Agent</router-link>
            <router-link to="/" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">← 返回</router-link>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading && disks.length === 0" class="text-center text-xs text-zinc-600 py-12">
        加载中…
      </div>

      <!-- 错误状态 -->
      <div v-if="error" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-400">
        加载失败: {{ error }}
      </div>

      <!-- 分区卡片 -->
      <div class="space-y-2">
        <div
          v-for="(disk, i) in disks"
          :key="disk.mount"
          class="glass-card p-4 transition-all duration-300"
        >
          <div class="flex items-center justify-between mb-3">
            <!-- 挂载点 -->
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-bold text-sm text-white truncate">{{ disk.mount }}</span>
              <span class="hidden sm:inline text-[10px] font-mono text-zinc-500">{{ disk.filesystem }}</span>
            </div>
            <!-- 文件系统类型 -->
            <span class="text-[10px] font-mono text-zinc-500 sm:hidden">{{ disk.type }}</span>
            <span class="hidden sm:inline text-[10px] font-mono text-zinc-500">{{ disk.type }}</span>
          </div>

          <!-- 进度条 -->
          <div class="relative h-2.5 rounded-full bg-white/5 overflow-hidden mb-2" :class="barContainerClass(disk.usedPct)">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="barColor(disk.usedPct)"
              :style="{ width: Math.min(disk.usedPct, 100) + '%' }"
            />
          </div>

          <!-- 数据行 -->
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-400">
              <span class="text-white font-medium">{{ disk.usedGB }}</span>
              <span class="text-zinc-600"> / {{ disk.totalGB }}</span>
            </span>
            <span class="flex items-center gap-2">
              <span class="text-zinc-500">可用 {{ disk.availGB }}</span>
              <span
                class="font-mono tabular-nums"
                :class="{
                  'text-emerald-400': disk.usedPct < 50,
                  'text-amber-400': disk.usedPct >= 50 && disk.usedPct < 80,
                  'text-red-400': disk.usedPct >= 80,
                }"
              >
                {{ disk.usedPct }}%
              </span>
            </span>
          </div>

          <!-- 底部装饰线 -->
          <div
            class="absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-500"
            :class="{
              'bg-emerald-500/40': disk.usedPct < 50,
              'bg-amber-500/40': disk.usedPct >= 50 && disk.usedPct < 80,
              'bg-red-500/50': disk.usedPct >= 80,
            }"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && !error && disks.length === 0" class="text-center text-xs text-zinc-600 py-12">
        没有磁盘分区数据
      </div>
    </div>
  </div>
    </template>
