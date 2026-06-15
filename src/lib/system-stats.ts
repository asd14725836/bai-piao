import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { logger } from './logger'

const log = logger.child('system-stats')

// ─── 类型定义 ─────────────────────────────────────
export interface SystemStats {
  cpu: { usage: number; cores: number }
  memory: { totalGB: number; usedGB: number; usedPct: number; availPct: number; swapTotalGB: number; swapUsedGB: number; buffersGB: number; cachedGB: number; sReclaimableGB: number; shmemGB: number }
  disk: { totalGB: number; usedGB: number; availGB: number; usedPct: number }
  network: { rxKBs: number; txKBs: number; iface: string }
  uptime: number
  loadAvg: number[]
}

export interface HistoryPoint {
  ts: number
  cpu: number
  mem: number
  rx: number
  tx: number
}

// ─── CPU 差值缓存 ─────────────────────────────────
let prevCpuTotal = 0
let prevCpuIdle = 0
let cpuFirstRun = true

// ─── 网络差值缓存 ─────────────────────────────────
let prevRx = 0n
let prevTx = 0n
let prevNetTs = 0

// ─── 采集辅助 ────────────────────────────────────
function readProc(path: string): string {
  return execSync(`cat ${path} 2>/dev/null || echo ''`, { timeout: 3000 }).toString().trim()
}

function execCmd(cmd: string): string {
  return execSync(cmd, { timeout: 3000 }).toString().trim()
}

// ─── CPU ─────────────────────────────────────────
function cpuUsage(): { usage: number; cores: number } {
  try {
    const raw = readProc('/proc/stat')
    const line = raw.split('\n').find(l => l.startsWith('cpu '))
    if (!line) return { usage: 0, cores: 1 }
    const parts = line.trim().split(/\s+/).slice(1).map(Number)
    if (parts.length < 4) return { usage: 0, cores: 1 }
    const idle = parts[3]
    const iowait = parts[4] ?? 0
    const total = parts.reduce((a: number, b: number) => a + b, 0)
    const idleTicks = idle + iowait
    const cores = raw.split('\n').filter(l => l.startsWith('cpu') && /^cpu\d+/.test(l)).length || 1

    // 第一次采集只记录值，返回0
    if (cpuFirstRun) {
      prevCpuTotal = total
      prevCpuIdle = idleTicks
      cpuFirstRun = false
      return { usage: 0, cores }
    }

    const dTotal = total - prevCpuTotal
    const dIdle = idleTicks - prevCpuIdle
    prevCpuTotal = total
    prevCpuIdle = idleTicks

    const usage = dTotal > 0 ? round1((1 - dIdle / dTotal) * 100) : 0
    return { usage, cores }
  } catch {
    return { usage: 0, cores: 1 }
  }
}

// ─── 内存 ────────────────────────────────────────
function memoryInfo() {
  try {
    const raw = readProc('/proc/meminfo')
    const lines = raw.split('\n')
    const getVal = (key: string): number => {
      for (const l of lines) {
        if (l.startsWith(key + ':')) {
          const parts = l.split(':')[1].trim().split(/\s+/)
          const num = parseInt(parts[0])
          return isNaN(num) ? 0 : num * 1024
        }
      }
      return 0
    }
    const total = getVal('MemTotal')
    const free = getVal('MemFree')
    const buffers = getVal('Buffers')
    const cached = getVal('Cached')
    const sReclaimable = getVal('SReclaimable')
    const shmem = getVal('Shmem')
    // 真实可用内存
    const avail = free + buffers + cached + sReclaimable - shmem
    const used = Math.max(0, total - avail)
    const totalGB = round2(total / (1024 ** 3))
    const usedGB = round2(used / (1024 ** 3))
    const usedPct = total > 0 ? round1((used / total) * 100) : 0
    const availPct = total > 0 ? round1((avail / total) * 100) : 0
    // swap
    const swapTotal = getVal('SwapTotal')
    const swapFree = getVal('SwapFree')
    const swapTotalGB = round2(swapTotal / (1024 ** 3))
    const swapUsedGB = round2(Math.max(0, swapTotal - swapFree) / (1024 ** 3))
    const buffersGB = round2(buffers / (1024 ** 3))
    const cachedGB = round2(cached / (1024 ** 3))
    const sReclaimableGB = round2(sReclaimable / (1024 ** 3))
    const shmemGB = round2(shmem / (1024 ** 3))
    return { totalGB, usedGB, usedPct, availPct, swapTotalGB, swapUsedGB, buffersGB, cachedGB, sReclaimableGB, shmemGB }
  } catch {
    return { totalGB: 0, usedGB: 0, usedPct: 0, availPct: 0, swapTotalGB: 0, swapUsedGB: 0, buffersGB: 0, cachedGB: 0, sReclaimableGB: 0, shmemGB: 0 }
  }
}

