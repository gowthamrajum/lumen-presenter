import { useEffect } from 'react'
import { useStore } from '../store/useStore'

/**
 * Apply commands sent from a phone remote (relayed via the main process) to the
 * live deck. The phone and the desktop operator both drive the same deck — a
 * remote "next" is identical to pressing Next here.
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
