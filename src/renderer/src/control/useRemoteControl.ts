import { useEffect } from 'react'
import { useStore } from '../store/useStore'

/**
 * Apply commands sent from a phone remote (relayed via the main process) to the
 * live deck. The phone and the desktop operator both drive the same deck — a
 * remote "next" is identical to pressing Next here, and a remote "end" is
 * identical to switching Broadcast off.
 */
export function useRemoteControl(): void {
  useEffect(() => {
    return window.lumen.onRemoteCommand(({ cmd, arg }) => {
      const s = useStore.getState()
      switch (cmd) {
        case 'next':
          s.goNext()
          break
        case 'prev':
          s.goPrev()
          break
        case 'blackout':
          s.toggleBlackout()
          break
        case 'clear':
          s.toggleClear()
          break
        case 'logo':
          s.toggleLogo()
          break
        case 'end':
          // The operator is calling the service: take the broadcast off air.
          // Turning it off publishes a final blacked-out frame and drops the
          // control listener, which is what tells the phone it really stopped.
          void window.lumen.setBroadcast({ enabled: false })
          break
        case 'verse': {
          // A verse quoted mid-sermon, sent from the phone. The remote resolved
          // the reference against its own bibles and sent the finished lines, so
          // there is nothing to look up here — it is appended to whatever is
          // live, which is the same thing Add verse does on this machine, and
          // goes straight up.
          //
          // No timer, deliberately: the desktop's own verse can time out back to
          // the sermon card, but a verse the operator put up stays until they
          // move on. They are standing at the back watching the preacher, and a
          // countdown would take it down mid-sentence.
          const p = arg as
            | { label?: string; lines?: unknown; slides?: { label?: string; lines?: unknown }[] }
            | null
          // ONE SLIDE PER VERSE, exactly as Add verse builds them here — a whole
          // passage on a single slide is unreadable from the back of the room.
          // The flat `lines` is the fallback for a remote too old to send the
          // split, which shows the words rather than nothing.
          const parts = Array.isArray(p?.slides) && p.slides.length ? p.slides : [{ label: p?.label, lines: p?.lines }]
          const built = parts
            .map((sl) => ({
              label: String(sl?.label ?? ''),
              lines: Array.isArray(sl?.lines) ? (sl.lines as unknown[]).map(String).filter(Boolean) : []
            }))
            .filter((sl) => sl.lines.length)
            .map((sl) => ({
              id: Math.random().toString(36).slice(2, 10),
              kind: 'scripture' as const,
              label: sl.label,
              lines: sl.lines,
              caption: sl.label
            }))
          if (!built.length) break
          const live = s.items.find((it) => it.slides.some((sl) => sl.id === s.liveId))
          if (!live) break
          // goLive takes the FIRST of them: a passage is read from its opening
          // verse and Next walks the rest.
          s.appendSlides(live.id, built, true)
          break
        }
        case 'goto': {
          // arg is an index into the service outline (order) the remote sees.
          const i = typeof arg === 'number' ? arg : -1
          const first = i >= 0 ? s.items[i]?.slides[0]?.id : undefined
          if (first) s.goLive(first)
          break
        }
        default:
          break
      }
    })
  }, [])
}
