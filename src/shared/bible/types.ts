export interface BibleVerse {
  book: string
  chapter: number
  verse: number
  text: string
}

export interface BibleBook {
  book: string
  chapters: number
}

/**
 * A translation is a flat list of verses plus a derived book index.
 * The bundled sample is a subset; users can import a full translation
 * JSON of the same shape ({ name, verses: BibleVerse[] }).
 */
export interface Translation {
  name: string
  verses: BibleVerse[]
}
