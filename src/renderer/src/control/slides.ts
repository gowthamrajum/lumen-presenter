import type { Background, PptxImport, SlideContent, Song, SongSection } from '@shared/types'
import type { BibleVerse } from '@shared/bible'
import { referenceOf } from '@shared/bible'
import { uid } from '../store/useStore'
import { composeFromLines } from './compose'

/**
 * One slide per verse, with the reference as the caption. `refOf` builds the
 * (optionally localized) reference; defaults to the English "Book c:v".
 */
export function scriptureSlides(
  verses: BibleVerse[],
  refOf: (v: BibleVerse) => string = referenceOf
): SlideContent[] {
  return verses.map((v) => {
    const ref = refOf(v)
    return {
      id: uid(),
      kind: 'scripture',
      label: ref,
      lines: [v.text],
      caption: ref
    }
  })
}

/**
 * Free text -> slides. Blank lines separate slides; single newlines separate
 * lines within a slide.
 */
export function textSlides(text: string, label = 'Text'): SlideContent[] {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  const src = blocks.length ? blocks : ['']
  return src.map((block, i) => ({
    id: uid(),
    kind: 'text',
    label: blocks.length > 1 ? `${label} ${i + 1}` : label,
    lines: block.split('\n')
  }))
}

/** A media-only slide: just a background (image/video), no text. */
export function mediaSlide(url: string, name: string, isVideo: boolean): SlideContent {
  const background: Background = { type: isVideo ? 'video' : 'image', value: url, fit: 'cover' }
  return { id: uid(), kind: 'media', label: name, lines: [], background }
}

/**
 * Imported PowerPoint deck -> slides. Each source slide becomes one Lumen
 * slide, keeping its text (editable) and its full-bleed background image if the
 * importer found one (resolved through the slide/layout/master chain). Slides
 * with no text render as media/background-only.
 */
export function pptxSlides(imp: PptxImport): SlideContent[] {
  return imp.slides.map((s) => {
    const background: Background | undefined = s.backgroundUrl
      ? { type: 'image', value: s.backgroundUrl, fit: 'cover' }
      : s.backgroundColor
        ? { type: 'color', value: s.backgroundColor }
        : undefined
    return {
      id: uid(),
      kind: s.lines.length ? 'text' : background ? 'media' : 'blank',
      label: `${imp.name} ${s.index}`,
      lines: s.lines,
      background,
      overlays: s.overlayUrls
    }
  })
}

/**
 * Repeat-marker notation common in Telugu song books, e.g. `||అదే అదే||`
 * ("repeat this phrase"). The pipes sit cramped against the phrase and, rarely,
 * against a preceding word. Pad 2 spaces inside the pipes (and off any preceding
 * word) so the marker reads cleanly on a slide instead of looking estranged.
 */
export function formatLyricLine(line: string): string {
  return line
    .replace(/\|\|\s*([^|]+?)\s*\|\|/g, '||  $1  ||')
    .replace(/(\S)\|\|/g, '$1  ||')
}

/**
 * Song -> slides. Sections are emitted in arrangement order (or section order),
 * each section's lyric lines split into slides of `linesPerSlide` lines.
 */
export function songSlides(song: Song): SlideContent[] {
  const lpp = Math.max(1, song.linesPerSlide ?? 2)
  const byId = new Map(song.sections.map((s) => [s.id, s]))
  const order: SongSection[] =
    song.arrangement && song.arrangement.length
      ? song.arrangement.map((id) => byId.get(id)).filter((s): s is SongSection => !!s)
      : song.sections

  const slides: SlideContent[] = []
  for (const sec of order) {
    // Drop blank lines (stray trailing Enter, separators) so they don't create
    // half-empty slides or shift the lines-per-slide pagination.
    const lines = sec.lines.filter((l) => l.trim().length > 0).map(formatLyricLine)
    if (lines.length === 0) continue
    const chunks: string[][] = []
    for (let i = 0; i < lines.length; i += lpp) chunks.push(lines.slice(i, i + lpp))
    chunks.forEach((chunk, i) => {
      slides.push({
        id: uid(),
        kind: 'text',
        label: chunks.length > 1 ? `${sec.label} (${i + 1})` : sec.label,
        lines: chunk
      })
    })
  }
  return slides
}

/**
 * Song -> composed (canvas) slides. One composed slide per section, each stanza
 * auto-fit and centred on the 960×540 reference canvas so it can be edited in
 * the Slide Composer. Call ensureComposerFont() first for correct metrics.
 */
export function songComposedSlides(song: Song): SlideContent[] {
  const byId = new Map(song.sections.map((s) => [s.id, s]))
  const order: SongSection[] =
    song.arrangement && song.arrangement.length
      ? song.arrangement.map((id) => byId.get(id)).filter((s): s is SongSection => !!s)
      : song.sections
  return order
    .map((sec): SlideContent => {
      const lines = sec.lines.filter((l) => l.trim().length > 0).map(formatLyricLine)
      return { id: uid(), kind: 'text', label: sec.label, lines, composed: composeFromLines(lines) }
    })
    .filter((s) => s.lines.length > 0)
}

/** A countdown slide targeting `minutes` from now (ticks in the output). */
export function countdownSlide(minutes: number, message?: string): SlideContent {
  const m = Math.max(0, minutes)
  return {
    id: uid(),
    kind: 'countdown',
    label: 'Countdown',
    lines: [],
    countdownTo: Date.now() + m * 60_000,
    countdownMinutes: m,
    message: message?.trim() || undefined
  }
}

/** A live clock slide. */
export function clockSlide(message?: string): SlideContent {
  return { id: uid(), kind: 'clock', label: 'Clock', lines: [], message: message?.trim() || undefined }
}

/** A blank slide with a solid color (useful as an intentional interstitial). */
export function blankSlide(color = '#000000'): SlideContent {
  return {
    id: uid(),
    kind: 'blank',
    label: 'Blank',
    lines: [],
    background: { type: 'color', value: color }
  }
}
