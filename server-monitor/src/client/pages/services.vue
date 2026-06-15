<script setup lang="ts">
import { useWsStore } from '@client/store/ws'
import { Badge } from '@client/components/ui/badge'
import ParticlesBg from '@client/components/ParticlesBg.vue'
import { pageEntrance, dataUpdateWave, statusMorph } from '@client/composables/useAnimations'

const wsStore = useWsStore()
const { status, agents, signalLight } = storeToRefs(wsStore)
wsStore.init()

// ─── 粒子背景开关 ───
const showParticles = ref(localStorage.getItem('mini-watch-particles') !== 'off')

watch(showParticles, (v) => {
  localStorage.setItem('mini-watch-particles', v ? 'on' : 'off')
})

// ─── 服务状态映射 ───
type ServiceStatus = 'online' | 'working' | 'warning' | 'error' | 'offline'

interface ServiceItem {
  name: string
  type: 'agent' | 'system'
  status: ServiceStatus
  label: string
  message?: string
  lastUpdate: number
}

function agentToServiceStatus(s: string | undefined): ServiceStatus {
  switch (s) {
    case 'idle': return 'online'
    case 'thinking': case 'working': return 'working'
    case 'attention': return 'warning'
    case 'blocked': return 'error'
    case 'off': return 'offline'
    default: return 'offline'
  }
}

