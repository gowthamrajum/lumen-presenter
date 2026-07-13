import type { Background, ServiceItem, ThemeStyle } from '@shared/types'

/**
 * Local cache of the working session (the Sessions setlist + its look) so an
 * in-progress service survives an app restart without an explicit Save. Entries
 * expire after two weeks — reopen within that window and you pick up where you
 * left off; leave it longer and you start fresh.
 */
const KEY = 'lumen.sessionCache'
const TTL_MS = 14 * 24 * 60 * 60 * 1000 // 2 weeks

export interface CachedSession {
  serviceId: string | null
  serviceName: string
  items: ServiceItem[]
  background: Background
  theme: ThemeStyle
}

interface Envelope {
  savedAt: number
  session: CachedSession
}

/** Return the cached session if present and not older than the TTL, else null
 *  (and drop an expired/corrupt entry). */
export function loadSessionCache(): CachedSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const env = JSON.parse(raw) as Envelope
    if (typeof env?.savedAt !== 'number' || Date.now() - env.savedAt > TTL_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return env.session ?? null
  } catch {
    return null
  }
}

/** Persist the working session, stamping "now" as the TTL start. Failures
 *  (quota, serialization) are swallowed — caching is best-effort. */
export function saveSessionCache(session: CachedSession): void {
  try {
    const env: Envelope = { savedAt: Date.now(), session }
    localStorage.setItem(KEY, JSON.stringify(env))
  } catch {
    /* ignore — never let caching break the app */
  }
}

export function clearSessionCache(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
