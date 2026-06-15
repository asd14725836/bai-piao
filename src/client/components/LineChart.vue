<script setup lang="ts">
/**
 * 赛博折线图 — 纯 SVG，无外部图表库
 * 支持多条折线、网格、时间轴、Y轴刻度、鼠标悬浮 crosshair + tooltip、入场动画、发光层
 */
export interface LineDataPoint {
  ts: number
  value: number
}

export interface LineDef {
  key: string
  label: string
  data: LineDataPoint[]
  color: string
}

const props = withDefaults(defineProps<{
  lines: LineDef[]
  width?: number
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  timeRange?: string
  formatValue?: (v: number) => string
}>(), {
  width: 600,
  height: 250,
  showGrid: true,
  showLegend: true,
  timeRange: '',
})

// ─── 边距 ───
const PAD = { top: 16, right: 16, bottom: 36, left: 48 }
const plotW = computed(() => props.width - PAD.left - PAD.right)
const plotH = computed(() => props.height - PAD.top - PAD.bottom)

// ─── 数据范围 ───
const allValues = computed(() => {
  const v: number[] = []
  for (const line of props.lines) {
    for (const pt of line.data) {
      if (pt.value != null && !isNaN(pt.value)) v.push(pt.value)
    }
  }
  return v
})

const allTs = computed(() => {
  const ts: number[] = []
  for (const line of props.lines) {
    for (const pt of line.data) {
      if (pt.ts != null) ts.push(pt.ts)
    }
  }
  return ts
})

const yMin = computed(() => {
  if (allValues.value.length === 0) return 0
  const min = Math.min(...allValues.value)
  return min >= 0 ? 0 : min
})

const yMax = computed(() => {
  if (allValues.value.length === 0) return 100
  const max = Math.max(...allValues.value)
  // 留 10% 顶部余量
  const padding = max * 0.1 || max * 0.5
  return Math.ceil((max + padding) / (10 ** Math.floor(Math.log10(max + 1)))) * (10 ** Math.floor(Math.log10(max + 1)))
})

const tsMin = computed(() => allTs.value.length > 0 ? Math.min(...allTs.value) : 0)
const tsMax = computed(() => allTs.value.length > 0 ? Math.max(...allTs.value) : 1)
const tsRange = computed(() => Math.max(tsMax.value - tsMin.value, 1))

// ─── 映射函数 ───
function xPos(ts: number): number {
  return PAD.left + ((ts - tsMin.value) / tsRange.value) * plotW.value
}

function yPos(value: number): number {
  return PAD.top + ((yMax.value - value) / (yMax.value - yMin.value)) * plotH.value
}

// ─── Polyline points 字符串 ───
function polylinePoints(data: LineDataPoint[]): string {
  return data
    .filter(d => d.value != null && !isNaN(d.value))
    .map(d => `${xPos(d.ts).toFixed(1)},${yPos(d.value).toFixed(1)}`)
    .join(' ')
}

// ─── 网格线和 Y 轴刻度 ───
const yTicks = computed(() => {
  const count = 5
  const ticks: { value: number; y: number }[] = []
  for (let i = 0; i <= count; i++) {
    const value = yMin.value + ((yMax.value - yMin.value) * i) / count
    ticks.push({ value, y: yPos(value) })
  }
  return ticks
})

