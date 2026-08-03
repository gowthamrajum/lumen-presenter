import { useEffect } from 'react'
import { useStore } from '../store/useStore'

/** How long a scripture slide holds before advancing to the next one. */
export const SLIDE_HOLD_MS = 60_000
/** How much each operator "Extend" click pushes the auto-advance back. */
export const VERSE_EXTEND_MS = 30_000

/**
 * Two things read themselves through, and they end differently.
 *
 * A Bible passage added as its own section (an item tagged `autoAdvance`) holds
 * each slide for SLIDE_HOLD_MS and moves to the NEXT slide of the service, so a
 * reading can be put up and left. Psalms / responsive readings are not tagged,
 * so they never advance on their own.
 *
 * A verse quoted DURING the sermon (a slide tagged `autoAdvance`) circles inside
 * the sermon instead: the next verse of the passage, and from the last one back
 * to the sermon card. It never leaves the section, because the preacher hasn't.
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

  // Arm only for a slide that has somewhere to go; cancel for anything else.
  useEffect(() => {
    const s = useStore.getState()
    const item = s.liveId ? s.items.find((it) => it.slides.some((sl) => sl.id === s.liveId)) : undefined
    const slide = item?.slides.find((sl) => sl.id === s.liveId)
    // A verse read during the sermon: it circles inside its own item, so it
    // always has somewhere to go — the sermon card, if nothing else.
    if (slide?.autoAdvance) {
      s.armAutoAdvance(SLIDE_HOLD_MS)
      return
    }
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
      const item = s.liveId ? s.items.find((it) => it.slides.some((sl) => sl.id === s.liveId)) : undefined
      const slide = item?.slides.find((sl) => sl.id === s.liveId)
      if (item && slide?.autoAdvance) {
        // Inside the sermon: the next verse of this passage, and from the last
        // one back to the top of the section — the sermon card — rather than
        // walking on into whatever comes after the sermon.
        const at = item.slides.findIndex((sl) => sl.id === slide.id)
        const next = item.slides[at + 1] ?? item.slides[0]
        if (next.id !== slide.id) s.goLive(next.id)
        return
      }
      s.goNext()
    }, delay)
    return () => clearTimeout(t)
  }, [autoAdvanceAt])
}
