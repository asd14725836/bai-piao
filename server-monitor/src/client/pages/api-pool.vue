<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ParticlesBg from '@client/components/ParticlesBg.vue'

interface ApiKey {
  id: string
  key: string
  key_preview: string
  model: string
  model_name: string
  company: string
  description: string
  status: string
  last_tested: string
  response_time: number
  test_result: string
  balance: number | null
}

interface PoolData {
  endpoint: string
  last_updated: string
  keys: ApiKey[]
}

const poolData = ref<PoolData | null>(null)
const loading = ref(true)
const error = ref('')
let timer: number | null = null

async function loadData() {
  try {
    const resp = await fetch('/api/api-pool')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    poolData.value = await resp.json()
    error.value = ''
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  timer = window.setInterval(loadData, 30000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function statusBadge(s: string) {
  switch (s) {
    case 'available': return { cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: '✅ 可用' }
    case 'unavailable': return { cls: 'bg-red-500/20 text-red-400 border-red-500/30', label: '❌ 不可用' }
    default: return { cls: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', label: '❓ 未知' }
  }
}

function timeColor(ms: number) {
  if (ms < 2) return 'text-emerald-400'
  if (ms < 5) return 'text-amber-400'
  return 'text-red-400'
}
</script>

<template>
  <ParticlesBg :show="true" />
  <div class="tech-bg min-h-screen p-4 relative z-10">
    <div class="mx-auto max-w-4xl space-y-4">
      <!-- 头部 -->
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">
          <span class="gradient-text glitch-target" data-text="API 备用池">API 备用池</span>
        </h1>
        <div class="flex items-center gap-2">
          <button @click="loadData" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white transition-all">🔄 刷新</button>
          <router-link to="/services" class="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white transition-all">← 返回</router-link>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="text-center text-zinc-500 text-sm py-12">加载中...</div>

      <!-- 错误 -->
      <div v-if="error" class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">加载失败: {{ error }}</div>

      <!-- 空池 -->
      <div v-if="poolData && poolData.keys.length === 0" class="glass-card rounded-xl p-6 text-center border border-amber-500/30 bg-amber-500/10">
        <p class="text-amber-400 text-sm">⚠️ 备用池为空，所有密钥已失效</p>
        <p class="text-zinc-500 text-xs mt-1">检测脚本每5分钟自动检查，有可用密钥时会自动加入</p>
      </div>

      <!-- 数据 -->
      <template v-if="poolData && poolData.keys.length > 0">
        <!-- 概览 -->
        <div class="glass-card rounded-xl p-4 border border-white/10">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div class="text-xs text-zinc-500 mb-1">API 端点</div>
              <code class="text-sm text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{{ poolData.endpoint }}</code>
            </div>
            <div class="flex items-center gap-3 text-xs text-zinc-400">
              <span>密钥: <strong class="text-white">{{ poolData.keys.filter(k => k.status === 'available').length }}/{{ poolData.keys.length }}</strong> 可用</span>
              <span>更新: {{ poolData.last_updated?.slice(0, 16) || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 密钥卡片 -->
        <div class="space-y-3">
          <div
            v-for="key in poolData.keys"
            :key="key.id"
            class="glass-card rounded-xl p-4 border transition-all duration-300"
            :class="key.status === 'available' ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-red-500/20 hover:border-red-500/40'"
          >
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-semibold text-sm text-white">{{ key.model_name || key.model }}</span>
                  <span v-if="key.company" class="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{{ key.company }}</span>
                  <span class="rounded-lg px-2 py-0.5 text-[10px] border" :class="statusBadge(key.status).cls">{{ statusBadge(key.status).label }}</span>
                </div>
                <div class="text-xs text-zinc-500">模型ID: <code class="text-zinc-400">{{ key.model }}</code></div>
                <div v-if="key.description" class="text-[10px] text-zinc-600 mt-0.5">{{ key.description }}</div>
              </div>
            </div>

            <!-- 完整密钥（可直接手选复制） -->
            <div class="mb-3">
              <code class="block bg-black/30 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 break-all select-all">{{ key.key }}</code>
            </div>

            <!-- 详情 -->
            <div class="flex items-center gap-4 text-[10px] text-zinc-600">
              <span>测试: <span class="text-zinc-400">{{ key.last_tested || '-' }}</span></span>
              <span>响应: <span :class="timeColor(key.response_time)">{{ key.response_time?.toFixed(2) || '-' }}s</span></span>
              <span>余额: <span class="text-amber-400">{{ key.balance != null ? '¥' + key.balance?.toFixed(2) : 'N/A' }}</span></span>
              <span v-if="key.test_result !== 'success'" class="text-red-400">{{ key.test_result }}</span>
            </div>
          </div>
        </div>

        <!-- 自动刷新提示 -->
        <div class="text-center text-[10px] text-zinc-600">每30秒自动刷新 · 检测脚本每5分钟检查一次</div>
      </template>
    </div>
  </div>
</template>