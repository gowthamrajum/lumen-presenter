export interface BibleVerse {
  /** canonical English book key, e.g. "Genesis" (stable across translations) */
  book: string
  chapter: number
  verse: number
  text: string
}

export interface BibleBook {
  /** canonical English key */
  book: string
  /** localized display name (falls back to the English key) */
  display: string
  chapters: number
}

/**
 * A translation is a flat list of verses plus optional presentation metadata.
 * The bundled WEB sample is a subset; full translations (e.g. Telugu) are
 * loaded on demand and add `order`/`names` so books sort canonically and show
 * localized names.
 */
export interface Translation {
  name: string
  language?: string
  verses: BibleVerse[]
  /** canonical order of English book keys (else a built-in order is used) */
  order?: string[]
  /** English book key -> localized display name */
  names?: Record<string, string>
}
