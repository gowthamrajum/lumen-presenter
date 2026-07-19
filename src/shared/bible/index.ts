import type { BibleBook, BibleVerse, Translation } from './types'
import { SAMPLE_TRANSLATION } from './sample'

export type { BibleBook, BibleVerse, Translation }
export { SAMPLE_TRANSLATION }

/** Fallback canonical order when a translation doesn't provide its own. */
const CANON = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms',
  'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah',
  'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John',
  '2 John', '3 John', 'Jude', 'Revelation'
]

export class Bible {
  private verses: BibleVerse[]
  private order: string[]
  private names: Record<string, string>
  /** Lazily-built book|chapter|verse -> verse index, for O(1) parallel lookups
   *  when pairing two translations (e.g. Telugu + English on one slide). */
  private index?: Map<string, BibleVerse>
  readonly name: string

  constructor(t: Translation = SAMPLE_TRANSLATION) {
    this.name = t.name
    this.verses = t.verses
    this.order = t.order ?? CANON
    this.names = t.names ?? {}
  }

  /** The verse at an exact reference (canonical English book key), or undefined
   *  if this translation doesn't have it. */
  verse(book: string, chapter: number, verse: number): BibleVerse | undefined {
    if (!this.index) {
      this.index = new Map()
      for (const v of this.verses) this.index.set(`${v.book}|${v.chapter}|${v.verse}`, v)
    }
    return this.index.get(`${book}|${chapter}|${verse}`)
  }

  /** Localized display name for an English book key. */
  displayName(book: string): string {
    return this.names[book] ?? book
  }

  private orderIndex(book: string): number {
    const i = this.order.indexOf(book)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }

  books(): BibleBook[] {
    const counts = new Map<string, number>()
    for (const v of this.verses) {
      counts.set(v.book, Math.max(counts.get(v.book) ?? 0, v.chapter))
    }
    return [...counts.entries()]
      .map(([book, chapters]) => ({ book, display: this.displayName(book), chapters }))
      .sort((a, b) => this.orderIndex(a.book) - this.orderIndex(b.book))
  }

  chaptersFor(book: string): number[] {
    const set = new Set<number>()
    for (const v of this.verses) if (v.book === book) set.add(v.chapter)
    return [...set].sort((a, b) => a - b)
  }

  versesFor(book: string, chapter: number): BibleVerse[] {
    return this.verses
      .filter((v) => v.book === book && v.chapter === chapter)
      .sort((a, b) => a.verse - b.verse)
  }

  /** "Book c:v" using the localized book name (for slide captions/labels). */
  reference(v: BibleVerse): string {
    return `${this.displayName(v.book)} ${v.chapter}:${v.verse}`
  }

  /**
   * Full-text search over verse text, plus reference matching against both the
   * English key ("john 3:16") and the localized book name (e.g. Telugu).
   */
  search(query: string, limit = 40): BibleVerse[] {
    const raw = query.trim()
    if (!raw) return []
    const q = raw.toLowerCase()
    const ref = this.parseRef(q)
    // A reference with an explicit verse spec (a range/list like "5:13-16" or
    // "5:13,16") may name more verses than the default text-search cap; make sure
    // every requested verse can come back.
    const cap = ref?.verses ? Math.max(limit, ref.verses.length) : limit
    const out: BibleVerse[] = []
    for (const v of this.verses) {
      const localizedName = this.names[v.book]
      const matchesRef =
        ref &&
        (v.book.toLowerCase().startsWith(ref.book) ||
          (localizedName ? localizedName.startsWith(ref.book) : false)) &&
        (ref.chapter == null || v.chapter === ref.chapter) &&
        (ref.verses == null || ref.verses.includes(v.verse))
      const matchesText = v.text.toLowerCase().includes(q)
      const matchesLocalizedBook = localizedName ? localizedName.includes(raw) : false
      if (matchesRef || matchesText || matchesLocalizedBook) {
        out.push(v)
        if (out.length >= cap) break
      }
    }
    return out
  }

  private parseRef(q: string): { book: string; chapter: number | null; verses: number[] | null } | null {
    // e.g. "john 3:16", "psalm 23", "1 cor 13", "mark 5:13-16", "mark 5:13,16",
    // or a localized book name. The part after ":" is a verse spec: a single
    // verse, a hyphen range, a comma list, or any mix ("13-16,20").
    const m = q.match(/^(.+?)\s*(\d+)?\s*(?::\s*([\d\s,-]+))?$/)
    if (!m) return null
    const book = m[1].trim()
    // The book part must contain a letter (Latin or localized script). This
    // stops bare numbers like "23" from being parsed as book "2" chapter "3",
    // which produced spurious reference matches — such queries fall through to
    // plain text search instead.
    if (!book || !/\p{L}/u.test(book)) return null
    const verses = m[3] ? parseVerseSpec(m[3]) : null
    return {
      book,
      chapter: m[2] ? parseInt(m[2], 10) : null,
      // Empty/garbled spec (e.g. a lone "-") → treat as "whole chapter".
      verses: verses && verses.length ? verses : null
    }
  }
}

/**
 * Expand a verse spec ("13", "13-16", "13,16", "13-16,20") into a sorted, unique
 * list of verse numbers. Reversed ranges ("16-13") are tolerated. Non-numeric
 * junk is ignored. Returns [] for an empty/unparseable spec.
 */
export function parseVerseSpec(spec: string): number[] {
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const p = part.trim()
    if (!p) continue
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      let a = parseInt(range[1], 10)
      let b = parseInt(range[2], 10)
      if (a > b) [a, b] = [b, a]
      for (let n = a; n <= b; n++) out.add(n)
    } else if (/^\d+$/.test(p)) {
      out.add(parseInt(p, 10))
    }
  }
  return [...out].sort((a, b) => a - b)
}

/** English reference, independent of any loaded translation. */
export function referenceOf(v: BibleVerse): string {
  return `${v.book} ${v.chapter}:${v.verse}`
}

/**
 * Collapse a set of verse numbers into a compact reference tail: consecutive runs
 * become ranges, gaps become commas — [13,14,15,16] → "13-16", [13,16] → "13,16",
 * [13,14,15,16,20] → "13-16,20". Used to label a multi-verse selection accurately
 * (a comma list no longer reads like a single range).
 */
export function compactVerses(nums: number[]): string {
  const s = [...new Set(nums)].sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0
  while (i < s.length) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    parts.push(i === j ? String(s[i]) : `${s[i]}-${s[j]}`)
    i = j + 1
  }
  return parts.join(',')
}
