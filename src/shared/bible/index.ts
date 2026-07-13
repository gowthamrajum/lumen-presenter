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
  readonly name: string

  constructor(t: Translation = SAMPLE_TRANSLATION) {
    this.name = t.name
    this.verses = t.verses
    this.order = t.order ?? CANON
    this.names = t.names ?? {}
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
    const out: BibleVerse[] = []
    for (const v of this.verses) {
      const localizedName = this.names[v.book]
      const matchesRef =
        ref &&
        (v.book.toLowerCase().startsWith(ref.book) ||
          (localizedName ? localizedName.startsWith(ref.book) : false)) &&
        (ref.chapter == null || v.chapter === ref.chapter) &&
        (ref.verse == null || v.verse === ref.verse)
      const matchesText = v.text.toLowerCase().includes(q)
      const matchesLocalizedBook = localizedName ? localizedName.includes(raw) : false
      if (matchesRef || matchesText || matchesLocalizedBook) {
        out.push(v)
        if (out.length >= limit) break
      }
    }
    return out
  }

  private parseRef(q: string): { book: string; chapter: number | null; verse: number | null } | null {
    // e.g. "john 3:16", "psalm 23", "1 cor 13", or a localized book name
    const m = q.match(/^(.+?)\s*(\d+)?\s*(?::\s*(\d+))?$/)
    if (!m) return null
    const book = m[1].trim()
    // The book part must contain a letter (Latin or localized script). This
    // stops bare numbers like "23" from being parsed as book "2" chapter "3",
    // which produced spurious reference matches — such queries fall through to
    // plain text search instead.
    if (!book || !/\p{L}/u.test(book)) return null
    return {
      book,
      chapter: m[2] ? parseInt(m[2], 10) : null,
      verse: m[3] ? parseInt(m[3], 10) : null
    }
  }
}

/** English reference, independent of any loaded translation. */
export function referenceOf(v: BibleVerse): string {
  return `${v.book} ${v.chapter}:${v.verse}`
}
