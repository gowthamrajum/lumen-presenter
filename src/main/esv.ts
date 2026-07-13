// ESV text for Cantica. The ESV can't be bundled (Crossway caps local storage at
// 500 verses), so it's fetched ON DEMAND. Two routes, chosen automatically:
//   • if a LOCAL key is present (ESV_API_KEY env / .env / app-data esv.json), go
//     straight to Crossway's api.esv.org (useful for a single machine / dev);
//   • otherwise go through the BACKEND PROXY (grey-gratis-ice /esv/*), which holds
//     the key server-side — so no client needs a key and it never lives in the
//     public repo or build. The proxy is Crossway's intended model (fetch from
//     your own server).
// Either way the client shows the required ESV attribution, and cache stays under
// Crossway's 500-verse limit (session-only, cleared on restart).

import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { app } from 'electron'

let cachedKey: string | null = null
let keyLoaded = false

function keyFile(): string {
  return join(app.getPath('userData'), 'esv.json')
}

function backendBase(): string {
  return (
    process.env.LUMEN_BROADCAST_API ||
    process.env.LUMEN_SONGS_API ||
    'https://grey-gratis-ice.onrender.com'
  ).replace(/\/$/, '')
}

/**
 * Resolve a LOCAL ESV key, first found wins: the ESV_API_KEY env var (also from a
 * gitignored .env in dev) then the app-data file. Empty string means "no local
 * key — use the backend proxy". Never returned to the renderer.
 */
async function loadKey(): Promise<string> {
  const envKey = (process.env.ESV_API_KEY || '').trim()
  if (envKey) return envKey
  if (!keyLoaded) {
    keyLoaded = true
    try {
      const d = JSON.parse(await readFile(keyFile(), 'utf8'))
      cachedKey = typeof d?.key === 'string' ? d.key : null
    } catch {
      cachedKey = null
    }
  }
  return (cachedKey || '').trim()
}

/**
 * Is the ESV available? Either a local key (direct to Crossway) or the backend
 * proxy reporting the key is configured server-side. Never exposes the key.
 */
export async function esvKeyStatus(): Promise<{ hasKey: boolean }> {
  if (await loadKey()) return { hasKey: true }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${backendBase()}/esv/status`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })
    if (res.ok) {
      const d = (await res.json()) as { available?: boolean }
      return { hasKey: !!d.available }
    }
  } catch {
    /* backend unreachable → unavailable (Psalms falls back to WEBBE) */
  } finally {
    clearTimeout(timer)
  }
  return { hasKey: false }
}

/** Persist a local key to the app-data dir (also written by scripts/provision-esv). */
export async function esvSetKey(key: string): Promise<{ hasKey: boolean }> {
  cachedKey = (typeof key === 'string' ? key.trim() : '') || null
  keyLoaded = true
  try {
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(keyFile(), JSON.stringify({ key: cachedKey }), 'utf8')
  } catch {
    /* a persist failure shouldn't block using the key this session */
  }
  return { hasKey: !!(await loadKey()) }
}

// Session-only cache, capped under Crossway's 500-verse ceiling, cleared on restart.
const cache = new Map<string, EsvVerse[]>()
let cachedVerses = 0
const CACHE_CAP = 450

export interface EsvVerse {
  verse: number
  text: string
}
export interface EsvResult {
  verses: EsvVerse[]
  reference: string
}
export interface EsvError {
  error: string
  needKey?: boolean
}

const DIRECT_PARAMS: Record<string, string> = {
  'include-passage-references': 'false',
  'include-verse-numbers': 'true',
  'include-first-verse-numbers': 'true',
  'include-footnotes': 'false',
  'include-headings': 'false',
  'include-short-copyright': 'false',
  'include-passage-horizontal-lines': 'false',
  'include-heading-horizontal-lines': 'false',
  'indent-poetry': 'false'
}

/** Split ESV plain text ("[1] … [2] …") into verses. */
function parseVerses(passage: string): EsvVerse[] {
  const out: EsvVerse[] = []
  const markers = [...passage.matchAll(/\[(\d+)\]\s*/g)]
  for (let i = 0; i < markers.length; i++) {
    const num = Number(markers[i][1])
    const s = (markers[i].index ?? 0) + markers[i][0].length
    const e = i + 1 < markers.length ? markers[i + 1].index ?? passage.length : passage.length
    const text = passage.slice(s, e).replace(/\s+/g, ' ').trim()
    if (text) out.push({ verse: num, text })
  }
  return out
}

/** Fetch the raw {passages} JSON from Crossway or the backend proxy. */
async function fetchPassages(
  url: string,
  headers: Record<string, string>
): Promise<{ passages: string[]; canonical?: string } | EsvError> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers })
    // 401/403 = key rejected (direct); 503 = proxy not configured — both "needKey".
    if (res.status === 401 || res.status === 403 || res.status === 503) {
      return { error: 'ESV key rejected or not configured on the server.', needKey: true }
    }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const data = (await res.json()) as { passages?: string[]; canonical?: string }
    return { passages: Array.isArray(data.passages) ? data.passages : [], canonical: data.canonical }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch an ESV passage (e.g. "Psalm 23" or "Psalm 23:1-3") — direct if a local
 *  key is set, otherwise via the backend proxy. */
export async function esvPassage(query: string): Promise<EsvResult | EsvError> {
  const hit = cache.get(query)
  if (hit) return { verses: hit, reference: query }

  const key = await loadKey()
  const fetched = key
    ? await fetchPassages(
        `https://api.esv.org/v3/passage/text/?${new URLSearchParams({ q: query, ...DIRECT_PARAMS }).toString()}`,
        { Authorization: `Token ${key}`, Accept: 'application/json' }
      )
    : await fetchPassages(`${backendBase()}/esv/passage?q=${encodeURIComponent(query)}`, {
        Accept: 'application/json'
      })

  if ('error' in fetched) return fetched
  const verses = parseVerses(fetched.passages[0] ?? '')
  if (!verses.length) return { error: 'No ESV text for that passage.' }

  if (cachedVerses + verses.length > CACHE_CAP) {
    cache.clear()
    cachedVerses = 0
  }
  cache.set(query, verses)
  cachedVerses += verses.length
  return { verses, reference: fetched.canonical || query }
}
