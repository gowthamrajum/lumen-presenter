import type { SlideContent } from '@shared/types'
import { uid } from '../store/useStore'

/**
 * The sermon outline — the preacher's points on one slide.
 *
 * It lives INSIDE the sermon item, straight after the card, for the same reason
 * a quoted verse does: it is part of the sermon, not a section of the service.
 * One per sermon. The points are the slide's lines, so it auto-fits like any
 * text slide, and the sermon's title rides as the caption.
 *
 * The same shape is written by cantica-web's Service Builder (lib/outline.ts) —
 * keep the two in step, or an outline added on a phone reads differently here.
 */
export interface Outline {
  title: string
  points: string[]
}

/** The label an untitled outline shows in the slide grid. */
const OUTLINE_LABEL = 'Sermon outline'

export const isOutline = (sl: SlideContent): boolean => sl.outline === true

/** Where the outline sits in an item's slides, or -1. */
export const outlineIndex = (slides: SlideContent[]): number => slides.findIndex(isOutline)

/** The outline an item carries, read back for editing. */
export function readOutline(slides: SlideContent[]): Outline | null {
  const sl = slides.find(isOutline)
  return sl ? { title: sl.caption ?? '', points: sl.lines } : null
}

/** Points typed one per line, blank lines dropped. */
export const pointsOf = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export function outlineSlide(o: Outline, id: string = uid()): SlideContent {
  const title = o.title.trim()
  return {
    id,
    kind: 'text',
    label: title || OUTLINE_LABEL,
    lines: o.points,
    ...(title ? { caption: title } : {}),
    outline: true,
    // The phones can follow along; the stream is left to whatever the sermon
    // says, since a block of points over the camera hides the preacher.
    broadcastUsers: true
  }
}

/**
 * The item's slides with this outline in them — replacing the one already
 * there (keeping its id, so a live outline stays live), or going in straight
 * after the card. `null`, or an outline with no points, takes it out.
 */
export function withOutline(slides: SlideContent[], o: Outline | null): SlideContent[] {
  const at = outlineIndex(slides)
  if (!o || !o.points.length) return at < 0 ? slides : slides.filter((_, i) => i !== at)
  if (at >= 0) {
    const out = slides.slice()
    out[at] = outlineSlide(o, slides[at].id)
    return out
  }
  const out = slides.slice()
  out.splice(Math.min(1, out.length), 0, outlineSlide(o))
  return out
}
