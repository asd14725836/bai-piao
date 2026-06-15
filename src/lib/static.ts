import type { Hono } from 'hono'
import type { AppBindings } from '@/lib/create-app'

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { createLogger } from '@/lib/logger'

const logger = createLogger('Static')

const MIME_TYPES: Record<string, string> = {
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  txt: 'text/plain',
  webp: 'image/webp',
  webmanifest: 'application/manifest+json',
  xml: 'application/xml',
}

function getFrontDistPath(): string {
  if (typeof __dirname !== 'undefined') {
    const pkgPath = path.resolve(__dirname, 'front-dist')
    if (existsSync(pkgPath)) return pkgPath
  }
  return path.resolve(process.cwd(), 'front-dist')
}

function loadManifest(): Record<string, any> | null {
  const manifestPath = path.join(getFrontDistPath(), '.vite', 'manifest.json')
  if (!existsSync(manifestPath)) return null
  return JSON.parse(readFileSync(manifestPath, 'utf-8'))
}

function loadIndexHTML(): string | null {
  const indexPath = path.join(getFrontDistPath(), 'index.html')
  if (!existsSync(indexPath)) return null
  return readFileSync(indexPath, 'utf-8')
}

function getPublicFiles(): string[] {
  const frontDistPath = getFrontDistPath()
  if (!existsSync(frontDistPath)) return []
  return readdirSync(frontDistPath)
    .filter(f => {
      if (f.startsWith('.') || f.startsWith('_') || f === 'index.html') return false
      return statSync(path.join(frontDistPath, f)).isFile()
    })
    .map(f => `/${f}`)
}

const manifest = loadManifest()
const indexHTML = loadIndexHTML()
const publicFiles = getPublicFiles()

export function createStaticFileHandler() {
  const frontDistPath = getFrontDistPath()
  return async (c: any) => {
    const filePath = path.join(frontDistPath, c.req.path)
    try {
      const content = readFileSync(filePath)
      const ext = filePath.split('.').pop()
      const contentType = MIME_TYPES[ext || ''] || 'application/octet-stream'
      return c.body(content, 200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      })
    } catch {
      return c.notFound()
    }
  }
}

export function setupStatic(app: Hono<AppBindings>) {
  app.all('/.vite/*', c => c.text('Forbidden', 403))
  if (!manifest) return

  const handleStaticFile = createStaticFileHandler()
  app.get('/_assets/*', handleStaticFile)
  for (const file of publicFiles) {
    app.get(file, handleStaticFile)
  }

  logger.info(`front-dist: ${getFrontDistPath()}`)
  logger.info(`Manifest: ${Object.keys(manifest).length} entries`)
}

export function setupSpaFallback(app: Hono<AppBindings>) {
  app.get('*', async c => {
    if (indexHTML) return c.html(indexHTML, 200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    })
    return c.text('Front-end not built. Run: pnpm build:client', 404)
  })
}