function agentLabel(s: string | undefined): string {
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

function wsStatusToServiceStatus(s: string): ServiceStatus {
  switch (s) {
    case 'open': return 'online'
    case 'connecting': return 'warning'
    default: return 'offline'
  }
}

function signalToServiceStatus(s: string): ServiceStatus {
  switch (s) {
    case 'idle': return 'online'
    case 'working': return 'working'
    case 'attention': return 'warning'
    case 'blocked': return 'error'
    default: return 'online'
  }
}

function signalLabel(s: string): string {
  switch (s) {
    case 'idle': return '空闲'
    case 'working': return '工作中'
    case 'attention': return '待处理'
    case 'blocked': return '阻塞'
    default: return '未知'
  }
}

// ─── 服务列表 ───
const agentSlots = ['程程 (OpenClaw)', '程程 (Hermes)']

const services = computed<ServiceItem[]>(() => {
  const known = [...agents.value]

  return [
    // Agent services
    ...agentSlots.map(name => {
      const found = known.find(a => a.name === name)
      const s = found ? agentToServiceStatus(found.status) : 'offline'
      return {
        name,
        type: 'agent' as const,
        status: s,
        label: found ? agentLabel(found.status) : '离线',
        message: found?.message,
        lastUpdate: found?.updatedAt ?? 0,
      }
    }),
    // WebSocket gateway
    {
      name: 'WebSocket 网关',
      type: 'system' as const,
      status: wsStatusToServiceStatus(status.value),
      label: status.value === 'open' ? '已连接' : status.value === 'connecting' ? '连接中' : '已断开',
      message: status.value === 'open' ? '实时数据推送中' : undefined,
      lastUpdate: Date.now(),
    },
    // Signal Light
    {
      name: 'Signal Light',
      type: 'system' as const,
      status: signalToServiceStatus(signalLight.value),
      label: signalLabel(signalLight.value),
      message: signalLight.value ? `聚合状态: ${signalLight.value}` : '未上报',
      lastUpdate: Date.now(),
    },
    // Backend service (always online)
    {
      name: '后端服务',
      type: 'system' as const,
      status: 'online',
      label: '运行中',
      message: '端口 6888',
      lastUpdate: Date.now(),
    },
    // API 备用池
    {
      name: 'API 备用池',
      type: 'system' as const,
      status: 'online',
      label: '3个可用',
      message: 'Gemini 2.5 Flash ×1, Kimi k2.5 ×2',
      lastUpdate: Date.now(),
      detailPath: '/api-pool',
    },
  ]
})

// ─── 筛选标签 ───
const filterTabs = [
  { key: 'all', label: '全部' },
  { key: 'online', label: '正常' },
  { key: 'warning', label: '警告' },
  { key: 'error', label: '异常' },
  { key: 'offline', label: '离线' },
]

const activeFilter = ref('all')

const filteredServices = computed(() => {
  if (activeFilter.value === 'all') return services.value
  return services.value.filter(s => s.status === activeFilter.value)
})

const filterCount = (key: string) => {
  if (key === 'all') return services.value.length
  return services.value.filter(s => s.status === key).length
}

// ─── 样式映射 ───
const dotClass = (s: ServiceStatus) => {
  switch (s) {
    case 'online': return 'status-dot status-dot-green pulse-dot'
    case 'working': return 'status-dot status-dot-amber pulse-dot'
    case 'warning': return 'status-dot status-dot-amber'
    case 'error': return 'status-dot status-dot-red pulse-dot'
    case 'offline': return 'status-dot status-dot-gray'
    default: return 'status-dot status-dot-gray'
  }
}

const badgeClass = (s: ServiceStatus) => {
  switch (s) {
    case 'online': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'working': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'offline': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    default: return 'bg-zinc-500/20 text-zinc-500 border-zinc-500/30'
  }
}

const cardBorderClass = (s: ServiceStatus) => {
  switch (s) {
    case 'online': return 'border-emerald-500/20'
    case 'working': return 'border-amber-500/20'
    case 'warning': return 'border-amber-500/20'
    case 'error': return 'border-red-500/30'
    case 'offline': return 'border-zinc-500/10'
    default: return 'border-white/5'
  }
}

// ─── 相对时间 ───
function relativeTime(ts: number): string {
  if (!ts) return '-'
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return '刚刚'
  if (seconds < 60) return `${seconds}秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

// ─── 动画: 页面入口 ───
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (containerRef.value) {
    pageEntrance(containerRef.value)
  }
})

// ─── 动画: 数据更新波动 ───
watch(services, () => {
  nextTick(() => {
    const cards = containerRef.value?.querySelectorAll('.service-card')
    if (cards?.length) dataUpdateWave(cards)
  })
}, { deep: true })

// ─── 动画: 状态切换过渡 ───
const dotRefs = ref<Map<string, HTMLElement>>(new Map())

function onDotMounted(el: HTMLElement, name: string) {
  dotRefs.value.set(name, el)
}

watch(services, (newSvcs, oldSvcs) => {
  if (!oldSvcs?.length) return
  for (const s of newSvcs) {
    const old = oldSvcs.find(o => o.name === s.name)
    if (old && old.status !== s.status) {
      const dot = dotRefs.value.get(s.name)
      if (dot) statusMorph(dot)
    }
  }
}, { deep: true })
</script>

<template>
  <ParticlesBg :show="showParticles" />

  <div ref="containerRef" class="tech-bg min-h-screen p-4 relative z-10">
    <div class="mx-auto max-w-4xl space-y-4">
      <!-- 头部 -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">
          <span class="gradient-text glitch-target" data-text="服务状态">服务状态</span>
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
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">活动日志</router-link>
            <router-link to="/token-trend" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Token趋势</router-link>
            <router-link to="/disks" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">磁盘分区</router-link>
            <router-link to="/agents" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">Agent监控</router-link>
            <router-link to="/api-pool" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">备用池</router-link>
          </div>
          <!-- 移动端导航 -->
          <div class="sm:hidden flex items-center gap-1.5 flex-wrap justify-end">
            <router-link to="/logs" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all">日志</router-link>
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

      <!-- 服务卡片网格 -->
      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="svc in filteredServices"
          :key="svc.name"
          class="service-card glass-card p-4 transition-all duration-300"
          :class="[cardBorderClass(svc.status), { 'cursor-pointer hover:ring-2 hover:ring-indigo-500/30': svc.detailPath }]"
          @click="svc.detailPath ? $router.push(svc.detailPath) : null"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3 min-w-0">
              <span
                :ref="(el: any) => el && onDotMounted(el as HTMLElement, svc.name)"
                :class="dotClass(svc.status)"
              />
              <span class="font-semibold text-sm text-white truncate">{{ svc.name }}</span>
            </div>
            <Badge class="shrink-0 border text-[10px] px-2 py-0.5" :class="badgeClass(svc.status)">
              {{ svc.label }}
            </Badge>
          </div>

          <div class="flex items-end justify-between">
            <div v-if="svc.message" class="truncate text-xs text-zinc-500 mr-2">
              {{ svc.message }}
            </div>
            <div class="shrink-0 text-[10px] text-zinc-600">
              {{ svc.lastUpdate ? relativeTime(svc.lastUpdate) : '-' }}
            </div>
          </div>

          <!-- 底部装饰线（状态色） -->
          <div
            class="absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-500"
            :class="{
              'bg-emerald-500/40': svc.status === 'online',
              'bg-amber-500/40': svc.status === 'working' || svc.status === 'warning',
              'bg-red-500/50': svc.status === 'error',
              'bg-zinc-500/20': svc.status === 'offline',
            }"
          />
        </div>
      </div>

      <!-- 无匹配结果 -->
      <div v-if="filteredServices.length === 0" class="text-center text-xs text-zinc-600 py-8">
        没有{{ filterTabs.find(t => t.key === activeFilter)?.label }}状态的服务
      </div>

      <!-- 调试信息 -->
      <div v-if="status === 'closed'" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-400">
        WebSocket 未连接，部分服务状态可能不准确
      </div>
    </div>
  </div>
    </template>
