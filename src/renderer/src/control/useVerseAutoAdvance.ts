import { useEffect } from 'react'
import { useStore } from '../store/useStore'

/** How long a scripture slide holds before advancing to the next one. */
export const SLIDE_HOLD_MS = 60_000
/** How much each operator "Extend" click pushes the auto-advance back. */
export const VERSE_EXTEND_MS = 30_000

/**
 * A Bible passage reads itself through: each slide of an item tagged
 * `autoAdvance` holds for SLIDE_HOLD_MS and then moves to the NEXT slide, so a
 * reading can be put up and left. Psalms / responsive readings are not tagged,
 * so they never advance on their own.
 *
 * The clock only runs on the slide that is actually live — it's armed when a
 * slide goes live and thrown away when it stops being live, so a passage sitting
 * further down the schedule never quietly spends its minute, and stepping away
 * and back starts the minute over. The operator can Extend or Hold from the Live
 * panel.
 *
 * Two effects: one arms/cancels when the live slide changes; the other schedules
 * (and reschedules, after an Extend) the actual advance off the store's target.
 */
export function useVerseAutoAdvance(): void {
  const liveId = useStore((s) => s.liveId)
  const autoAdvanceAt = useStore((s) => s.autoAdvanceAt)

  // Arm only for the live slide of a passage; cancel for anything else.
  useEffect(() => {
    const s = useStore.getState()
    const item = s.liveId ? s.items.find((it) => it.slides.some((sl) => sl.id === s.liveId)) : undefined
    const isPassage = !!item && item.kind === 'scripture' && item.autoAdvance === true
    // Nothing to advance to on the last slide of the service — don't run a
    // countdown that leads nowhere.
    const deck = s.items.flatMap((it) => it.slides)
    const i = deck.findIndex((d) => d.id === s.liveId)
    const hasNext = i >= 0 && i < deck.length - 1
    if (isPassage && hasNext) s.armAutoAdvance(SLIDE_HOLD_MS)
    else s.cancelAutoAdvance()
  }, [liveId])

  // Fire at the target time (reschedules whenever Extend moves it).
  useEffect(() => {
    if (autoAdvanceAt == null) return
    const delay = Math.max(0, autoAdvanceAt - Date.now())
    const t = setTimeout(() => {
      const s = useStore.getState()
      s.cancelAutoAdvance()
      s.goNext()
    }, delay)
    return () => clearTimeout(t)
  }, [autoAdvanceAt])
}
