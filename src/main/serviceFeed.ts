import { IPC } from '../shared/ipc'
import type { BrowserWindow } from 'electron'

/**
 * The relay's change feed for services, held open from the main process.
 *
 * Polling is only ever as fresh as its interval, and Sunday's set gets edited
 * minutes before it is needed — by someone standing in the building, watching
 * the projection machine, waiting for it to catch up. This is the push side:
 * the relay announces every create, edit, delete and purge, and the control
 * window syncs on the announcement rather than on a timer.
 *
 * The events carry nothing but "something changed". The renderer already knows
 * how to fetch what it needs, and a payload here would be a second copy of that
 * logic to keep in step with the first.
 *
 * The connection is the fragile part — a laptop sleeps, a phone hotspot drops,
 * Render idles the instance — so it reconnects with a backoff, and the poll it
 * replaces stays on as a slow safety net rather than being deleted.
 */
let abort: AbortController | null = null
let retry: NodeJS.Timeout | null = null
let attempt = 0

function relayBase(): string {
  return (
    process.env.LUMEN_BROADCAST_API ||
    process.env.LUMEN_SONGS_API ||
    'https://grey-gratis-ice.onrender.com'
  )
}

export function stopServiceFeed(): void {
  abort?.abort()
  abort = null
  if (retry) clearTimeout(retry)
  retry = null
}

export function startServiceFeed(control: () => BrowserWindow | null): void {
  stopServiceFeed()
  const connect = async (): Promise<void> => {
    const ctrl = new AbortController()
    abort = ctrl
    try {
      const res = await fetch(`${relayBase()}/services/stream`, {
        headers: { Accept: 'text/event-stream' },
        signal: ctrl.signal
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      attempt = 0
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        // Frames are separated by a blank line; a heartbeat is a bare comment.
        let cut = buf.indexOf('\n\n')
        while (cut !== -1) {
          const frame = buf.slice(0, cut)
          buf = buf.slice(cut + 2)
          if (/^event:\s*services/m.test(frame)) {
            const win = control()
            if (win && !win.isDestroyed()) win.webContents.send(IPC.servicesChanged)
          }
          cut = buf.indexOf('\n\n')
        }
      }
      throw new Error('stream ended')
    } catch (err) {
      if (ctrl.signal.aborted) return
      void err
      // 1s, 2s, 4s … capped: a relay that is asleep should not be hammered,
      // and one that is merely restarting should be back within a few seconds.
      const wait = Math.min(30_000, 1000 * 2 ** Math.min(attempt++, 5))
      retry = setTimeout(() => void connect(), wait)
    }
  }
  void connect()
}
