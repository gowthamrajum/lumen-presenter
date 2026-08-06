import { createServer, type Server } from 'http'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { join, normalize, sep } from 'path'

/**
 * Serve the built renderer over loopback HTTP, so the app has a real web origin.
 *
 * A packaged Electron app normally loads its pages from `file://`, and that is
 * fine until something embedded cares where it is being embedded FROM. YouTube
 * does: an embed on a `file://` page sends no origin and no referrer, and the
 * player refuses to start with **error 153**. Measured, not assumed — the same
 * embed on `http://127.0.0.1` reaches READY.
 *
 * So in packaged builds the renderer is served from 127.0.0.1 on an ephemeral
 * port instead. Nothing else about the app changes: the pages, their relative
 * asset paths and the CSP's `'self'` all mean the same thing over http, the
 * preload is attached by BrowserWindow rather than by URL, and `lumen-media:`
 * is a privileged scheme fetched by URL and so is unaffected by what scheme the
 * page itself came from.
 *
 * If the listen fails for any reason the caller falls back to `file://` and the
 * app runs exactly as it did before — minus YouTube, which is where it started.
 * Boot is worth more than an embed.
 *
 * Loopback only. It binds to 127.0.0.1 explicitly rather than to every
 * interface, so the church's projection machine is not quietly serving its
 * renderer to the building's wifi.
 */

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  map: 'application/json; charset=utf-8'
}

const mime = (p: string): string => TYPES[p.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

let server: Server | null = null
let base = ''

/** `http://127.0.0.1:<port>` once serving, else '' — the caller's cue to use file://. */
export const rendererBase = (): string => base

/**
 * Start serving `root`. Resolves to the base url, or '' if it could not listen.
 * Safe to call twice; the second call returns the running base.
 */
export function startRendererServer(root: string): Promise<string> {
  if (base) return Promise.resolve(base)
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      void (async () => {
        // The query carries ?layout=; only the path names a file.
        const raw = decodeURIComponent((req.url ?? '/').split('?')[0])
        const rel = normalize(raw).replace(/^([/\\])+/, '')
        // normalize() has already collapsed '..', so anything still climbing is
        // an attempt to read outside the bundle rather than a real path.
        if (rel.split(sep).includes('..')) {
          res.writeHead(403).end()
          return
        }
        const file = join(root, rel || 'index.html')
        try {
          const info = await stat(file)
          if (!info.isFile()) throw new Error('not a file')
          res.writeHead(200, {
            'Content-Type': mime(file),
            'Content-Length': String(info.size),
            // The bundle is rebuilt on every release and its asset names are
            // content-hashed; caching an old index.html across an update is the
            // one way this could serve a stale app.
            'Cache-Control': 'no-store'
          })
          createReadStream(file).pipe(res)
        } catch {
          res.writeHead(404).end()
        }
      })()
    })
    srv.on('error', () => resolve(''))
    // Port 0 → the OS picks a free one, so two copies never fight over a port.
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (!addr || typeof addr === 'string') {
        resolve('')
        return
      }
      server = srv
      base = `http://127.0.0.1:${addr.port}`
      resolve(base)
    })
  })
}

export function stopRendererServer(): void {
  server?.close()
  server = null
  base = ''
}
