<script setup lang="ts">
import { useWsStore } from '@client/store/ws'
import { Badge } from '@client/components/ui/badge'
import { cardEntrance, dataUpdateWave, statusMorph, animateValue, pageEntrance } from '@client/composables/useAnimations'
import ParticlesBg from '@client/components/ParticlesBg.vue'
import RingGauge from '@client/components/RingGauge.vue'

const wsStore = useWsStore()
const { status, baseInfo, latestStats, statsHistory, agents } = storeToRefs(wsStore)
wsStore.init()

// ─── 粒子背景开关（默认开启，记忆偏好） ───
const showParticles = ref(localStorage.getItem('mini-watch-particles') !== 'off')

watch(showParticles, (v) => {
  localStorage.setItem('mini-watch-particles', v ? 'on' : 'off')
})

// ─── WS 连接状态 ───
const dotClass = computed(() => {
  if (status.value === 'open') return 'status-dot status-dot-green pulse-dot'
  if (status.value === 'connecting') return 'status-dot status-dot-amber pulse-dot'
  return 'status-dot status-dot-gray'
})
const label = computed(() => {
  if (status.value === 'open') return '已连接'
  if (status.value === 'connecting') return '连接中…'
  return '已断开'
})

// ─── 主机信息 ───
const baseRows = computed(() => {
  const b = baseInfo.value
  if (!b) return []
  const totalH = Math.floor(b.uptimeMs / 3600_000)
  const d = Math.floor(totalH / 24)
  const h = totalH % 24
  return [
    { k: '主机名', v: b.hostname },
    { k: '系统', v: `${b.osName} ${b.osVersion}` },
    { k: '架构', v: `${b.platform}/${b.arch}` },
    { k: 'CPU', v: `${b.cpuCores} 核` },
    { k: '内存', v: `${b.memoryGB} GB` },
    { k: '已运行', v: d > 0 ? `${d}d ${h}h` : `${h}h` },
  ]
})

// ─── Agent 列表 ───
const agentSlots = ['程程 (OpenClaw)', '程程 (Hermes)']
const agentList = computed(() => {
  const known = [...agents.value]
  return agentSlots.map(name => {
    const found = known.find(a => a.name === name)
    return { name, data: found ? { name: found.name, status: found.status, message: found.message } : null }
  })
})
const agentDotClass = (s: string | undefined) => {
  switch (s) {
    case 'working': case 'thinking': return 'status-dot status-dot-amber pulse-dot'
    case 'blocked': return 'status-dot status-dot-red pulse-dot'
    case 'attention': return 'status-dot status-dot-amber'
    case 'idle': return 'status-dot status-dot-green'
    case 'off': return 'status-dot status-dot-gray'
    default: return 'status-dot status-dot-gray'
  }
}
const agentLabel = (s: string | undefined) => {
  switch (s) {
    case 'working': return '工作中'
    case 'thinking': return '思考中'
    case 'blocked': return '阻塞'
    case 'attention': return '待处理'
    case 'idle': return '空闲'
    case 'off': return '离线'
    default: return '未上报'
  }
}
// ─── Swap 百分比 ───
const swapPct = computed(() => {
  const used = latestStats.value?.memory.swapUsedGB ?? 0
  const total = latestStats.value?.memory.swapTotalGB ?? 1
  if (total <= 0) return 0
  return Math.round((used / total) * 100)
})

const agentLabelClass = (s: string | undefined) => {
  switch (s) {
    case 'working': case 'thinking': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'blocked': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'idle': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'off': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    default: return 'bg-zinc-500/20 text-zinc-500 border-zinc-500/30'
  }
}

// ─── 动画：页面入口 ───
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (containerRef.value) {
    pageEntrance(containerRef.value)
  }

  // 赛博故障文字：随机触发
  const glitchInterval = setInterval(() => {
    const title = containerRef.value?.querySelector<HTMLElement>('.glitch-target')
    if (title && Math.random() < 0.35) {
      title.classList.add('glitch-active')
      setTimeout(() => title.classList.remove('glitch-active'), 300)
    }
  }, 4000)

  onUnmounted(() => clearInterval(glitchInterval))
})

