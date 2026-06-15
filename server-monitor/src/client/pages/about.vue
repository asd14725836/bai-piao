<script setup lang="ts">
import { Button } from '@client/components/ui/button'
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />
      <div class="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl" />
    </div>

    <div class="relative z-10 w-[90%] max-w-[400px]">
      <div class="mb-10 text-center">
        <h1 class="mb-2 text-3xl font-bold tracking-tight text-zinc-900">
          关于
        </h1>
        <p class="text-sm text-zinc-500">
          首尔服务器监控面板
        </p>
      </div>

      <div class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div class="flex items-center border-b border-zinc-100">
          <div class="w-20 shrink-0 px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">后端</div>
          <div class="px-4 py-3 text-sm text-zinc-700">Hono + Node.js</div>
        </div>
        <div class="flex items-center border-b border-zinc-100">
          <div class="w-20 shrink-0 px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">前端</div>
          <div class="px-4 py-3 text-sm text-zinc-700">Vue 3 + Vite</div>
        </div>
        <div class="flex items-center">
          <div class="w-20 shrink-0 px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">UI</div>
          <div class="px-4 py-3 text-sm text-zinc-700">Tailwind + shadcn-vue</div>
        </div>
      </div>

      <div class="mt-8 text-center">
        <router-link to="/">
          <Button variant="ghost" size="sm">← 返回首页</Button>
        </router-link>
      </div>
    </div>
  </div>
</template>
