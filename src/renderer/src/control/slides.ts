import type { Background, PptxImport, PsalmVerse, SlideContent, Song, SongSection } from '@shared/types'
import type { BibleVerse } from '@shared/bible'
import { referenceOf } from '@shared/bible'
import { uid } from '../store/useStore'
import { composeFromLines } from './compose'

export type PsalmLang = 'both' | 'telugu' | 'english'

/** Psalm verses -> scripture slides, one per verse, in the chosen language(s).
 *  Verses with no text in the chosen language are skipped (no blank slides).
 *  The caption is just the reference — no version marker on the footer. */
export function psalmSlides(verses: PsalmVerse[], lang: PsalmLang = 'both'): SlideContent[] {
  const out = verses
    .map((v) => {
      const ref = `Psalm ${v.chapter}:${v.verse}`
      const lines = (lang === 'telugu' ? [v.telugu] : lang === 'english' ? [v.english] : [v.telugu, v.english]).filter(
        (l) => l && l.trim()
      )
      return { id: uid(), kind: 'scripture' as const, label: ref, lines, caption: ref }
    })
  return out.filter((s) => s.lines.length > 0)
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
 * One scripture slide per verse in the chosen language(s) — Telugu, English, or
 * both (Telugu first, English next). `teluguOf`/`englishOf` resolve each verse's
 * text in that language (empty string if the translation lacks it); `refOf`
 * builds the caption/label. Verses with no text in the chosen language(s) are
 * dropped (no blank slides). Mirrors psalmSlides for the general Bible source.
 */
export function bilingualScriptureSlides(
  verses: BibleVerse[],
  lang: PsalmLang,
  teluguOf: (v: BibleVerse) => string,
  englishOf: (v: BibleVerse) => string,
  refOf: (v: BibleVerse) => string
): SlideContent[] {
  return verses
    .map((v) => {
      const te = (teluguOf(v) || '').trim()
      const en = (englishOf(v) || '').trim()
      const lines = (lang === 'telugu' ? [te] : lang === 'english' ? [en] : [te, en]).filter((l) => l)
      const ref = refOf(v)
      return { id: uid(), kind: 'scripture' as const, label: ref, lines, caption: ref }
    })
    .filter((s) => s.lines.length > 0)
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
    kind: 'text' as const,
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
export function chunkLyricLines(lines: string[], lpp: number, groupRepeats = true): string[][] {
  const cap = lpp * 2 // hard ceiling: target lpp lines, grow to 2·lpp to keep repeats together
  const slides: string[][] = []
  let cur: string[] = []
  for (const line of lines) {
    // A repeat line wants to stay on the current slide (with the line above) —
    // unless that slide is already at the cap. (Skipped for bilingual blocks,
    // which are already pre-grouped 2 Telugu + 2 English per slide.)
    const keepWithAbove = groupRepeats && REPEAT_LINE.test(line) && cur.length > 0 && cur.length < cap
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

// ---- bilingual (Telugu + English transliteration) pairing --------------------

/** Any character from the Telugu Unicode block. */
const TELUGU_CHAR = /[ఀ-౿]/
/** Any Latin letter — the script the transliteration is written in. */
const LATIN_CHAR = /[A-Za-z]/

function isTelugu(line: string): boolean {
  return TELUGU_CHAR.test(line)
}

/**
 * Is this section a bilingual stanza — Telugu lyrics with an English
 * transliteration underneath? Requires at least two lines of each script, so a
 * Telugu song carrying one stray Latin word ("Hallelujah") is not mistaken for
 * one. Used to pair sections that carry no `bilingual` flag (hand-authored songs,
 * or a song whose flag predates it).
 */
export function isBilingualSection(lines: string[]): boolean {
  let te = 0
  let en = 0
  for (const l of lines) {
    if (!l.trim()) continue
    if (isTelugu(l)) te++
    else if (LATIN_CHAR.test(l)) en++
  }
  return te >= 2 && en >= 2
}

/**
 * Strict check: does this slide keep every Telugu line with its transliteration?
 * A slide is paired when its Telugu lines and its Latin lines are equal in number
 * (they correspond one-for-one, in order) — or when it holds a single language.
 * This is the invariant `chunkBilingualLines` guarantees by construction; exported
 * so the pairing can be asserted (and unit-tested) rather than assumed.
 */
export function isSlidePaired(lines: string[]): boolean {
  const te = lines.filter((l) => l.trim() && isTelugu(l)).length
  const en = lines.filter((l) => l.trim() && !isTelugu(l) && LATIN_CHAR.test(l)).length
  return te === 0 || en === 0 || te === en
}

/**
 * Split a bilingual section into slides that NEVER separate a Telugu line from
 * its English transliteration.
 *
 * The lines arrive as runs — some Telugu lines, then their transliterations —
 * so we rebuild that structure instead of counting lines (which is what let a
 * pair drift onto two slides). Within a run-pair the two languages correspond by
 * position: Telugu[i] <-> English[i]. Each output slide carries `pairsPerSlide`
 * whole pairs, laid out Telugu-block-then-English-block to match the existing look.
 *
 * When a source stanza is lopsided (the catalog has ~180 such sections — e.g. 22
 * Telugu lines against 4 English) the surplus lines have no counterpart to keep.
 * They are emitted on their own single-language slides AFTER the paired ones,
 * rather than being folded in beside an unrelated pair.
 */
export function chunkBilingualLines(lines: string[], pairsPerSlide: number): string[][] {
  const per = Math.max(1, pairsPerSlide)
  const src = lines.filter((l) => l.trim().length > 0)

  // Rebuild the [Telugu run][English run] blocks the lines were laid out in.
  const blocks: { te: string[]; en: string[] }[] = []
  let cur: { te: string[]; en: string[] } | null = null
  for (const line of src) {
    const telugu = isTelugu(line)
    // A Telugu line after this block's English run has started begins a new block.
    if (!cur || (telugu && cur.en.length > 0)) {
      cur = { te: [], en: [] }
      blocks.push(cur)
    }
    if (telugu) cur.te.push(line)
    else cur.en.push(line)
  }

  const slides: string[][] = []
  for (const b of blocks) {
    const paired = Math.min(b.te.length, b.en.length)
    // Whole pairs, `per` of them per slide: Telugu lines first, then their
    // transliterations, so each slide reads exactly as the stanza does.
    for (let i = 0; i < paired; i += per) {
      const n = Math.min(per, paired - i)
      slides.push([...b.te.slice(i, i + n), ...b.en.slice(i, i + n)])
    }
    // Whatever had no counterpart: its own slides, one language, never mixed in.
    const leftover = b.te.length > paired ? b.te.slice(paired) : b.en.slice(paired)
    for (let i = 0; i < leftover.length; i += per) slides.push(leftover.slice(i, i + per))
  }
  return slides
}

// ---- operator-chosen slide grouping -----------------------------------------

/**
 * One groupable unit — the smallest thing a slide break can fall between.
 *
 * `lines` renders first (the Telugu block of a bilingual stanza, or simply the
 * lyric line of a single-language one) and `translit` is the English
 * transliteration that must stay with it. Keeping the two sides as separate
 * fields is what preserves the Telugu-block-then-English-block layout when
 * several units share a slide — concatenating a unit whole would interleave
 * them (తె1 Te1 తె2 Te2) instead of stacking them (తె1 తె2 Te1 Te2).
 */
export interface SlideUnit {
  lines: string[]
  translit: string[]
}

/** A unit's lines in render order. */
export function unitLines(u: SlideUnit): string[] {
  return [...u.lines, ...u.translit]
}

/**
 * Decompose a section into units. In a bilingual section a unit is a whole pair
 * — a Telugu line with its transliteration — so an operator moving breaks around
 * physically cannot separate the two; an unpaired leftover line is its own unit.
 * (chunkBilingualLines at one pair per slide IS that decomposition, so the two
 * can never disagree.)
 */
export function sectionUnits(lines: string[], bilingual: boolean): SlideUnit[] {
  const src = lines.filter((l) => l.trim().length > 0)
  if (!bilingual) return src.map((l) => ({ lines: [l], translit: [] }))
  return chunkBilingualLines(src, 1).map((pair) => ({
    lines: pair.filter((l) => isTelugu(l)),
    translit: pair.filter((l) => !isTelugu(l))
  }))
}

/**
 * The unit grouping the automatic split would produce — what the grouping editor
 * opens on, so the operator starts from today's behaviour and adjusts.
 */
export function autoGroups(lines: string[], bilingual: boolean, lpp: number): number[] {
  const units = sectionUnits(lines, bilingual)
  const src = lines.filter((l) => l.trim().length > 0)
  const chunks = bilingual
    ? chunkBilingualLines(src, Math.max(1, Math.round(lpp / 2)))
    : chunkLyricLines(src, lpp, true)
  // Both walk the same lines in the same order, so units can be consumed to
  // match each chunk's line count — converting chunk sizes (lines) to units.
  const out: number[] = []
  let u = 0
  for (const c of chunks) {
    let taken = 0
    let n = 0
    while (u < units.length && taken < c.length) {
      taken += unitLines(units[u]).length
      u++
      n++
    }
    if (n > 0) out.push(n)
  }
  if (u < units.length) out.push(units.length - u)
  return out
}

/**
 * Slice units into slides by a unit-count grouping. Each slide stacks every
 * unit's lyric lines first, then every unit's transliterations — the same
 * block layout the automatic split produces. Never drops a unit.
 */
export function applyGroups(units: SlideUnit[], groups: number[]): string[][] {
  const slide = (us: SlideUnit[]): string[] => [
    ...us.flatMap((u) => u.lines),
    ...us.flatMap((u) => u.translit)
  ]
  const out: string[][] = []
  let i = 0
  for (const g of groups) {
    const n = Math.max(1, Math.floor(g))
    const s = units.slice(i, i + n)
    i += n
    if (s.length) out.push(slide(s))
  }
  if (i < units.length) out.push(slide(units.slice(i))) // safety net
  return out
}

/** A grouping still describes its section only while it accounts for every unit. */
export function groupsFit(groups: number[] | undefined, unitCount: number): groups is number[] {
  return !!groups?.length && groups.reduce((a, b) => a + b, 0) === unitCount
}

/**
 * Song -> slides. Sections are emitted in arrangement order (or section order),
 * each section's lyric lines split into slides of `linesPerSlide` lines (grouping
 * repeat lines and keeping at least 2 lines per slide — see chunkLyricLines).
 *
 * Bilingual sections take the pairing path instead, so a Telugu line and its
 * English transliteration always share a slide (see chunkBilingualLines).
 *
 * A section carrying an operator-chosen `groups` uses that instead of either
 * automatic split — but still over units, so the bilingual pairing holds.
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
    // Bilingual sections pair Telugu with its transliteration and split on pair
    // boundaries — counting lines (the old path) could strand a line's translit on
    // the next slide whenever a stanza's two languages were uneven. `bilingual` is
    // set by the catalog import; detect it too, for hand-authored songs.
    const bilingual = song.bilingual || isBilingualSection(lines)
    // An operator grouping wins when it still accounts for every unit; a stale
    // one (the lines changed under it) falls back to the automatic split.
    const units = sectionUnits(lines, bilingual)
    const chunks = groupsFit(sec.groups, units.length)
      ? applyGroups(units, sec.groups)
      : bilingual
        ? // lpp counts LINES (4 = 2 Telugu + 2 English), the chunker counts PAIRS.
          chunkBilingualLines(lines, Math.max(1, Math.round(lpp / 2)))
        : chunkLyricLines(lines, lpp, true)
    chunks.forEach((chunk, i) => {
      slides.push({
        id: uid(),
        kind: 'text',
        label: chunks.length > 1 ? `${sec.label} (${i + 1})` : sec.label,
        lines: chunk,
        // Each lyric line stays on its own single line — the output shrinks the
        // font to fit the widest line instead of wrapping it.
        singleLine: true
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
