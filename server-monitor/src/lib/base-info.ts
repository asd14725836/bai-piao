import { execSync } from 'node:child_process'
import os from 'node:os'
import { logger } from './logger'
import { storage } from './cache'

const log = logger.child('base-info')

export interface BaseInfo {
  hostname: string
  platform: string
  arch: string
  osName: string
  osVersion: string
  cpuCores: number
  memoryGB: number
  /** OS 启动时间戳 ms */
  bootTime: number
  /** OS 已运行 ms */
  uptimeMs: number
  /** 本服务启动时间戳 ms */
  serverStartedAt: number
}

function execCmd(cmd: string, fallback = ''): string {
  try {
    return execSync(cmd, { timeout: 3000 }).toString().trim()
  } catch {
    return fallback
  }
}

async function collectBaseInfoSync(): Promise<BaseInfo> {
  const [osName, osVersion] = (() => {
    try {
      const osRelease = execCmd('cat /etc/os-release 2>/dev/null || cat /usr/lib/os-release 2>/dev/null')
      const name = osRelease.match(/^NAME=['"]?(.+?)['"]?$/m)?.[1] || 'Linux'
      const ver = osRelease.match(/^VERSION_ID=['"]?(.+?)['"]?$/m)?.[1] || ''
      return [name, ver]
    } catch {
      return ['Linux', '']
    }
  })()

  const bootTime = (() => {
    try {
      const raw = execCmd('cat /proc/stat')
      const m = raw.match(/^btime\s+(\d+)/m)
      return m ? parseInt(m[1]) * 1000 : Date.now() - os.uptime() * 1000
    } catch {
      return Date.now() - os.uptime() * 1000
    }
  })()

  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    osName,
    osVersion,
    cpuCores: os.cpus().length,
    memoryGB: Math.round(os.totalmem() / (1024 ** 3) * 10) / 10,
    bootTime,
    uptimeMs: os.uptime() * 1000,
    serverStartedAt: Date.now(),
  }
}

let cached: BaseInfo | null = null

export async function collectBaseInfo(): Promise<void> {
  try {
    cached = await collectBaseInfoSync()
    await storage.setItem('server:base_info', cached)
    log.info(`base info collected: ${cached.hostname} / ${cached.osName} ${cached.osVersion} / ${cached.cpuCores}c${cached.memoryGB}g`)
  } catch (e) {
    log.warn(`collect base info failed: ${String(e)}`)
  }
}

export async function getBaseInfo(): Promise<BaseInfo | null> {
  if (cached) return cached
  try {
    cached = await storage.getItem<BaseInfo>('server:base_info')
    return cached
  } catch {
    return null
  }
}
