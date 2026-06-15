import { createRouter } from '@/lib/create-app'
import { execSync } from 'node:child_process'
import { logger } from '@/lib/logger'

const log = logger.child('disks')

interface DiskPartition {
  filesystem: string
  type: string
  totalGB: string
  usedGB: string
  availGB: string
  usedPct: number
  mount: string
}

// 虚拟文件系统类型，需要过滤掉
const VIRTUAL_FS = new Set([
  'tmpfs', 'devtmpfs', 'squashfs', 'overlay',
  'devpts', 'proc', 'sysfs', 'cgroup', 'cgroup2',
  'hugetlbfs', 'mqueue', 'pstore', 'efivarfs',
  'securityfs', 'selinuxfs', 'debugfs', 'tracefs',
  'ramfs', 'autofs', 'configfs', 'bpf',
])

function parseDfOutput(raw: string): DiskPartition[] {
  const lines = raw.trim().split('\n')
  if (lines.length < 2) return []

  const partitions: DiskPartition[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // df -hT output: Filesystem Type Size Used Avail Use% Mounted on
    // Some lines may have spaces in filesystem name (e.g. /dev/mapper/root)
    // We parse backwards since mount point is the last field
    const parts = line.split(/\s+/)
    if (parts.length < 7) continue

    const mount = parts.pop()! // last field is mount point
    const usedPctRaw = parts.pop()! // second to last is Use% (e.g. "50%" or "-")
    const avail = parts.pop()!
    const used = parts.pop()!
    const size = parts.pop()!
    const type = parts.pop()!
    // everything remaining is the filesystem name (may contain spaces)
    const filesystem = parts.join(' ')

    // Skip virtual filesystems
    if (VIRTUAL_FS.has(type)) continue

    // Parse usage percentage, skip if not available (e.g. "-")
    const usedPct = usedPctRaw === '-' ? 0 : Number.parseInt(usedPctRaw.replace('%', ''), 10)
    if (Number.isNaN(usedPct)) continue

    partitions.push({
      filesystem,
      type,
      totalGB: size,
      usedGB: used,
      availGB: avail,
      usedPct,
      mount,
    })
  }

  // Sort by usedPct descending
  partitions.sort((a, b) => b.usedPct - a.usedPct)

  return partitions
}

let cachedPartitions: DiskPartition[] | null = null
let lastFetch = 0
const CACHE_TTL = 10_000 // 10 seconds

function fetchPartitions(): DiskPartition[] {
  const now = Date.now()
  if (cachedPartitions && now - lastFetch < CACHE_TTL) {
    return cachedPartitions
  }

  try {
    const stdout = execSync('df -hT', {
      encoding: 'utf-8',
      timeout: 5000,
    })
    cachedPartitions = parseDfOutput(stdout)
    lastFetch = now
    return cachedPartitions
  } catch (err) {
    log.warn('Failed to execute df -hT', { err })
    return []
  }
}

const router = createRouter()

// GET /api/disks/partitions — 所有挂载分区详情
router.get('/api/disks/partitions', (c) => {
  const partitions = fetchPartitions()
  return c.json(partitions)
})

export default router
