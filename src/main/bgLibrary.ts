import { app, dialog, type BrowserWindow } from 'electron'
import { createHash } from 'crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs'
import { copyFile, rename, stat, unlink } from 'fs/promises'
import { request as httpsRequest } from 'https'
import { request as httpRequest, type IncomingMessage } from 'http'
import { basename, extname, join } from 'path'
import { relayBase } from './serviceFeed'
import type { BgImportProgress, BgImportResult, LibraryBackground } from '../shared/types'

/**
 * The shared background library — video backgrounds imported once and offered
 * in every Cantica's background picker.
 *
 * A video goes STRAIGHT to the church's media store (Cloudflare R2), with an
 * upload URL the relay signs, and is then registered with the relay so every
 * presenter lists it. The relay never carries the bytes.
 *
 * The projector plays its own copy. Every library file is downloaded into a
 * local cache in the background, and the live state sent to the output windows
 * has those URLs swapped for the cached files (see `localize`) — so a looping
 * 1080p video never waits on the church's network. The relay, the phones and
 * the stream get the cloud URL, which is the only one they can reach.
 */

const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm'
}

let toMediaUrl: (absPath: string) => string = (p) => p
let onCacheChange: () => void = () => {}
/** cloud URL → lumen-media URL of the cached copy */
const local = new Map<string, string>()
const downloading = new Set<string>()
/** Every URL in the library, as last listed — what is worth caching. */
const known = new Set<string>()

const cacheDir = (): string => {
  const d = join(app.getPath('userData'), 'bg-cache')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}
/** Stable per URL, so the cache is found again after a restart without an index. */
const cacheFile = (url: string): string =>
  join(cacheDir(), createHash('sha1').update(url).digest('hex').slice(0, 24) + (extname(new URL(url).pathname) || '.mp4'))

export function initBgLibrary(opts: { mediaUrl: (absPath: string) => string; onCacheChange: () => void }): void {
  toMediaUrl = opts.mediaUrl
  onCacheChange = opts.onCacheChange
  void listLibrary().catch(() => {}) // warm the cache at launch
}

/** cloud URL → cached copy, for the control window's previews to play locally too. */
export const localMap = (): Record<string, string> => Object.fromEntries(local)

/** Any cloud URL in `v` with a cached copy, swapped for that copy. */
export function localize<T>(v: T): T {
  if (!local.size) return v
  const walk = (x: unknown): unknown => {
    if (typeof x === 'string') return local.get(x) ?? x
    if (Array.isArray(x)) return x.map(walk)
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(x)) out[k] = walk(val)
      return out
    }
    return x
  }
  return walk(v) as T
}

function withLocal(b: LibraryBackground): LibraryBackground {
  const file = cacheFile(b.url)
  if (existsSync(file)) local.set(b.url, toMediaUrl(file))
  return { ...b, local: local.get(b.url) }
}

