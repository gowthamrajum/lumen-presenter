import type { BibleBook, BibleVerse, Translation } from './types'
import { SAMPLE_TRANSLATION } from './sample'

export type { BibleBook, BibleVerse, Translation }
export { SAMPLE_TRANSLATION }

/** Canonical order used to sort the book list. */
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
  readonly name: string

  constructor(t: Translation = SAMPLE_TRANSLATION) {
    this.name = t.name
    this.verses = t.verses
  }

  books(): BibleBook[] {
    const counts = new Map<string, number>()
    for (const v of this.verses) {
      counts.set(v.book, Math.max(counts.get(v.book) ?? 0, v.chapter))
    }
    return [...counts.entries()]
      .map(([book, chapters]) => ({ book, chapters }))
      .sort((a, b) => CANON.indexOf(a.book) - CANON.indexOf(b.book))
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

  /** Full-text search over verse text plus a "Book c:v" reference match. */
  search(query: string, limit = 40): BibleVerse[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const ref = this.parseRef(q)
    const out: BibleVerse[] = []
    for (const v of this.verses) {
      const matchesRef =
        ref &&
        v.book.toLowerCase().startsWith(ref.book) &&
        (ref.chapter == null || v.chapter === ref.chapter) &&
        (ref.verse == null || v.verse === ref.verse)
      if (matchesRef || v.text.toLowerCase().includes(q)) {
        out.push(v)
        if (out.length >= limit) break
      }
    }
    return out
  }

  private parseRef(q: string): { book: string; chapter: number | null; verse: number | null } | null {
    // e.g. "john 3:16", "psalm 23", "1 cor 13"
    const m = q.match(/^([1-3]?\s?[a-z ]+?)\s*(\d+)?\s*(?::\s*(\d+))?$/)
    if (!m) return null
    const book = m[1].trim()
    if (!book) return null
    return {
      book,
      chapter: m[2] ? parseInt(m[2], 10) : null,
      verse: m[3] ? parseInt(m[3], 10) : null
    }
  }
}

export function referenceOf(v: BibleVerse): string {
  return `${v.book} ${v.chapter}:${v.verse}`
}
