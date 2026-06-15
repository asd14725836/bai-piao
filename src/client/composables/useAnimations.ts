/**
 * mini-watch 动画工具函数
 * 基于 anime.js v4
 * 注意：所有动画效果故意做明显，方便肉眼确认
 */
import { animate } from 'animejs'

/**
 * 页面入口 - 夸张版
 * 标题从顶部弹入 + 卡片从底部滑入
 */
export function pageEntrance(container: Element) {
  // 标题：从上方弹下来 + 放大
  const title = container.querySelector('h1')
  if (title) {
    animate(title, {
      translateY: [-60, 0],
      opacity: [0, 1],
      scale: [0.5, 1],
      duration: 800,
      ease: 'outBack(overshoot = 1.7)',
    })
  }

  // 顶部按钮区淡入
  const header = container.querySelector('.flex.items-center.justify-between')
  if (header) {
    const els = header.querySelectorAll('a, button, [class*=gap]')
    if (els.length) {
      animate([...els], {
        opacity: [0, 1],
        translateY: [-10, 0],
        duration: 400,
        delay: 200,
        ease: 'outCubic',
      })
    }
  }

  // 卡片：从底部弹入 + 放大
  const cards = container.querySelectorAll('.glass-card')
  if (cards.length) {
    animate([...cards], {
      translateY: [100, 0],
      opacity: [0, 1],
      scale: [0.9, 1],
      duration: 700,
      delay: (_el: Element, i: number) => 300 + i * 120,
      ease: 'outCubic',
    })
  }
}

/** agents.vue 兼容别名 */
export const cardEntrance = pageEntrance

/**
 * 数据更新 - 脉冲波动版
 * 卡片明显弹跳一下 + 边框发光
 */
export function dataUpdateWave(cards: NodeListOf<Element> | Element[]) {
  if (!cards.length) return

  // 只闪光，不动
  cards.forEach((c, i) => {
    setTimeout(() => {
      (c as HTMLElement).style.transition = 'box-shadow 0.3s ease'
      ;(c as HTMLElement).style.boxShadow = '0 0 30px rgba(99,102,241,0.3), 0 0 60px rgba(99,102,241,0.1)'
      setTimeout(() => {
        (c as HTMLElement).style.boxShadow = ''
      }, 400)
    }, i * 80)
  })
}

/**
 * Agent 状态切换 - 放大弹跳版
 */
export function statusMorph(dot: Element) {
  animate(dot, {
    scale: [3, 1],
    rotate: [360, 0],
    duration: 700,
    ease: 'outBack(overshoot = 1.7)',
  })
  // 同时让整个agent卡片闪一下
  const card = dot.closest('.flex.items-center.gap-3')
  if (card) {
    animate(card as HTMLElement, {
      backgroundColor: ['rgba(99,102,241,0.2)', 'rgba(255,255,255,0.02)'],
      duration: 1000,
      ease: 'outCubic',
    })
  }
}

/**
 * 数值更新 - 明显的跳动+闪烁
 */
export function animateValue(el: HTMLElement, from: number, to: number, suffix = '') {
  if (from === to) return
  el.style.transition = 'color 0.3s, text-shadow 0.3s'
  el.style.color = '#00d4ff'
  el.style.textShadow = '0 0 20px rgba(0,212,255,0.8)'

  animate(el, {
    innerText: [from, to],
    duration: 600,
    ease: 'outCubic',
    round: 1,
    onUpdate: (self: any) => {
      const val = Math.round(self.progress * (to - from) + from)
      el.innerText = `${val}${suffix}`
    },
    onComplete: () => {
      el.innerText = `${to}${suffix}`
      setTimeout(() => {
        el.style.color = ''
        el.style.textShadow = ''
      }, 500)
    },
  })
}