export async function listLibrary(): Promise<LibraryBackground[]> {
  const r = await fetch(`${relayBase()}/media/backgrounds`, { signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = (await r.json()) as { backgrounds?: LibraryBackground[] }
  const list = (j.backgrounds ?? []).map(withLocal)
  for (const b of list) known.add(b.url)
  void prefetch(list)
  return list
}

/** Bring one file into the cache; resolves once it is there (or has failed). */
async function fetchOne(url: string): Promise<void> {
  if (local.has(url) || downloading.has(url)) return
  downloading.add(url)
  try {
    await download(url, cacheFile(url))
    local.set(url, toMediaUrl(cacheFile(url)))
    onCacheChange()
  } catch {
    /* the cloud URL still plays; the next launch tries again */
  } finally {
    downloading.delete(url)
  }
}

/** Download, one at a time, whatever the cache doesn't hold yet. */
async function prefetch(list: LibraryBackground[]): Promise<void> {
  for (const b of list) await fetchOne(b.url)
}

/**
 * A library background just went on screen and isn't cached yet: fetch it
 * now, alongside the queue, rather than wherever it falls in the library's
 * order — a 4K library is a gigabyte, and the one on the projector shouldn't
 * wait behind all of it.
 */
export function prioritize(v: unknown): void {
  if (!known.size) return
  const walk = (x: unknown): void => {
    if (typeof x === 'string') {
      if (known.has(x)) void fetchOne(x)
    } else if (Array.isArray(x)) x.forEach(walk)
    else if (x && typeof x === 'object') Object.values(x).forEach(walk)
  }
  walk(v)
}

function get(url: string, redirects = 3): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? httpsRequest : httpRequest)(url, (res) => {
      const loc = res.headers.location
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc && redirects > 0) {
        res.resume()
        resolve(get(new URL(loc, url).toString(), redirects - 1))
      } else if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`))
      } else resolve(res)
    })
    req.on('error', reject)
    req.setTimeout(60_000, () => req.destroy(new Error('timed out')))
    req.end()
  })
}

async function download(url: string, dest: string): Promise<void> {
  const part = `${dest}.part`
  const res = await get(url)
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(part)
    res.pipe(out)
    out.on('finish', resolve)
    out.on('error', reject)
    res.on('error', reject)
  })
  await rename(part, dest)
}

/** PUT a file to a signed URL, reporting how far it has got. */
function putFile(url: string, file: string, size: number, type: string, onBytes: (n: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const send = url.startsWith('https:') ? httpsRequest : httpRequest
    const req = send(url, { method: 'PUT', headers: { 'Content-Type': type, 'Content-Length': size } }, (res) => {
      res.resume()
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve()
      else reject(new Error(`The media store refused the upload (HTTP ${res.statusCode}).`))
    })
    req.on('error', reject)
    let sent = 0
    const src = createReadStream(file)
    src.on('data', (chunk) => {
      sent += chunk.length
      onBytes(sent)
    })
    src.on('error', reject)
    src.pipe(req)
  })
}

/**
 * Pick videos and add them to the library: upload each to the media store,
 * register it, and keep the original as the cached copy (no download back).
 */
export async function importBackgrounds(
  win: BrowserWindow | null,
  progress: (p: BgImportProgress) => void
): Promise<BgImportResult> {
  const opts = {
    title: 'Import video backgrounds',
    properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
    filters: [{ name: 'Videos', extensions: Object.keys(VIDEO_TYPES) }]
  }
  const pick = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (pick.canceled || !pick.filePaths.length) return { added: [], errors: [], canceled: true }

  const added: LibraryBackground[] = []
  const errors: string[] = []
  for (const [i, file] of pick.filePaths.entries()) {
    const name = basename(file).replace(/\.[^.]+$/, '')
    const type = VIDEO_TYPES[extname(file).slice(1).toLowerCase()]
    try {
      const { size } = await stat(file)
      const u = await fetch(`${relayBase()}/media/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: basename(file), contentType: type, size })
      })
      const signed = (await u.json().catch(() => ({}))) as { uploadUrl?: string; publicUrl?: string; message?: string }
      if (!u.ok || !signed.uploadUrl || !signed.publicUrl) throw new Error(signed.message || `HTTP ${u.status}`)

      let last = 0
      await putFile(signed.uploadUrl, file, size, type, (sent) => {
        const now = Date.now()
        if (now - last < 200 && sent < size) return
        last = now
        progress({ name, index: i, count: pick.filePaths.length, sent, total: size })
      })

      const reg = await fetch(`${relayBase()}/media/backgrounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url: signed.publicUrl, kind: 'video', bytes: size })
      })
      const entry = (await reg.json().catch(() => ({}))) as LibraryBackground & { message?: string }
      if (!reg.ok) throw new Error(entry.message || `HTTP ${reg.status}`)

      // The file on this machine IS the cached copy.
      await copyFile(file, cacheFile(entry.url)).catch(() => {})
      added.push(withLocal(entry))
      onCacheChange()
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { added, errors }
}

export async function removeBackground(id: number, url: string): Promise<boolean> {
  const r = await fetch(`${relayBase()}/media/backgrounds/${id}`, { method: 'DELETE' })
  if (!r.ok) return false
  // Its cached copy goes too; a service still using it falls back to the cloud.
  local.delete(url)
  onCacheChange()
  await unlink(cacheFile(url)).catch(() => {})
  return true
}
