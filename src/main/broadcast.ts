import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { app } from 'electron'
import {
  DEFAULT_BACKGROUND,
  DEFAULT_THEME,
  type BroadcastConfig,
  type BroadcastStatus,
  type LiveState
} from '../shared/types'

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

// A friendly 4-digit remote-control PIN. The room slug is the real secret; this
// is an easy-to-type second factor a volunteer enters on their phone.
function pin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
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
  // …and a stable phone-remote control PIN.
  if (!config.controlPin) {
    config.controlPin = pin()
    await persist()
  }
  emit()
  syncControl()
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
  // A blank PIN means "regenerate" (the renderer's Regenerate button sends '').
  if (!config.controlPin) config.controlPin = pin()
  await persist()
  emit()
  syncControl()
  if (config.enabled && latest) publishBroadcast(latest)
  else if (!config.enabled) {
    // Stopping: cancel any queued frame and push one final blank so viewers
    // don't stay frozen on the last slide.
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    status = { ...status, ok: false }
    emit()
    void publishOff()
  }
  return config
}

/** Push a final blacked-out frame to the relay so both the audience and OBS
 *  views clear when the operator stops broadcasting (blackout hides both). */
async function publishOff(): Promise<void> {
  if (!config.base) return
  const url = `${config.base.replace(/\/$/, '')}/broadcast/${encodeURIComponent(config.room || 'live')}`
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 10_000)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ENV_ADMIN_TOKEN) headers.Authorization = `Bearer ${ENV_ADMIN_TOKEN}`
  const payload = {
    background: latest?.background ?? DEFAULT_BACKGROUND,
    blackout: true,
    clearText: false,
    showLogo: false,
    theme: latest?.theme ?? DEFAULT_THEME,
    users: { slide: null, next: null },
    stream: { slide: null, next: null }
  }
  try {
    await fetch(url, { method: 'POST', signal: controller.signal, headers, body: JSON.stringify(payload) })
  } catch {
    /* best-effort — the app is stopping the broadcast anyway */
  } finally {
    clearTimeout(t)
  }
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
  // Items can be suppressed per channel: the User (audience mirror) and the
  // Stream (OBS) views each get their own slice, so an item that's off-air for
  // one channel never carries its lyrics to that channel's page. Shared, non-
  // lyric fields (background/theme/flags) live at the top level. The relay
  // projects the right slice per viewer (?view=users|stream).
  const {
    slide,
    next,
    noBroadcastUsers,
    noBroadcastStream,
    nextNoBroadcastUsers,
    nextNoBroadcastStream,
    ...rest
  } = latest
  const payload = {
    ...rest,
    users: {
      slide: noBroadcastUsers ? null : slide ?? null,
      next: nextNoBroadcastUsers ? null : next ?? null
    },
    stream: {
      slide: noBroadcastStream ? null : slide ?? null,
      next: nextNoBroadcastStream ? null : next ?? null
    }
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

// ---- phone-remote control listener ----
// A phone "remote" drives the SAME live deck the desktop owns. We subscribe to
// this room's control stream FROM THE MAIN PROCESS (Node fetch sends no browser
// Origin, so it never trips the relay's CORS allow-list the way a renderer would)
// and forward each command to the control window, which runs it against the deck
// and republishes. Runs only while broadcasting; reconnects with backoff.
let onCommand: (cmd: string, arg: unknown) => void = () => {}
let controlOn = false
let controlUrlActive = ''
let controlAbort: AbortController | null = null

export function initControlListener(cb: (cmd: string, arg: unknown) => void): void {
  onCommand = cb
  syncControl()
}

function controlStreamUrl(): string {
  const base = config.base.replace(/\/$/, '')
  const room = encodeURIComponent(config.room || 'live')
  const p = encodeURIComponent(config.controlPin || '')
  return `${base}/broadcast/${room}/control/stream?pin=${p}`
}

/** Start/stop/restart the listener to match the current broadcast config. */
function syncControl(): void {
  const want = !!(config.enabled && config.base && config.room && config.controlPin)
  const url = want ? controlStreamUrl() : ''
  if (want && controlOn && url === controlUrlActive) return // already listening here
  stopControl()
  if (want) {
    controlOn = true
    controlUrlActive = url
    void controlLoop()
  }
}

function stopControl(): void {
  controlOn = false
  controlUrlActive = ''
  try {
    controlAbort?.abort()
  } catch {
    /* ignore */
  }
  controlAbort = null
}

async function controlLoop(): Promise<void> {
  let backoff = 1000
  while (controlOn) {
    try {
      controlAbort = new AbortController()
      const res = await fetch(controlUrlActive, {
        signal: controlAbort.signal,
        headers: { Accept: 'text/event-stream' }
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      backoff = 1000
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (controlOn) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i: number
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i)
          buf = buf.slice(i + 2)
          let ev = 'message'
          let data = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) ev = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (ev === 'command' && data) {
            try {
              const msg = JSON.parse(data)
              if (msg && typeof msg.cmd === 'string') onCommand(msg.cmd, msg.arg)
            } catch {
              /* ignore a malformed frame */
            }
          }
        }
      }
    } catch {
      /* network dropped or aborted — fall through to backoff + reconnect */
    }
    if (!controlOn) break
    await new Promise((r) => setTimeout(r, backoff))
    backoff = Math.min(backoff * 2, 15000)
  }
}
