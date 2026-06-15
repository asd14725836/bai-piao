<script setup lang="ts">
/**
 * 赛博环形仪表盘
 * 参数：百分比、颜色梯度、标签、数值文字、大小
 */
const props = withDefaults(defineProps<{
  pct: number
  label: string
  value: string
  sub?: string
  size?: number
  strokeWidth?: number
  colors?: string[]
}>(), {
  size: 95,
  strokeWidth: 6,
  colors: () => ['#00d4ff', '#a855f7'],
})

// SVG 坐标
const viewSize = computed(() => props.size + 4)
const cx = computed(() => viewSize.value / 2)
const cy = computed(() => viewSize.value / 2)
const r = computed(() => (props.size - props.strokeWidth - 4) / 2)
const circ = computed(() => 2 * Math.PI * r.value)

// 把 pct 映射为 stroke-dashoffset
const dashOffset = computed(() => {
  const pct = Math.min(props.pct, 100)
  return circ.value * (1 - pct / 100)
})

// 颜色渐变 ID
const uid = ref('')
onMounted(() => {
  uid.value = `ring-${Math.random().toString(36).slice(2, 8)}`
})

// 告警色
const warnClass = computed(() => {
  if (props.pct > 90) return 'ring-danger'
  if (props.pct > 80) return 'ring-warning'
  return ''
})

// 数字闪烁
const flash = ref(false)
watch(() => props.pct, () => {
  flash.value = true
  setTimeout(() => flash.value = false, 300)
})
</script>

<template>
  <div class="ring-gauge-wrapper" :class="warnClass">
    <svg
      :width="viewSize"
      :height="viewSize"
      :viewBox="`0 0 ${viewSize} ${viewSize}`"
      class="ring-svg"
    >
      <defs>
        <linearGradient
          v-if="uid"
          :id="uid"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" :stop-color="colors[0]" />
          <stop offset="100%" :stop-color="colors[1]" />
        </linearGradient>
      </defs>

      <!-- 底圈 -->
      <circle
        :cx="cx"
        :cy="cy"
        :r="r"
        fill="none"
        stroke="rgba(30, 30, 60, 0.8)"
        :stroke-width="strokeWidth"
      />

      <!-- 进度圈 -->
      <circle
        :cx="cx"
        :cy="cy"
        :r="r"
        fill="none"
        :stroke="uid ? `url(#${uid})` : colors[0]"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="circ"
        :stroke-dashoffset="dashOffset"
        class="ring-progress"
        transform="rotate(-90, cx, cy)"
        :style="{ transformOrigin: `${cx}px ${cy}px` }"
      />

      <!-- 发光层 -->
      <circle
        :cx="cx"
        :cy="cy"
        :r="r"
        fill="none"
        :stroke="uid ? `url(#${uid})` : colors[0]"
        :stroke-width="strokeWidth + 2"
        stroke-linecap="round"
        :stroke-dasharray="circ"
        :stroke-dashoffset="dashOffset"
        class="ring-glow"
        opacity="0.3"
        transform="rotate(-90, cx, cy)"
        :style="{ transformOrigin: `${cx}px ${cy}px` }"
      />
    </svg>

    <!-- 中心文字 -->
    <div class="ring-center">
      <div class="ring-value" :class="{ 'ring-value-flash': flash }">
        {{ value }}
      </div>
      <div class="ring-sub" v-if="sub">{{ sub }}</div>
    </div>

    <!-- 底部标签 -->
    <div class="ring-label">{{ label }}</div>
  </div>
</template>

<style scoped>
.ring-gauge-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
  transition: filter 0.3s;
  min-width: 0;
  flex: 1;
  max-width: 95px;
}

.ring-svg {
  display: block;
  max-width: 100%;
  height: auto;
  filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.15));
}

.ring-progress {
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.ring-glow {
  filter: blur(6px);
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.ring-center {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  padding: 6px;
  overflow: hidden;
  box-sizing: border-box;
}

.ring-value {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  color: #e0e0ff;
  transition: color 0.2s;
  font-variant-numeric: tabular-nums;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.1;
  word-break: keep-all;
}

.ring-value-flash {
  color: #00d4ff;
  text-shadow: 0 0 12px rgba(0, 212, 255, 0.6);
}

.ring-sub {
  font-size: 0.55rem;
  color: rgba(160, 160, 200, 0.6);
}

.ring-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(160, 160, 200, 0.5);
  margin-top: -2px;
}

/* 告警脉冲 */
.ring-warning .ring-glow {
  filter: blur(8px);
  opacity: 0.5 !important;
}

.ring-danger .ring-svg {
  animation: ring-pulse-danger 1s infinite;
}

@keyframes ring-pulse-danger {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.4)); }
  50% { filter: drop-shadow(0 0 16px rgba(239, 68, 68, 0.7)); }
}
</style>
