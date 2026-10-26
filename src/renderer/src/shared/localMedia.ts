import { useSyncExternalStore } from 'react'

/**
 * This computer's cached copies of shared-library backgrounds, by cloud URL.
 *
 * The output windows are sent the live state with cloud URLs already swapped
 * for cached files (main/bgLibrary's localize). The control window renders from
 * its own store, so its previews would otherwise stream every library video
 * from the internet — one per slide thumbnail — and a deck of forty slides was
 * forty 1080p downloads decoding at once, which stalled the machine and with it
 * the projector. This is the same map, kept in step with the cache.
 */
let map: Record<string, string> = {}
const subs = new Set<() => void>()
let started = false

function start(): void {
  if (started || typeof window === 'undefined' || !window.lumen?.bgLocalMap) return
  started = true
  const set = (m: Record<string, string>): void => {
    map = m
    subs.forEach((f) => f())
  }
  void window.lumen.bgLocalMap().then(set).catch(() => {})
  window.lumen.onBgLocalChanged(set)
}

const subscribe = (f: () => void): (() => void) => {
  start()
  subs.add(f)
  return () => subs.delete(f)
}

/** The cached copy of `url` when there is one, else `url` itself. */
export function useLocalMedia(url: string): string {
  const m = useSyncExternalStore(subscribe, () => map)
  return m[url] ?? url
}
