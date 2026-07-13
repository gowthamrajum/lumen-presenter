import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { app } from 'electron'
import type { BroadcastConfig, BroadcastStatus, LiveState } from '../shared/types'

/**
 * Web broadcast publisher. Pushes the canonical LiveState to a small open relay
 * (two in-memory endpoints living inside the existing songs backend) so a web
 * page / OBS browser source can render a live lyrics-scripture lower-third.
 *
 * Deliberately zero-config: press Broadcast and it just writes to the page.
 * There are no tokens in the app. Each install gets an auto-generated room slug
 * so two setups sharing one relay don't collide. (A cautious operator can still
 * set LUMEN_BROADCAST_ADMIN_TOKEN in the environment to match a server that
 * enforces one — but nothing in the UI requires it.)
 */

const ENV_ADMIN_TOKEN = process.env.LUMEN_BROADCAST_ADMIN_TOKEN || ''

function slug(): string {
  return `ch-${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_CONFIG: BroadcastConfig = {
  enabled: false,
  base: process.env.LUMEN_BROADCAST_API || process.env.LUMEN_SONGS_API || 'https://grey-gratis-ice.onrender.com',
  room: process.env.LUMEN_BROADCAST_ROOM || ''
}

let config: BroadcastConfig = { ...DEFAULT_CONFIG }
let status: BroadcastStatus = { enabled: false, ok: false, lastAt: null, lastError: null, rev: 0 }
let latest: LiveState | null = null
let sendStatus: (s: BroadcastStatus) => void = () => {}

// debounce so a burst of state changes (theme + slide + next) is one POST
let timer: ReturnType<typeof setTimeout> | null = null
let inflight = false
let pending = false

function configFile(): string {
  return join(app.getPath('userData'), 'broadcast.json')
}

async function persist(): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true }).catch(() => {})
  await writeFile(configFile(), JSON.stringify(config), 'utf8').catch(() => {})
}

function emit(): void {
  status = { ...status, enabled: config.enabled }
  sendStatus(status)
}

export async function initBroadcast(onStatus: (s: BroadcastStatus) => void): Promise<void> {
  sendStatus = onStatus
  try {
    const saved = JSON.parse(await readFile(configFile(), 'utf8'))
    config = { ...DEFAULT_CONFIG, ...saved }
  } catch {
    if (process.env.LUMEN_BROADCAST === '1') config.enabled = true
  }
  // Give every install a stable, collision-free room without asking the user.
  if (!config.room) {
    config.room = slug()
    await persist()
  }
  emit()
}

export function getBroadcastConfig(): BroadcastConfig {
  return config
}

export function getBroadcastStatus(): BroadcastStatus {
  return status
}

export async function setBroadcastConfig(patch: Partial<BroadcastConfig>): Promise<BroadcastConfig> {
  config = { ...config, ...patch }
  if (!config.room) config.room = slug()
  await persist()
  emit()
  if (config.enabled && latest) publishBroadcast(latest)
  else if (!config.enabled) {
    status = { ...status, ok: false }
    emit()
  }
  return config
}

/** Queue the current live state for publishing (debounced). */
export function publishBroadcast(state: LiveState): void {
  latest = state
  if (!config.enabled || !config.base) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void flush(), 150)
}

async function flush(): Promise<void> {
  if (inflight) {
    pending = true
    return
  }
  if (!config.enabled || !config.base || !latest) return
  inflight = true
  const url = `${config.base.replace(/\/$/, '')}/broadcast/${encodeURIComponent(config.room || 'live')}`
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 10_000)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ENV_ADMIN_TOKEN) headers.Authorization = `Bearer ${ENV_ADMIN_TOKEN}`
  // Items marked no-broadcast still show locally, but the web relay must never
  // carry their lyrics — not as the live slide, and not as the `next` preview of
  // the following item. Strip the internal flags from what we publish.
  const { noBroadcast, nextNoBroadcast, ...rest } = latest
  const payload = {
    ...rest,
    slide: noBroadcast ? null : latest.slide,
    next: noBroadcast || nextNoBroadcast ? null : latest.next
  }
  try {
    const res = await fetch(url, { method: 'POST', signal: controller.signal, headers, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json().catch(() => ({}))) as { rev?: number }
    status = { ...status, ok: true, lastAt: Date.now(), lastError: null, rev: data.rev ?? status.rev }
  } catch (err) {
    status = { ...status, ok: false, lastError: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(t)
    inflight = false
    emit()
    if (pending) {
      pending = false
      void flush()
    }
  }
}
