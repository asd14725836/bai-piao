import type { Updater } from '@vueuse/core'
import type { Ref } from 'vue'
import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function useVModel<T>(props: Record<string, any>, key: string, emit: (name: string, ...args: any[]) => void) {
  const model = computed({
    get: () => props[key],
    set: (value: T) => emit(`update:${key}`, value),
  })
  return model as Ref<T>
}
