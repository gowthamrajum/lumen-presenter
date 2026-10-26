import { smartRows } from '@shared/smartRows'
import type { SlideContent, ThemeStyle } from '@shared/types'

/**
 * Measuring slide text in its real font, and keeping a song's slides in step.
 *
 * Every song slide is fitted to its own words, so pressing through a song
 * swung the size about — a two-word line huge, the long verse after it small —
 * and it read as two different songs. Fitting every slide to its busiest
 * sibling (tried before) overcorrects: short slides were left filling ~64% of
 * the screen. So it is a BAND instead: each slide's natural size is worked out
 * (after smart rows, which already lift the small ones), the song's typical
 * size is the median of those, and no slide may sit more than BAND above it.
 * Big outliers come down; nothing that fits is made smaller than the typical.
 */
const BAND = 1.15
/** Reference box: sizes are compared as a share of a 16:9 box's height. */
const REF_W = 1600
const REF_H = 900
/** The usual ceiling (useFitText's maxFraction) — a slide never exceeds it. */
export const DEFAULT_MAX_FRACTION = 0.4

// ---- measuring ---------------------------------------------------------------
let fontsVersion = 0
if (typeof document !== 'undefined' && document.fonts) {
  // Measured before the web fonts land, every width is a fallback's: measure
  // again (new cache key) once they have.
  const bump = (): void => {
    fontsVersion++
    measurers.clear()
  }
  void document.fonts.ready.then(bump)
  document.fonts.addEventListener?.('loadingdone', bump)
}
const measurers = new Map<string, (text: string) => number>()

/** Width of `text` at 100px in this font (bold, as slides are drawn). */
export function measurerFor(fontFamily: string, uppercase: boolean): (text: string) => number {
  const key = `${fontFamily}|${uppercase}`
  let m = measurers.get(key)
  if (m) return m
  const ctx = document.createElement('canvas').getContext('2d')
  const cache = new Map<string, number>()
  m = (text: string): number => {
    const t = uppercase ? text.toUpperCase() : text
    let w = cache.get(t)
    if (w === undefined) {
      if (ctx) {
        ctx.font = `700 100px ${fontFamily}`
        w = ctx.measureText(t).width
      } else w = t.length * 55 // no canvas: a rough average glyph width
      cache.set(t, w)
    }
    return w
  }
  measurers.set(key, m)
  return m
}

export const fontsMeasuredVersion = (): number => fontsVersion

// ---- a song's band -----------------------------------------------------------
/** The text size a slide reaches on its own, as a share of the box height. */
function naturalShare(lines: string[], measure: (t: string) => number, lineHeight: number): number {
  const cap = REF_H * DEFAULT_MAX_FRACTION
  const rows = smartRows(lines, { measure, boxW: REF_W, boxH: REF_H, lineHeight, cap })
  const widest = Math.max(...rows.map(measure), 1)
  const size = Math.min(((REF_W * 0.9) / widest) * 100, (REF_H * 0.92) / (rows.length * lineHeight), cap)
  return size / REF_H
}

const ceilings = new Map<string, Map<string, number>>()

/**
 * For a song's slides, the largest share of the screen height each may take —
 * only for slides that would otherwise sit above the song's band. Slides kept
 * on single lines (song lyrics) take part; anything else is left alone.
 */
export function songCeilings(slides: SlideContent[], theme: Pick<ThemeStyle, 'fontFamily' | 'uppercase'>): Map<string, number> {
  const lyric = slides.filter((s) => s.kind === 'text' && s.singleLine && (s.lines?.length ?? 0) > 0)
  const key = `${fontsVersion}|${theme.fontFamily}|${theme.uppercase}|${lyric.map((s) => `${s.id}:${s.lines.join('\n')}`).join('\u0000')}`
  const hit = ceilings.get(key)
  if (hit) return hit
  const out = new Map<string, number>()
  if (lyric.length >= 2) {
    const measure = measurerFor(theme.fontFamily, theme.uppercase)
    const shares = lyric.map((s) => naturalShare(s.lines, measure, 1.22))
    const sorted = [...shares].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    lyric.forEach((s, i) => {
      if (shares[i] > median * BAND) out.set(s.id, median * BAND)
    })
  }
  if (ceilings.size > 200) ceilings.clear()
  ceilings.set(key, out)
  return out
}

/** The slide with its song's ceiling on it (`sizeCap`), when it has one. */
export function withSongCap(
  slide: SlideContent,
  siblings: SlideContent[] | undefined,
  theme: Pick<ThemeStyle, 'fontFamily' | 'uppercase'>
): SlideContent {
  if (!siblings || !slide.singleLine) return slide
  const cap = songCeilings(siblings, theme).get(slide.id)
  return cap ? { ...slide, sizeCap: cap } : slide
}
