// Persistent 24h cache for the online catalogs (songs, psalms). The renderer
// asks for these through IPC; here we serve them from a small on-disk cache and
// only re-hit the backend when the cache is older than the TTL (default 24h) —
// so a search no longer fetches every time. On a network failure we fall back to
// whatever is cached, even if stale, so the app keeps working offline.

import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { app } from 'electron'

export const DAY_MS = 24 * 60 * 60 * 1000

function cacheDir(): string {
  return join(app.getPath('userData'), 'http-cache')
}
function cacheFile(key: string): string {
  return join(cacheDir(), `${key.replace(/[^a-z0-9_-]/gi, '_')}.json`)
}

interface Envelope<T> {
  fetchedAt: number
  url: string
  data: T
}

async function readEnvelope<T>(key: string): Promise<Envelope<T> | null> {
  try {
    return JSON.parse(await readFile(cacheFile(key), 'utf8'))
  } catch {
    return null
  }
}

async function writeEnvelope<T>(key: string, url: string, data: T): Promise<void> {
  try {
    await mkdir(cacheDir(), { recursive: true })
    await writeFile(cacheFile(key), JSON.stringify({ fetchedAt: Date.now(), url, data }), 'utf8')
  } catch {
    /* a cache write failure must never break the actual request */
  }
}

export interface CachedFetchOptions<T> {
  /** max cache age before a re-fetch (default 24h) */
  ttlMs?: number
  /** abort the network request after this long (Render free tier cold-starts) */
  timeoutMs?: number
  /** guard so a malformed response is never cached / returned as success */
  validate?: (d: unknown) => d is T
  /** ignore a fresh cache and re-fetch (used by a manual "refresh") */
  force?: boolean
}

/**
 * Fetch JSON through the on-disk cache. Returns cached data while it's younger
 * than ttlMs; otherwise fetches, caches, and returns. Network failure falls back
 * to any cached copy (stale included). Returns `{ error }` only when there is
 * neither a usable response nor any cache.
 */
export async function cachedFetchJson<T = unknown>(
  key: string,
  url: string,
  opts: CachedFetchOptions<T> = {}
): Promise<T | { error: string }> {
  const { ttlMs = DAY_MS, timeoutMs = 70_000, validate, force = false } = opts

  const cached = await readEnvelope<T>(key)
  if (!force && cached && Date.now() - cached.fetchedAt < ttlMs) return cached.data

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (validate && !validate(data)) {
      if (cached) return cached.data // keep serving the last good copy
      return { error: 'Unexpected response from server' }
    }
    await writeEnvelope(key, url, data)
    return data as T
  } catch (err) {
    if (cached) return cached.data // stale beats nothing (offline / cold-start)
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}
