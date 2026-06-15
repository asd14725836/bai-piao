<script setup lang="ts">
/**
 * 科技感粒子背景 - v2 亮眼版
 * 使用 Canvas 2D 绘制漂浮粒子+连线
 */
withDefaults(defineProps<{
  show?: boolean
  density?: number
  speed?: number
  interactive?: boolean
}>(), {
  show: true,
  density: 80,
  speed: 1.0,
  interactive: true,
})

const canvas = ref<HTMLCanvasElement | null>(null)
let animId = 0
let particles: Particle[] = []
let mouseX = -9999
let mouseY = -9999

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  alphaSpeed: number
  color: string
}

// 亮色粒子颜色池
const COLORS = [
  '0,212,255',   // 亮青 - 赛博蓝
  '255,0,255',   // 品红 - 赛博粉
  '168,85,247',  // 紫
  '236,72,153',  // 粉
  '255,100,100', // 霓虹红
  '0,255,200',   // 青绿
]

function initParticles(w: number, h: number) {
  const count = Math.max(20, Math.min(120, Math.floor((w * h) / (props.density * props.density))))
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    size: Math.random() * 3 + 2,    // 2~5px
    alpha: Math.random() * 0.5 + 0.3, // 0.3~0.8
    alphaSpeed: (Math.random() - 0.5) * 0.004,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }))
}

function draw() {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  const w = cvs.width
  const h = cvs.height
  const speed = props.speed

  ctx.clearRect(0, 0, w, h)

  // 先用一个半透明径向渐变打底，让粒子更突出
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7)
  grad.addColorStop(0, 'rgba(99,102,241,0.03)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  for (const p of particles) {
    p.x += p.vx * speed
    p.y += p.vy * speed
    p.alpha += p.alphaSpeed * speed

    if (p.x < -20) p.x = w + 20
    if (p.x > w + 20) p.x = -20
    if (p.y < -20) p.y = h + 20
    if (p.y > h + 20) p.y = -20

    if (p.alpha < 0.1 || p.alpha > 0.8) p.alphaSpeed *= -1

    // 粒子发光效果：外圈模糊
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${p.color}, ${p.alpha * 0.15})`
    ctx.fill()

    // 粒子本体
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`
    ctx.fill()

    // 连线
    if (props.interactive) {
      for (let j = 0; j < particles.length; j++) {
        const p2 = particles[j]
        if (p === p2) continue
        const dx = p.x - p2.x
        const dy = p.y - p2.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150) {
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.strokeStyle = `rgba(99,102,241, ${(1 - dist / 150) * 0.2})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }

    // 鼠标交互
    if (props.interactive && mouseX > 0 && mouseY > 0) {
      const dx = p.x - mouseX
      const dy = p.y - mouseY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 120) {
        const force = (120 - dist) / 120 * 0.8
        p.x += (dx / dist) * force
        p.y += (dy / dist) * force
      }
    }
  }

  animId = requestAnimationFrame(draw)
}

function onMouseMove(e: MouseEvent) {
  const rect = canvas.value?.getBoundingClientRect()
  if (rect) {
    mouseX = e.clientX - rect.left
    mouseY = e.clientY - rect.top
  }
}

function onMouseLeave() {
  mouseX = -9999
  mouseY = -9999
}

onMounted(() => {
  const cvs = canvas.value
  if (!cvs) return

  const resize = () => {
    if (!cvs.parentElement) return
    cvs.width = cvs.parentElement.clientWidth
    cvs.height = cvs.parentElement.clientHeight
    initParticles(cvs.width, cvs.height)
  }

  resize()
  draw()
  window.addEventListener('resize', resize)

  if (props.interactive) {
    cvs.addEventListener('mousemove', onMouseMove)
    cvs.addEventListener('mouseleave', onMouseLeave)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
})
</script>

<template>
  <canvas
    v-if="show"
    ref="canvas"
    class="fixed inset-0 pointer-events-none z-0"
  />
</template>