// ─── X 轴时间标签 ───
const xLabels = computed(() => {
  const count = Math.min(6, allTs.value.length)
  if (count === 0) return []
  const step = Math.max(1, Math.floor(allTs.value.length / count))
  const labels: { ts: number; x: number; label: string }[] = []
  for (let i = 0; i < allTs.value.length; i += step) {
    const pt = allTs.value[i] // just use the sorted ts values... wait, we need sorted unique
    // Actually let's just pick evenly spaced positions
  }
  // Better approach: evenly spaced in the time range
  for (let i = 0; i <= count; i++) {
    const ts = tsMin.value + (tsRange.value * i) / count
    labels.push({ ts, x: xPos(ts), label: formatTime(ts) })
  }
  return labels
})

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const dMin = new Date(tsMin.value * 1000)
  const span = tsMax.value - tsMin.value
  // 跨度 > 7天 → 显示月-日
  if (span > 7 * 86400) {
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  // 跨度 > 1天 → 显示月/日 时
  if (span > 86400) {
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  // 否则显示 时:分
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── 数字格式化 ───
function defaultFormatter(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
  return v.toLocaleString()
}

function fmtVal(v: number): string {
  return (props.formatValue ?? defaultFormatter)(v)
}

// ─── 线条可见性 ───
const visible = ref<Record<string, boolean>>({})

// 初始化所有线条可见
watch(() => props.lines, (lines) => {
  for (const l of lines) {
    if (visible.value[l.key] === undefined) {
      visible.value[l.key] = true
    }
  }
}, { immediate: true })

function toggleLine(key: string) {
  visible.value[key] = !visible.value[key]
}

// ─── 唯一 ID 前缀 ───
const uid = ref(`lc-${Math.random().toString(36).slice(2, 8)}`)

// ─── 入场动画 — stroke-dasharray ───
const animReady = ref(false)
onMounted(() => {
  // 延迟触发，确保 DOM 已渲染
  setTimeout(() => { animReady.value = true }, 50)
})

// 计算每根线的 stroke-dasharray （用 path length）
// 我们使用 polyline，可以用 getTotalLength()，但这里用 ref 存
const lineLengths = ref<Record<string, number>>({})

function setLineLength(key: string, el: SVGElement | null) {
  if (el) {
    const len = el.getTotalLength?.() ?? 0
    lineLengths.value[key] = len
  }
}

// ─── 鼠标交互 — crosshair + tooltip ───
const svgRef = ref<SVGSVGElement | null>(null)
const hoverX = ref<number | null>(null)
const hoverData = ref<{ ts: number; values: { label: string; value: number; color: string }[] } | null>(null)

function onMouseMove(e: MouseEvent) {
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return
  const mx = e.clientX - rect.left
  // 找到最近的数据点
  let nearest: { ts: number; values: { label: string; value: number; color: string }[] } | null = null
  let minDist = Infinity
  for (const line of props.lines) {
    if (!visible.value[line.key]) continue
    for (const pt of line.data) {
      const px = xPos(pt.ts)
      const dist = Math.abs(px - mx)
      if (dist < minDist) {
        minDist = dist
        // 归集这个 ts 下所有线的值
        nearest = { ts: pt.ts, values: [] }
        for (const l of props.lines) {
          if (!visible.value[l.key]) continue
          const match = l.data.find(d => d.ts === pt.ts)
          if (match && match.value != null) {
            nearest.values.push({ label: l.label, value: match.value, color: l.color })
          }
        }
      }
    }
  }
  if (nearest && minDist < plotW.value * 0.15) {
    hoverX.value = xPos(nearest.ts)
    hoverData.value = nearest
  } else {
    hoverX.value = null
    hoverData.value = null
  }
}

function onMouseLeave() {
  hoverX.value = null
  hoverData.value = null
}

// 可见线条数量（用于动画延迟）
const visibleCount = computed(() => props.lines.filter(l => visible.value[l.key]).length)
</script>

<template>
  <div class="line-chart" :style="{ width: width + 'px', maxWidth: '100%' }">
    <!-- SVG 折线图 -->
    <svg
      ref="svgRef"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      class="line-svg"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    >
      <!-- 网格线（水平） -->
      <g v-if="showGrid" class="grid-lines">
        <line
          v-for="(tick, i) in yTicks"
          :key="'g-' + i"
          :x1="PAD.left"
          :y1="tick.y"
          :x2="width - PAD.right"
          :y2="tick.y"
          class="grid-line"
        />
      </g>

      <!-- Y 轴刻度 -->
      <g class="y-axis">
        <text
          v-for="(tick, i) in yTicks"
          :key="'y-' + i"
          :x="PAD.left - 8"
          :y="tick.y + 4"
          class="axis-label-y"
        >
          {{ fmtVal(tick.value) }}
        </text>
      </g>

      <!-- X 轴时间标签 -->
      <g class="x-axis">
        <text
          v-for="(lab, i) in xLabels"
          :key="'x-' + i"
          :x="lab.x"
          :y="height - 6"
          class="axis-label-x"
        >
          {{ lab.label }}
        </text>
      </g>

      <!-- 折线 + 发光层（每行可见的线） -->
      <g v-for="(line, idx) in lines.filter(l => visible[l.key])" :key="'line-' + line.key">
        <!-- 发光层 -->
        <polyline
          :points="polylinePoints(line.data)"
          :stroke="line.color"
          fill="none"
          stroke-width="5"
          class="line-glow"
          opacity="0.25"
          style="filter: blur(6px)"
        />
        <!-- 主折线 -->
        <polyline
          :points="polylinePoints(line.data)"
          :stroke="line.color"
          fill="none"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          class="line-polyline"
          :class="{ 'line-animated': animReady }"
          :style="{
            strokeDasharray: lineLengths[line.key] || 2000,
            strokeDashoffset: animReady ? 0 : (lineLengths[line.key] || 2000),
            '--anim-delay': (idx * 200) + 'ms',
          }"
          :ref="(el: any) => setLineLength(line.key, el as SVGElement | null)"
        />
        <!-- 数据点（小圆点） -->
        <circle
          v-for="(pt, pi) in line.data.filter(d => d.value != null && !isNaN(d.value))"
          :key="'pt-' + line.key + '-' + pi"
          :cx="xPos(pt.ts)"
          :cy="yPos(pt.value)"
          r="3"
          :fill="line.color"
          class="line-dot"
        />
      </g>

      <!-- 空数据提示 -->
      <text
        v-if="allValues.length === 0"
        :x="width / 2"
        :y="height / 2"
        text-anchor="middle"
        class="empty-text"
      >
        暂无数据
      </text>

      <!-- crosshair 竖线 -->
      <line
        v-if="hoverX != null"
        :x1="hoverX"
        :y1="PAD.top"
        :x2="hoverX"
        :y2="height - PAD.bottom"
        class="crosshair-line"
      />
    </svg>

    <!-- Tooltip -->
    <div
      v-if="hoverData && hoverX != null"
      class="line-tooltip"
      :style="{
        left: Math.min(Math.max(hoverX + PAD.left, 10), width - 160) + 'px',
        top: '8px',
      }"
    >
      <div class="tooltip-time">{{ formatTime(hoverData.ts) }}</div>
      <div v-for="(v, i) in hoverData.values" :key="i" class="tooltip-row">
        <span class="tooltip-dot" :style="{ background: v.color }" />
        <span class="tooltip-label">{{ v.label }}</span>
        <span class="tooltip-value">{{ fmtVal(v.value) }}</span>
      </div>
    </div>

    <!-- 图例 -->
    <div v-if="showLegend && lines.length > 0" class="line-legend">
      <button
        v-for="line in lines"
        :key="'leg-' + line.key"
        class="legend-btn"
        :class="{ 'legend-hidden': !visible[line.key] }"
        @click="toggleLine(line.key)"
      >
        <span class="legend-dot" :style="{ background: line.color, boxShadow: visible[line.key] ? `0 0 6px ${line.color}` : 'none' }" />
        <span class="legend-label">{{ line.label }}</span>
      </button>
      <span v-if="timeRange" class="legend-range">{{ timeRange }}</span>
    </div>
  </div>
