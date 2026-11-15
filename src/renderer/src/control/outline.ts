import type { SlideContent } from '@shared/types'
import { uid } from '../store/useStore'

/**
 * The sermon outline — the preacher's points, on one slide or a few.
 *
 * It lives INSIDE the sermon item, straight after the card, for the same reason
 * a quoted verse does: it is part of the sermon, not a section of the service.
 * A long outline is split into slides, one per section of the sermon, because a
 * dozen points on one slide can't be read from the back. The slides sit
 * together; each one's points are its lines, so it auto-fits like any text
 * slide, and the sermon's title rides on every one as the caption.
 *
 * The same shape is written by cantica-web (lib/outline.ts) and by the relay
 * (grey-gratis-ice readOutline/withSermon) — keep the three in step, or an
 * outline written on a phone reads differently here.
 */
export interface Outline {
  title: string
  /** every point, flattened across the slides */
  points: string[]
  /** the points split into slides; absent when the outline is one slide */
  sections?: string[][]
}

/** The label an untitled outline shows in the slide grid. */
const OUTLINE_LABEL = 'Sermon outline'

export const isOutline = (sl: SlideContent): boolean => sl.outline === true

/** Where the outline starts in an item's slides, or -1. */
export const outlineIndex = (slides: SlideContent[]): number => slides.findIndex(isOutline)

/**
 * The outline slide to come back to, or -1: the one last on screen when it is
 * in these slides, otherwise the first. A split outline is several slides, and
 * the preacher is on one particular section of it.
 */
export function returnToOutline(slides: SlideContent[], lastOutlineId: string | null): number {
  const seen = lastOutlineId ? slides.findIndex((sl) => sl.id === lastOutlineId && isOutline(sl)) : -1
  return seen >= 0 ? seen : outlineIndex(slides)
}

/** Points typed one per line, blank lines dropped. */
export const pointsOf = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** An outline from a title and its slides; empty slides are dropped, and none
 *  left means no outline at all. */
export function makeOutline(title: string, sections: string[][]): Outline | null {
  const kept = sections.map((s) => s.map((p) => p.trim()).filter(Boolean)).filter((s) => s.length)
  if (!kept.length) return null
  return { title: title.trim(), points: kept.flat(), ...(kept.length > 1 ? { sections: kept } : {}) }
}

/** The outline's slides — one, unless it was split. */
export const sectionsOf = (o: Outline): string[][] => (o.sections?.length ? o.sections : [o.points])

/** The outline an item carries — every outline slide, in order — for editing. */
export function readOutline(slides: SlideContent[]): Outline | null {
  const mine = slides.filter(isOutline)
  if (!mine.length) return null
  return makeOutline(mine[0].caption ?? '', mine.map((sl) => sl.lines))
}

/** One slide per section, each carrying the title. `ids` are reused by
 *  position, so an edit keeps an outline slide that is on the screen there. */
export function outlineSlides(o: Outline, ids: string[] = []): SlideContent[] {
  const title = o.title.trim()
  const parts = sectionsOf(o)
  const name = title || OUTLINE_LABEL
  return parts.map((points, i) => ({
    id: ids[i] ?? uid(),
    kind: 'text',
    label: parts.length > 1 ? `${name} · ${i + 1}/${parts.length}` : name,
    lines: points,
    ...(title ? { caption: title } : {}),
    outline: true,
    // The phones can follow along; the stream is left to whatever the sermon
    // says, since a block of points over the camera hides the preacher.
    broadcastUsers: true
  }))
}

/**
 * The item's slides with this outline in them — replacing the outline slides
 * already there, where the first of them was, or going in straight after the
 * card. `null`, or an outline with no points, takes them out.
 */
export function withOutline(slides: SlideContent[], o: Outline | null): SlideContent[] {
  const at = outlineIndex(slides)
  const old = slides.filter(isOutline).map((sl) => sl.id)
  const rest = slides.filter((sl) => !isOutline(sl))
  if (!o || !o.points.length) return old.length ? rest : slides
  const where = at >= 0 ? at : Math.min(1, rest.length)
  return [...rest.slice(0, where), ...outlineSlides(o, old), ...rest.slice(where)]
}
