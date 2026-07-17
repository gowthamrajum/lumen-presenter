import type { Background, PptxImport, PsalmVerse, SlideContent, Song, SongSection } from '@shared/types'
import type { BibleVerse } from '@shared/bible'
import { referenceOf } from '@shared/bible'
import { uid } from '../store/useStore'
import { composeFromLines } from './compose'

export type PsalmLang = 'both' | 'telugu' | 'english'

/** Psalm verses -> scripture slides, one per verse, in the chosen language(s).
 *  Verses with no text in the chosen language are skipped (no blank slides).
 *  When the English is the ESV and it's actually shown, the caption carries the
 *  required "(ESV)" attribution. */
export function psalmSlides(verses: PsalmVerse[], lang: PsalmLang = 'both', esv = false): SlideContent[] {
  const showsEnglish = lang !== 'telugu'
  return verses
    .map((v) => {
      const ref = `Psalm ${v.chapter}:${v.verse}`
      const lines = (lang === 'telugu' ? [v.telugu] : lang === 'english' ? [v.english] : [v.telugu, v.english]).filter(
        (l) => l && l.trim()
      )
      const caption = esv && showsEnglish ? `${ref} (ESV)` : ref
      return { id: uid(), kind: 'scripture' as const, label: ref, lines, caption }
    })
    .filter((s) => s.lines.length > 0)
}

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
 * Tidy lyric spacing for display. Song-book text often carries long, ragged runs
 * of spaces — e.g. `Deevinchave Samrudhigaa          ||Deevinchaave||` — which
 * look untidy. Collapse any run of 2+ spaces to a single pair and trim the ends,
 * so lines read cleanly and evenly.
 *
 * The `||…||` repeat-marker notation common in Telugu song books (e.g. `||అదే అదే||`,
 * "repeat this phrase") is left exactly as authored — the pipes and whatever sits
 * between them are never repadded.
 */
export function formatLyricLine(line: string): string {
  return line.replace(/[ \t]{2,}/g, '  ').replace(/^[ \t]+|[ \t]+$/g, '')
}

/**
 * A lyric line whose trailing content is a repeat count, e.g. `…Kaadayaa (2)` or
 * `…Lenayaa (2)  ||Neevu Leni||` ("sing twice"). Such a line must stay on the
 * same slide as the line above it, so a repeated phrase is never split from its
 * lead-in. The `(N)` may be followed by an optional `||…||` repeat marker.
 */
const REPEAT_LINE = /\(\s*\d+\s*\)\s*(?:\|\|[^|]*\|\|)?\s*$/

/**
 * Split a section's lyric lines into slides of ~`lpp` lines, with three rules:
 *   1. a line ending in a repeat count `(N)` shares its slide with the line above
 *      it (repeats stay attached to their lead-in — never split off);
 *   2. every slide shows at least 2 lines — a lonely leftover is rebalanced or
 *      folded into the previous slide;
 *   3. a slide never exceeds `2·lpp` lines (≈4) — so a long or all-repeat chorus
 *      still breaks into readable slides even though rule 1 groups repeats.
 * The cap wins over rule 1 as a last resort so a run of repeats can't pile onto
 * one giant slide.
 */
export function chunkLyricLines(lines: string[], lpp: number): string[][] {
  const cap = lpp * 2 // hard ceiling: target lpp lines, grow to 2·lpp to keep repeats together
  const slides: string[][] = []
  let cur: string[] = []
  for (const line of lines) {
    // A repeat line wants to stay on the current slide (with the line above) —
    // unless that slide is already at the cap.
    const keepWithAbove = REPEAT_LINE.test(line) && cur.length > 0 && cur.length < cap
    if (cur.length >= lpp && !keepWithAbove) {
      slides.push(cur)
      cur = []
    }
    cur.push(line)
    if (cur.length >= cap) {
      slides.push(cur)
      cur = []
    }
  }
  if (cur.length) slides.push(cur)
  // Rule 2: no single-line slide. Prefer to rebalance one line down from a fuller
  // previous slide (keeps both within the cap); otherwise merge (previous had 2 →
  // becomes 3, still within the cap).
  const n = slides.length
  if (n > 1 && slides[n - 1].length < 2) {
    const prev = slides[n - 2]
    if (prev.length > 2) slides[n - 1].unshift(prev.pop() as string)
    else {
      prev.push(...slides[n - 1])
      slides.pop()
    }
  }
  return slides
}

/**
 * Song -> slides. Sections are emitted in arrangement order (or section order),
 * each section's lyric lines split into slides of `linesPerSlide` lines (grouping
 * repeat lines and keeping at least 2 lines per slide — see chunkLyricLines).
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
    const chunks = chunkLyricLines(lines, lpp)
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
