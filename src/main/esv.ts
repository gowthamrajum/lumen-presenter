// ESV API client (Crossway). Fetches ESV passage text ON DEMAND — the ESV may
// not be bundled/stored as a full Bible, but their API allows free non-commercial
// (church/ministry) use with attribution. We honour the terms:
//   • never store more than ~500 verses — the cache is in-memory, session-only,
//     capped, and cleared on restart;
//   • the caller must show the ESV copyright notice + an esv.org link wherever
//     the text appears (the Psalms source does this).
// Needs a free API key from https://api.esv.org (register the church/ministry).

import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { app } from 'electron'

let cachedKey: string | null = null
let keyLoaded = false

function keyFile(): string {
  return join(app.getPath('userData'), 'esv.json')
}

/**
 * Resolve the ESV key at runtime, first found wins: the ESV_API_KEY env var
 * (also populated from a gitignored .env in dev) takes priority, then the key
 * saved in the app data dir. Never returned to the renderer.
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

export async function esvKeyStatus(): Promise<{ hasKey: boolean }> {
  return { hasKey: !!(await loadKey()) }
}

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

// Session-only cache, capped well under Crossway's 500-verse ceiling and cleared
// on restart. When adding a passage would exceed the cap, the whole cache is
// dropped first (simple + always compliant).
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

/** Fetch an ESV passage (e.g. "Psalm 23" or "Psalm 23:1-3"). */
export async function esvPassage(query: string): Promise<EsvResult | EsvError> {
  const key = await loadKey()
  if (!key) return { error: 'No ESV API key set.', needKey: true }

  const hit = cache.get(query)
  if (hit) return { verses: hit, reference: query }

  const params = new URLSearchParams({
    q: query,
    'include-passage-references': 'false',
    'include-verse-numbers': 'true',
    'include-first-verse-numbers': 'true',
    'include-footnotes': 'false',
    'include-headings': 'false',
    'include-short-copyright': 'false',
    'include-passage-horizontal-lines': 'false',
    'include-heading-horizontal-lines': 'false',
    'indent-poetry': 'false'
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(`https://api.esv.org/v3/passage/text/?${params.toString()}`, {
      signal: controller.signal,
      headers: { Authorization: `Token ${key}`, Accept: 'application/json' }
    })
    if (res.status === 401 || res.status === 403) return { error: 'ESV API key was rejected.', needKey: true }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { passages?: string[]; canonical?: string }
    const verses = parseVerses(data.passages?.[0] ?? '')
    if (!verses.length) return { error: 'No ESV text for that passage.' }

    if (cachedVerses + verses.length > CACHE_CAP) {
      cache.clear()
      cachedVerses = 0
    }
    cache.set(query, verses)
    cachedVerses += verses.length
    return { verses, reference: data.canonical || query }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}