// ─── 动画：数据更新波动 ───
let prevStatsRaw = ''
watch(latestStats, (newVal) => {
  if (!newVal || !containerRef.value) return

  const raw = JSON.stringify(newVal)
  if (raw === prevStatsRaw) return
  prevStatsRaw = raw

  nextTick(() => {
    const cards = containerRef.value?.querySelectorAll('.glass-card')
    if (cards?.length) dataUpdateWave(cards)
  })
}, { deep: true })

// ─── 内存细分 ───
interface MemSegment {
  name: string
  label: string
  valueGB: number
  pct: number
  color: string
}

const hoverSegment = ref<string | null>(null)

const memSegments = computed<MemSegment[]>(() => {
  const m = latestStats.value?.memory
  if (!m || !m.totalGB) return []

  const total = m.totalGB
  const buffers = m.buffersGB ?? 0
  const cached = m.cachedGB ?? 0
  const sReclaimable = m.sReclaimableGB ?? 0
  const shmem = m.shmemGB ?? 0

  // 空闲 = total - used - buffers - cached - sReclaimable + shmem
  const freeGB = Math.max(0, total - m.usedGB - buffers - cached - sReclaimable + shmem)
  // 应用已用 = usedGB - shmemGB
  const appUsed = Math.max(0, m.usedGB - shmem)
  // Cached 不含 Shmem（Shmem 是 Cached 的子集）
  const cachedExclShmem = Math.max(0, cached - shmem)

  const segments: MemSegment[] = [
    { name: 'app', label: '应用已用', valueGB: appUsed, color: '#a855f7' },
    { name: 'buffers', label: 'Buffers', valueGB: buffers, color: '#3b82f6' },
    { name: 'cached', label: 'Cached', valueGB: cachedExclShmem, color: '#10b981' },
    { name: 'sReclaimable', label: 'SReclaimable', valueGB: sReclaimable, color: '#f59e0b' },
    { name: 'shmem', label: 'Shmem', valueGB: shmem, color: '#ec4899' },
    { name: 'free', label: '空闲', valueGB: freeGB, color: 'rgba(100,100,200,0.2)' },
  ]

  for (const seg of segments) {
    seg.pct = total > 0 ? Math.round((seg.valueGB / total) * 1000) / 10 : 0
  }

  return segments
})

// ─── 动画：状态点过渡 ───
const agentDots = ref<Map<string, HTMLElement>>(new Map())

function onDotMounted(el: HTMLElement, name: string) {
  agentDots.value.set(name, el)
}

watch(agents, (newAgents, oldAgents) => {
  if (!oldAgents?.length) return
  for (const a of newAgents) {
    const old = oldAgents.find(o => o.name === a.name)
    if (old && old.status !== a.status) {
      const dot = agentDots.value.get(a.name)
      if (dot) statusMorph(dot)
    }
  }
}, { deep: true })
</script>

