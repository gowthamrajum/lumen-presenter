import { useEffect } from 'react'
import { useStore } from '../store/useStore'

/** How long a Bible verse stays live before auto-advancing to the Sermon slide. */
export const VERSE_TTL_MS = 50_000
/** How much each operator "Extend" click pushes the auto-advance back. */
export const VERSE_EXTEND_MS = 30_000

/**
 * When a Bible passage (an item tagged `autoAdvance`) goes live, keep it up for
 * VERSE_TTL_MS and then jump to the service's Sermon slide — so the reading holds
 * for ~50s and hands off to the message without the operator clicking. Psalms /
 * responsive readings are NOT tagged, so they never auto-advance. The operator can
 * Extend or Hold the countdown from the Live panel.
 *
 * Two effects: one arms/cancels when the live slide changes; the other schedules
 * (and reschedules, after an Extend) the actual jump off the store's target time.
 */
export function useVerseAutoAdvance(): void {
  const liveId = useStore((s) => s.liveId)
  const autoAdvanceAt = useStore((s) => s.autoAdvanceAt)

  // Arm only for Bible passages; cancel for anything else (or nothing live).
  useEffect(() => {
    const s = useStore.getState()
    const item = s.liveId ? s.items.find((it) => it.slides.some((sl) => sl.id === s.liveId)) : undefined
    const isBibleVerse = !!item && item.kind === 'scripture' && item.autoAdvance === true
    // Only arm when there's actually a Sermon slide to advance to, so the operator
    // never sees a countdown that leads nowhere.
    const hasSermon = s.items.some((it) => /sermon|వాక్యోపదేశం/i.test(it.title))
    if (isBibleVerse && hasSermon) s.armAutoAdvance(VERSE_TTL_MS)
    else s.cancelAutoAdvance()
  }, [liveId])

  // Fire at the target time (reschedules whenever Extend moves it).
  useEffect(() => {
    if (autoAdvanceAt == null) return
    const delay = Math.max(0, autoAdvanceAt - Date.now())
    const t = setTimeout(() => {
      const s = useStore.getState()
      s.cancelAutoAdvance()
      s.goToSermon()
    }, delay)
    return () => clearTimeout(t)
  }, [autoAdvanceAt])
}