// ─── 磁盘 ────────────────────────────────────────
function diskInfo() {
  try {
    const out = execCmd('df -k / --output=size,used,avail,pcent 2>/dev/null | tail -1')
    const parts = out.split(/\s+/)
    if (parts.length < 4) return { totalGB: 0, usedGB: 0, availGB: 0, usedPct: 0 }
    const totalK = parseInt(parts[0])
    const usedK = parseInt(parts[1])
    const availK = parseInt(parts[2])
    // 兼容 512-block 格式
    let t = totalK, u = usedK, a = availK
    if (totalK > 10_000_000_000) { t = Math.round(totalK / 8); u = Math.round(usedK / 8); a = Math.round(availK / 8) }
    const totalBytes = t * 1024; const usedBytes = u * 1024; const availBytes = a * 1024
    return {
      totalGB: round2(totalBytes / (1024 ** 3)),
      usedGB: round2(usedBytes / (1024 ** 3)),
      availGB: round2(availBytes / (1024 ** 3)),
      usedPct: totalBytes > 0 ? round1((usedBytes / totalBytes) * 100) : 0,
    }
  } catch {
    return { totalGB: 0, usedGB: 0, availGB: 0, usedPct: 0 }
  }
}

// ─── 网络 ────────────────────────────────────────
function networkInfo() {
  try {
    const raw = readProc('/proc/net/dev')
    const lines = raw.split('\n').filter(l => l.includes(':') && !l.includes('lo'))
    if (lines.length === 0) return { rxKBs: 0, txKBs: 0, iface: '-' }
    const [ifname, rest] = lines[0].split(':')
    const parts = rest.trim().split(/\s+/)
    const rx = BigInt(parts[0] || '0')
    const tx = BigInt(parts[8] || '0')
    const now = Date.now()
    const iface = ifname.trim()
    let rxKBs = 0, txKBs = 0
    if (prevRx > 0n && prevTx > 0n && prevNetTs > 0) {
      const dt = (now - prevNetTs) / 1000
      if (dt > 0) {
        const rxDiff = rx >= prevRx ? Number(rx - prevRx) : 0
        const txDiff = tx >= prevTx ? Number(tx - prevTx) : 0
        rxKBs = round1((rxDiff) / dt / 1024)
        txKBs = round1((txDiff) / dt / 1024)
      }
    }
    prevRx = rx; prevTx = tx; prevNetTs = now
    return { rxKBs, txKBs, iface }
  } catch {
    return { rxKBs: 0, txKBs: 0, iface: '-' }
  }
}

// ─── 负载 ────────────────────────────────────────
function loadAvgInfo(): number[] {
  try {
    const raw = readProc('/proc/loadavg')
    return raw.split(/\s+/).slice(0, 3).map(Number)
  } catch { return [0, 0, 0] }
}

// ─── 主采集 ──────────────────────────────────────
export async function collectSystemStats(): Promise<SystemStats> {
  const cpu = cpuUsage()
  const mem = memoryInfo()
  const disk = diskInfo()
  const net = networkInfo()
  const loads = loadAvgInfo()
  const uptime = (() => {
    try { return parseFloat(readProc('/proc/uptime').split(/\s+/)[0]) || 0 }
    catch { return 0 }
  })()
  return {
    cpu: { usage: cpu.usage, cores: cpu.cores },
    memory: mem,
    disk,
    network: net,
    uptime,
    loadAvg: loads,
  }
}

// ─── 历史数据 ────────────────────────────────────
const HISTORY_MAX = 240
const HISTORY_FILE = resolve(process.cwd(), 'data/stats-history.json')
let history: HistoryPoint[] = []

let writeTimer: NodeJS.Timeout | null = null
function scheduleWrite() {
  if (writeTimer) return
  writeTimer = setTimeout(async () => {
    writeTimer = null
    try {
      await mkdir(dirname(HISTORY_FILE), { recursive: true })
      await writeFile(HISTORY_FILE, JSON.stringify(history))
    } catch (e) { log.warn(`persist history failed: ${String(e)}`) }
  }, 5_000)
  writeTimer.unref?.()
}

export async function loadHistory(): Promise<void> {
  try {
    if (!existsSync(HISTORY_FILE)) return
    const raw = await readFile(HISTORY_FILE, 'utf-8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      history = arr.slice(-HISTORY_MAX)
      log.info(`history loaded: ${history.length} points`)
    }
  } catch (e) { log.warn(`history load failed: ${String(e)}`) }
}

export function getHistory(): HistoryPoint[] {
  return history
}

function pushHistory(s: SystemStats) {
  history.push({
    ts: Date.now(),
    cpu: s.cpu.usage,
    mem: s.memory.usedPct,
    rx: s.network.rxKBs,
    tx: s.network.txKBs,
  })
  if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX)
  scheduleWrite()
}

// ─── 周期采集 ────────────────────────────────────
let pumpTimer: NodeJS.Timeout | null = null

export function isPumpRunning(): boolean { return pumpTimer != null }

export function startStatsPump(
  intervalMs: number,
  push: (s: SystemStats) => void,
  should: () => boolean,
) {
  if (pumpTimer) return
  log.info(`pump start, interval=${intervalMs}ms`)
  // 先重置 CPU 差值缓存，确保第一次采集不会出0
  cpuFirstRun = true
  pumpTimer = setInterval(async () => {
    if (!should()) { stopStatsPump(); return }
    try {
      const stats = await collectSystemStats()
      pushHistory(stats)
      push(stats)
    } catch (e) { log.warn(`collect failed: ${String(e)}`) }
  }, intervalMs)
  pumpTimer.unref?.()
}

export function stopStatsPump() {
  if (pumpTimer) { clearInterval(pumpTimer); pumpTimer = null; log.info('pump stop') }
}

// ─── 工具 ────────────────────────────────────────
function round1(n: number) { return Math.round(n * 10) / 10 }
function round2(n: number) { return Math.round(n * 100) / 100 }