<template>
  <!-- 粒子背景层 -->
  <ParticlesBg :show="showParticles" />

  <div ref="containerRef" class="tech-bg min-h-screen p-4 relative z-10">
    <div class="mx-auto max-w-4xl space-y-4">
      <!-- 头部 -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold opacity-0">
          <span class="gradient-text glitch-target" data-text="mini-watch">mini-watch</span>
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
          <!-- 桌面导航：全部显示 -->
          <div class="hidden sm:flex items-center gap-1.5">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务状态</router-link>
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">活动日志</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token趋势</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘分区</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
            <a href="/chat" class="rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-400 hover:text-white hover:bg-indigo-500/40 transition-all">聊天</a>
          </div>
          <!-- 移动端导航：全部显示 -->
          <div class="sm:hidden flex items-center gap-1.5 flex-wrap justify-end">
            <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">服务</router-link>
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">日志</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
            <router-link to="/agents" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Agent</router-link>
            <a href="/chat" class="rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-400 hover:text-white hover:bg-indigo-500/40 transition-all">聊天</a>
          </div>
          <router-link to="/agents" class="hidden sm:inline-flex rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            Agent 监控 →
          </router-link>
          <div class="flex items-center gap-2">
            <span :class="dotClass" />
            <span class="text-xs text-zinc-400">{{ label }}</span>
          </div>
        </div>
      </div>

      <!-- 主机信息 -->
      <div class="glass-card p-4">
        <div class="mb-3 stat-label">主机信息</div>
        <div v-if="!baseInfo" class="text-sm text-zinc-500">等待数据…</div>
        <div v-else class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <div v-for="row in baseRows" :key="row.k">
            <div class="stat-label">{{ row.k }}</div>
            <div class="truncate text-sm font-semibold text-white">{{ row.v }}</div>
          </div>
        </div>
      </div>

      <!-- 实时指标 - 环形仪表盘 -->
      <div class="glass-card p-4">
        <div class="mb-4 stat-label">实时指标</div>

        <div class="flex justify-center gap-4 items-start">
          <!-- CPU -->
          <RingGauge
            :pct="latestStats?.cpu.usage ?? 0"
            label="CPU"
            :value="`${latestStats?.cpu.usage ?? '-'}%`"
            :colors="['#3b82f6', '#06b6d4']"
          />

          <!-- 内存 -->
          <RingGauge
            :pct="latestStats?.memory.usedPct ?? 0"
            label="内存"
            :value="`${latestStats?.memory.usedPct ?? '-'}%`"
            :sub="`${latestStats?.memory.usedGB ?? '-'}/${latestStats?.memory.totalGB ?? '-'} GB`"
            :colors="['#a855f7', '#ec4899']"
          />

          <!-- 磁盘 -->
          <RingGauge
            :pct="latestStats?.disk.usedPct ?? 0"
            label="磁盘"
            :value="`${latestStats?.disk.usedPct ?? '-'}%`"
            :sub="`${latestStats?.disk.usedGB ?? '-'}/${latestStats?.disk.totalGB ?? '-'} GB`"
            :colors="['#10b981', '#06b6d4']"
          />

          <!-- Swap -->
          <RingGauge
            :pct="swapPct"
            label="Swap"
            :value="`${swapPct}%`"
            :sub="`${latestStats?.memory.swapUsedGB ?? '-'}/${latestStats?.memory.swapTotalGB ?? '-'} GB`"
            :colors="['#f59e0b', '#f97316']"
          />
        </div>

        <!-- 内存细分：堆叠条 + 明细 -->
        <div v-if="memSegments.length > 0" class="mt-4 pt-3 border-t border-white/5">
          <div class="stat-label mb-2">内存细分</div>
          <!-- 堆叠条 -->
          <div
            class="flex h-4 rounded-full overflow-hidden bg-white/5"
            @mouseleave="hoverSegment = null"
          >
            <div
              v-for="seg in memSegments"
              :key="seg.name"
              :style="{
                width: Math.max(seg.pct, 0.3) + '%',
                background: seg.color,
              }"
              class="h-full transition-all duration-300 cursor-pointer"
              :class="hoverSegment && hoverSegment !== seg.name ? 'opacity-30' : seg.pct > 0.5 ? 'opacity-100' : 'opacity-60'"
              :title="`${seg.label}: ${seg.valueGB.toFixed(2)} GB (${seg.pct}%)`"
              @mouseenter="hoverSegment = seg.name"
            />
          </div>
          <!-- 明细列表 -->
          <div class="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            <div
              v-for="seg in memSegments"
              :key="seg.name"
              class="flex items-center gap-1.5 text-[11px] cursor-pointer rounded px-1 py-0.5 transition-all"
              :class="hoverSegment === seg.name ? 'bg-white/10' : ''"
              @mouseenter="hoverSegment = seg.name"
            >
              <span class="inline-block w-2 h-2 rounded-full shrink-0" :style="{ background: seg.color }" />
              <span class="text-zinc-400">{{ seg.label }}</span>
              <span class="ml-auto font-mono text-white/80">{{ seg.valueGB.toFixed(2) }} GB</span>
              <span class="font-mono text-zinc-500 w-8 text-right">{{ seg.pct }}%</span>
            </div>
          </div>
        </div>
        <div v-else-if="latestStats?.memory?.totalGB" class="mt-4 pt-3 border-t border-white/5">
          <div class="text-xs text-zinc-500">等待数据…</div>
        </div>

        <!-- 底部：网络 + 可用内存/磁盘 -->
        <div class="mt-4 pt-3 border-t border-white/5">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="stat-label mb-1">下行</div>
              <div ref="rxVal" class="font-mono text-sm text-cyan-400">{{ latestStats?.network.rxKBs ?? 0 }} <span class="text-zinc-600">KB/s</span></div>
            </div>
            <div>
              <div class="stat-label mb-1">上行</div>
              <div ref="txVal" class="font-mono text-sm text-purple-400">{{ latestStats?.network.txKBs ?? 0 }} <span class="text-zinc-600">KB/s</span></div>
            </div>
          </div>
          <div class="mt-2 flex gap-4 text-[10px] text-zinc-500">
            <span>内存可用 {{ latestStats?.memory.availPct ?? '-' }}%</span>
            <span v-if="latestStats?.memory.swapUsedGB">Swap {{ latestStats.memory.swapUsedGB }} GB</span>
            <span>磁盘可用 {{ latestStats?.disk.availGB ?? '-' }} GB</span>
          </div>
          <div v-if="latestStats?.network.iface && latestStats.network.iface !== '-'" class="mt-1 text-[10px] text-zinc-600">
            接口: {{ latestStats?.network.iface }}
          </div>
        </div>
      </div>

      <!-- 系统负载 -->
      <div class="glass-card p-4">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div class="stat-label">负载 (1/5/15m)</div>
            <div class="font-mono text-white">
              {{ latestStats?.loadAvg?.map((n: number) => n.toFixed(2)).join(' / ') ?? '-' }}
            </div>
          </div>
          <div>
            <div class="stat-label">运行时间</div>
            <div class="font-mono text-white">
              <template v-if="latestStats?.uptime">
                {{ Math.floor(latestStats.uptime / 86400) }}d {{ Math.floor((latestStats.uptime % 86400) / 3600) }}h
              </template>
              <template v-else>-</template>
            </div>
          </div>
        </div>
      </div>

      <!-- Agent 红绿灯状态 -->
      <div class="glass-card p-4">
        <div class="mb-4 flex items-center justify-between">
          <span class="stat-label">Agent 状态</span>
          <div class="flex items-center gap-2">
            <router-link to="/services" class="text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors">
              服务总览 →
            </router-link>
            <router-link to="/logs" class="text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors">
              活动日志 →
            </router-link>
          </div>
        </div>
        <div class="space-y-3">
          <div v-for="a in agentList" :key="a.name" class="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <span :ref="(el: any) => el && onDotMounted(el as HTMLElement, a.name)" :class="agentDotClass(a.data?.status)" />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-white">{{ a.name }}</div>
              <div v-if="a.data?.message" class="truncate text-xs text-zinc-500 mt-0.5">{{ a.data.message }}</div>
            </div>
            <Badge class="shrink-0 border text-[10px] px-2 py-0.5" :class="agentLabelClass(a.data?.status)">
              {{ a.data ? agentLabel(a.data.status) : '未上报' }}
            </Badge>
          </div>
        </div>
      </div>

      <!-- 调试/没有WS连接时 -->
      <div v-if="status === 'closed'" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-400">
        WebSocket 未连接，打开页面后会自动连上
      </div>
    </div>
  </div>

  <!-- 雷达扫描 -->
  <div class="radar-scanner">
    <div class="ring-1" />
    <div class="ring-2" />
    <div class="ring-3" />
  </div>
</template>
