import { DEFAULT_BACKGROUND, type Background, type ItemKind, type SlideContent } from './types'

/**
 * Where a motion (video) background may play.
 *
 * Two rules, both the church's: motion is for SONGS — a verse, a notice, a
 * prayer sits on a still — and only ONE projection screen plays it, the one
 * the operator picks; the others, and every phone, get the still.
 *
 * "Background" is the thing behind words. A slide with no words whose video IS
 * the slide — a welcome clip, an announcement video — is content, not a
 * background, and none of this touches it.
 */

const hasWords = (s: { lines?: unknown; composed?: unknown }): boolean =>
  (Array.isArray(s.lines) && s.lines.some((l) => typeof l === 'string' && l.trim())) ||
  (Array.isArray(s.composed) && s.composed.length > 0)

/** The still that stands in for a motion background. */
export const STILL_BACKGROUND: Background = DEFAULT_BACKGROUND

/**
 * A slide as it should look for an item of this kind: outside a song, a video
 * that would sit behind the words — the service's background, or the slide's
 * own — becomes the still one.
 */
export function stillUnlessSong(
  slide: SlideContent,
  itemKind: ItemKind | undefined,
  serviceBackground: Background
): SlideContent {
  if (itemKind === 'song') return slide
  const own = slide.background
  if (own && !hasWords(slide)) return slide // the video is the slide
  const effective = own ?? serviceBackground
  return effective.type === 'video' ? { ...slide, background: STILL_BACKGROUND } : slide
}

/**
 * Every motion background in `v` — a live state, a broadcast payload — swapped
 * for the still one: the service's background, and any slide's behind its
 * words. For the phones, and for every projection screen but the motion one.
 */
export function stillBackgrounds<T>(v: T): T {
  const isSlide = (o: Record<string, unknown>): boolean => 'lines' in o || 'composed' in o || 'kind' in o
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk)
    if (!x || typeof x !== 'object') return x
    const o = x as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(o)) out[k] = walk(val)
    const bg = o.background as { type?: string } | undefined
    if (bg?.type === 'video' && (!isSlide(o) || hasWords(o))) out.background = STILL_BACKGROUND
    return out
  }
  return walk(v) as T
}

/**
 * A live state as one screen with its own background should show it.
 *
 * The screen's background takes the place of whatever sits behind the words —
 * the service's, and a slide's own — so a side screen keeps its look whatever
 * the operator does on the main one. What is NOT behind words is left alone: a
 * wordless clip or picture is the slide itself, and an audio or YouTube
 * background is something to hear or watch, not a backdrop.
 *
 * Motion still follows the church's rule: a video plays for songs only, so
 * outside a song a screen's video becomes the still. Which screen may play it
 * at all is decided after this, by the motion screen.
 */
export function withScreenBackground<T extends LiveStateLike>(state: T, own: Background): T {
  const liveKind = state.order?.find((o) => o.live)?.kind
  const bg = own.type === 'video' && liveKind !== undefined && liveKind !== 'song' ? STILL_BACKGROUND : own
  const replace = (slide: SlideContent | null | undefined): SlideContent | null | undefined => {
    if (!slide?.background) return slide
    if (!hasWords(slide)) return slide
    if (slide.background.type === 'audio' || slide.background.type === 'youtube') return slide
    return { ...slide, background: undefined }
  }
  return { ...state, background: bg, slide: replace(state.slide) }
}

interface LiveStateLike {
  background: Background
  slide: SlideContent | null
  order?: Array<{ kind: ItemKind; live: boolean }>
}