</template>

<style scoped>
.line-chart {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.line-svg {
  display: block;
  max-width: 100%;
  height: auto;
}

/* ===== 网格线 ===== */
.grid-line {
  stroke: rgba(60, 60, 120, 0.25);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

/* ===== 坐标轴标签 ===== */
.axis-label-y {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: rgba(160, 160, 200, 0.4);
  text-anchor: end;
  dominant-baseline: middle;
}

.axis-label-x {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: rgba(160, 160, 200, 0.4);
  text-anchor: middle;
  dominant-baseline: hanging;
}

/* ===== 折线 ===== */
.line-polyline {
  transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1);
  transition-delay: var(--anim-delay, 0ms);
}

.line-animated {
  stroke-dashoffset: 0 !important;
}

/* 初始状态（动画前） */
.line-polyline:not(.line-animated) {
  stroke-dashoffset: var(--dashoffset, 2000);
}

/* ===== 数据点 ===== */
.line-dot {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.line-svg:hover .line-dot {
  opacity: 0.8;
}

.line-svg:hover .line-dot:hover {
  opacity: 1;
  r: 5;
}

/* ===== 空数据 ===== */
.empty-text {
  fill: rgba(160, 160, 200, 0.3);
  font-size: 12px;
  font-family: var(--font-sans);
}

/* ===== crosshair ===== */
.crosshair-line {
  stroke: rgba(160, 160, 200, 0.3);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  pointer-events: none;
}

/* ===== Tooltip ===== */
.line-tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(10, 10, 30, 0.9);
  border: 1px solid rgba(100, 100, 255, 0.2);
  border-radius: 6px;
  padding: 6px 10px;
  min-width: 100px;
  backdrop-filter: blur(8px);
  z-index: 20;
}

.tooltip-time {
  font-size: 9px;
  font-family: var(--font-mono);
  color: rgba(160, 160, 200, 0.5);
  margin-bottom: 3px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-family: var(--font-mono);
  line-height: 1.5;
}

.tooltip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tooltip-label {
  color: rgba(200, 200, 240, 0.7);
  min-width: 32px;
}

.tooltip-value {
  font-weight: 600;
  color: #e0e0ff;
  text-align: right;
  flex: 1;
}

/* ===== 图例 ===== */
.line-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 2px;
}

.legend-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  font-family: var(--font-mono);
  font-size: 10px;
}

.legend-btn:hover {
  background: rgba(100, 100, 255, 0.1);
}

.legend-hidden {
  opacity: 0.35;
}

.legend-hidden .legend-label {
  text-decoration: line-through;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  color: rgba(200, 200, 240, 0.6);
}

.legend-range {
  font-size: 9px;
  font-family: var(--font-mono);
  color: rgba(160, 160, 200, 0.3);
  margin-left: auto;
}
</style>
