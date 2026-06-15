<script setup lang="ts">
/**
 * 赛博环形饼图（多段分布图）
 * 适合展示工具调用占比、平台Token分布等
 */
interface DonutItem {
  value: number
  label: string
  color: string
}

const props = withDefaults(defineProps<{
  items: DonutItem[]
  totalLabel?: string
  size?: number
  strokeWidth?: number
  centerText?: string
  centerSub?: string
}>(), {
  size: 140,
  strokeWidth: 18,
})

// 排序（从大到小）
const sorted = computed(() => [...props.items].sort((a, b) => b.value - a.value))

const total = computed(() => sorted.value.reduce((s, i) => s + i.value, 0))

const viewSize = computed(() => props.size + 4)
const cx = computed(() => viewSize.value / 2)
const cy = computed(() => viewSize.value / 2)
const r = computed(() => (props.size - props.strokeWidth - 4) / 2)
const circ = computed(() => 2 * Math.PI * r.value)

// 计算每个段的 dasharray/dashoffset
const segments = computed(() => {
  let offset = 0
  return sorted.value.map((item) => {
    const pct = total.value > 0 ? item.value / total.value : 0
    const len = circ.value * pct
    const seg = {
      label: item.label,
      value: item.value,
      pct,
      color: item.color,
      dasharray: `${len} ${circ.value - len}`,
      dashoffset: -offset,
    }
    offset += len
    return seg
  })
})

function fmtNum(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}
</script>

<template>
  <div class="donut-wrapper">
    <svg
      :width="viewSize"
      :height="viewSize"
      :viewBox="`0 0 ${viewSize} ${viewSize}`"
      class="donut-svg"
    >
      <!-- 底圈 -->
      <circle
        :cx="cx" :cy="cy" :r="r"
        fill="none"
        stroke="rgba(30, 30, 60, 0.5)"
        :stroke-width="strokeWidth"
      />

      <!-- 各段弧 -->
      <circle
        v-for="(seg, i) in segments"
        :key="i"
        :cx="cx" :cy="cy" :r="r"
        fill="none"
        :stroke="seg.color"
        :stroke-width="strokeWidth"
        stroke-linecap="butt"
        :stroke-dasharray="seg.dasharray"
        :stroke-dashoffset="seg.dashoffset"
        class="donut-segment"
        transform="rotate(-90, cx, cy)"
        :style="{ transformOrigin: `${cx}px ${cy}px` }"
      />

      <!-- 发光层 -->
      <circle
        v-for="(seg, i) in segments"
        :key="'glow-' + i"
        :cx="cx" :cy="cy" :r="r"
        fill="none"
        :stroke="seg.color"
        :stroke-width="strokeWidth + 4"
        stroke-linecap="butt"
        :stroke-dasharray="seg.dasharray"
        :stroke-dashoffset="seg.dashoffset"
        class="donut-glow"
        opacity="0.15"
        transform="rotate(-90, cx, cy)"
        :style="{ transformOrigin: `${cx}px ${cy}px` }"
      />
    </svg>

    <!-- 中心文字 -->
    <div class="donut-center">
      <div class="donut-center-value" v-if="centerText">{{ centerText }}</div>
      <div class="donut-center-sub" v-else-if="centerSub">{{ centerSub }}</div>
      <div class="donut-center-total" v-else>{{ fmtNum(total) }}</div>
      <div class="donut-center-label" v-if="totalLabel">{{ totalLabel }}</div>
    </div>
  </div>

  <!-- 图例 -->
  <div class="donut-legend" v-if="items.length > 0">
    <div v-for="(item, i) in sorted" :key="i" class="donut-legend-item">
      <span class="donut-legend-dot" :style="{ background: item.color }" />
      <span class="donut-legend-label">{{ item.label }}</span>
      <span class="donut-legend-value">{{ fmtNum(item.value) }}</span>
      <span class="donut-legend-pct" v-if="total > 0">{{ (item.pct * 100).toFixed(1) }}%</span>
    </div>
  </div>
</template>

<style scoped>
.donut-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
}

.donut-svg {
  display: block;
  max-width: 100%;
  height: auto;
  filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.12));
}

.donut-segment {
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.donut-glow {
  filter: blur(5px);
  transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.donut-center {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  gap: 2px;
}

.donut-center-value {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  color: #e0e0ff;
}

.donut-center-total {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 700;
  color: #e0e0ff;
}

.donut-center-sub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: rgba(160, 160, 200, 0.6);
}

.donut-center-label {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(160, 160, 200, 0.5);
}

/* ===== 图例 ===== */
.donut-legend {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  justify-content: center;
  margin-top: 2px;
}

.donut-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6rem;
  font-family: var(--font-mono);
}

.donut-legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.donut-legend-label {
  color: rgba(160, 160, 200, 0.7);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.donut-legend-value {
  color: rgba(200, 200, 240, 0.9);
  font-weight: 600;
}

.donut-legend-pct {
  color: rgba(160, 160, 200, 0.4);
  font-size: 0.55rem;
}
</style>
