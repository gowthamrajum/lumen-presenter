import { useCallback, useEffect, useRef } from 'react'
import type { MediaCommand } from '@shared/types'

/**
 * The audience screen's end of the operator's transport.
 *
 * The clip plays here and the play/pause/seek buttons are in the other window,
 * so this takes commands from there and reports back where the clip has got to.
 * Only the audience output does either: a stage monitor showing the same file
 * would answer with its own position and fight the seek bar for the readout.
 */
export function useMediaTransport(enabled: boolean): (el: HTMLMediaElement | null) => void {
  const elRef = useRef<HTMLMediaElement | null>(null)

  const attach = useCallback((el: HTMLMediaElement | null) => {
    elRef.current = el
  }, [])

  useEffect(() => {
    if (!enabled) return
    const off = window.lumen.onMediaControl((c: MediaCommand) => {
      const el = elRef.current
      if (!el) return
      if (c.cmd === 'play') void el.play().catch(() => {})
      else if (c.cmd === 'pause') el.pause()
      else if (c.cmd === 'seek' && typeof c.value === 'number') {
        el.currentTime = Math.max(0, Math.min(c.value, Number.isFinite(el.duration) ? el.duration : c.value))
      }
    })
    // Polled rather than driven off `timeupdate`: that fires ~4×/second while
    // playing and NEVER while paused, so a seek on a paused clip would leave the
    // bar reading the old position. A steady tick reports both the same way.
    const id = setInterval(() => {
      const el = elRef.current
      if (!el) return
      window.lumen.mediaState({
        t: el.currentTime,
        duration: Number.isFinite(el.duration) ? el.duration : 0,
        paused: el.paused
      })
    }, 250)
    return () => {
      off()
      clearInterval(id)
    }
  }, [enabled])

  return attach
}
