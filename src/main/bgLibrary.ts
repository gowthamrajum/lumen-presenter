import { app } from 'electron'
import { createHash } from 'crypto'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { rename } from 'fs/promises'
import { request as httpsRequest } from 'https'
import { request as httpRequest, type IncomingMessage } from 'http'
import { extname, join } from 'path'
import { relayBase } from './serviceFeed'
import type { BgCacheProgress, LibraryBackground } from '../shared/types'

/**
 * The shared background library — video backgrounds offered in every
 * Cantica's background picker.
 *
 * Read-only here: an admin adds and removes backgrounds in Cantica Web's
 * Background Library (the relay enforces it with the admin PIN). Presenters
 * list the library and use it.
 *
 * The projector plays its own copy. Every library file is downloaded into a
 * local cache in the background, and the live state sent to the output windows
 * has those URLs swapped for the cached files (see `localize`) — so a looping
 * 1080p video never waits on the church's network. The relay, the phones and
 * the stream get the cloud URL, which is the only one they can reach.
 */

let toMediaUrl: (absPath: string) => string = (p) => p
let onCacheChange: () => void = () => {}
let onProgress: (p: BgCacheProgress) => void = () => {}

/**
 * The current round of downloading, for the progress bar a first launch needs:
 * a library is often a gigabyte, and a projector screen that won't play its
 * background yet, with nothing saying why, reads as broken. A round starts
 * when something needs fetching and ends when the last of it lands.
 */
const names = new Map<string, { name: string; bytes: number }>()
const round = new Map<string, { total: number; got: number; done: boolean }>()
let currentName: string | undefined
let lastSent = 0

export function cacheProgress(): BgCacheProgress {
  let bytes = 0
  let totalBytes = 0
  let done = 0
  for (const r of round.values()) {
    totalBytes += r.total
    bytes += r.done ? r.total : Math.min(r.got, r.total)
    if (r.done) done++
  }
  const active = round.size > 0 && done < round.size
  return { active, files: round.size, done, name: active ? currentName : undefined, bytes, totalBytes }
}

function report(force = false): void {
  const now = Date.now()
  if (!force && now - lastSent < 250) return
  lastSent = now
  const p = cacheProgress()
  onProgress(p)
  // The round is over: the next thing to fetch starts a new one from zero.
  if (!p.active && round.size) round.clear()
}
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

export function initBgLibrary(opts: {
  mediaUrl: (absPath: string) => string
  onCacheChange: () => void
  onProgress?: (p: BgCacheProgress) => void
}): void {
  toMediaUrl = opts.mediaUrl
  onCacheChange = opts.onCacheChange
  if (opts.onProgress) onProgress = opts.onProgress
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
  for (const b of list) {
    known.add(b.url)
    names.set(b.url, { name: b.name, bytes: b.bytes })
  }
  // Everything missing joins the round up front, so the bar's total is the
  // whole download from the start rather than growing as it goes.
  for (const b of list) if (!local.has(b.url) && !round.has(b.url)) round.set(b.url, { total: b.bytes || 1, got: 0, done: false })
  report(true)
  void prefetch(list)
  return list
}

/** Bring one file into the cache; resolves once it is there (or has failed). */
async function fetchOne(url: string): Promise<void> {
  if (local.has(url) || downloading.has(url)) return
  downloading.add(url)
  const meta = names.get(url)
  const r = round.get(url) ?? { total: meta?.bytes || 1, got: 0, done: false }
  round.set(url, r)
  currentName = meta?.name
  report(true)
  try {
    await download(url, cacheFile(url), (got, total) => {
      r.got = got
      if (total) r.total = total
      report()
    })
    local.set(url, toMediaUrl(cacheFile(url)))
    onCacheChange()
  } catch {
    /* the cloud URL still plays; the next launch tries again */
  } finally {
    downloading.delete(url)
    // Done either way: a failure must not leave the bar stuck short of full.
    r.done = true
    report(true)
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

async function download(url: string, dest: string, onBytes?: (got: number, total: number) => void): Promise<void> {
  const part = `${dest}.part`
  const res = await get(url)
  const total = Number(res.headers['content-length']) || 0
  let got = 0
  res.on('data', (chunk: Buffer) => {
    got += chunk.length
    onBytes?.(got, total)
  })
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(part)
    res.pipe(out)
    out.on('finish', resolve)
    out.on('error', reject)
    res.on('error', reject)
  })
  await rename(part, dest)
}
