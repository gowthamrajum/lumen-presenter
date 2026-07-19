import { useEffect, useMemo, useRef, useState } from 'react'
import { Bible, referenceOf, compactVerses, type BibleBook, type BibleVerse } from '@shared/bible'
import { useStore } from '../../store/useStore'
import { bilingualScriptureSlides, type PsalmLang } from '../slides'
import { LangToggle } from './LangToggle'

/**
 * Bible source — bilingual like the Psalms source. Both church bibles load once
 * (Telugu OV + WEB English); a verse pairs its Telugu and English text by the
 * canonical English book key + chapter + verse, so a slide can carry Both, just
 * Telugu, or just English. Reference search ("John 3:16") works in any mode;
 * text search reads the language you're browsing in.
 */
export function BibleSource(): JSX.Element {
  const addItem = useStore((s) => s.addItem)

  const [telugu, setTelugu] = useState<Bible | null>(null)
  const [web, setWeb] = useState<Bible | null>(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState<PsalmLang>('both')

  const [query, setQuery] = useState('')
  const [book, setBook] = useState('')
  const [chapter, setChapter] = useState(1)
  const [chapterText, setChapterText] = useState('1')
  const [chapterError, setChapterError] = useState('')
  const [rangeOn, setRangeOn] = useState(false)
  const [vStart, setVStart] = useState(1)
  const [vEnd, setVEnd] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Load both translations up front (each is read once by the main process).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([window.lumen.loadTranslation('telugu'), window.lumen.loadTranslation('web')])
      .then(([te, en]) => {
        if (cancelled) return
        const teB = te ? new Bible(te) : null
        const enB = en ? new Bible(en) : null
        setTelugu(teB)
        setWeb(enB)
        const base = teB ?? enB
        const firstBook = base?.books()[0]?.book ?? ''
        const firstChapter = firstBook && base ? base.chaptersFor(firstBook)[0] ?? 1 : 1
        setBook(firstBook)
        setChapter(firstChapter)
        setChapterText(String(firstChapter))
        setChapterError('')
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Browse/search from the language you're reading (so English word-search works
  // in English mode); the book KEY is the same across both, so toggling language
  // keeps your place. Both/Telugu browse the Telugu OV.
  const primary = lang === 'english' ? web : telugu

  const teOf = (v: BibleVerse): string => telugu?.verse(v.book, v.chapter, v.verse)?.text ?? ''
  const enOf = (v: BibleVerse): string => web?.verse(v.book, v.chapter, v.verse)?.text ?? ''
  const refOf = (v: BibleVerse): string => primary?.reference(v) ?? referenceOf(v)
  const keyOf = (v: BibleVerse): string => referenceOf(v) // stable across languages
  const previewOf = (v: BibleVerse): string => {
    const te = teOf(v)
    const en = enOf(v)
    return lang === 'telugu' ? te : lang === 'english' ? en : [te, en].filter(Boolean).join('\n')
  }

  const books = useMemo(() => primary?.books() ?? [], [primary])

  // Book-name autocomplete: while the operator is still typing the book (before a
  // chapter number), suggest matching books so "rev" → Revelation. Matches the
  // localized display name and the English key; hidden once a chapter is typed or
  // the name is already complete.
  const searchRef = useRef<HTMLInputElement>(null)
  const bookSuggestions = useMemo<BibleBook[]>(() => {
    const m = query.trim().match(/^(.+?)\s*(\d+\s*(?::[\d\s,-]+)?)?$/)
    const bq = m?.[1]?.trim().toLowerCase() ?? ''
    if (!bq || m?.[2]) return [] // nothing typed yet, or a chapter is already present
    const hits = books.filter(
      (b) => b.display.toLowerCase().startsWith(bq) || b.book.toLowerCase().startsWith(bq)
    )
    // Don't dangle a single suggestion that just echoes a fully-typed name.
    if (hits.length === 1 && (hits[0].display.toLowerCase() === bq || hits[0].book.toLowerCase() === bq)) return []
    return hits.slice(0, 8)
  }, [query, books])

  const pickBook = (b: BibleBook): void => {
    setQuery(`${b.display} `) // leave a trailing space so the operator types "3:16" next
    setSelected(new Set())
    searchRef.current?.focus()
  }
  const chapters = useMemo(() => (primary && book ? primary.chaptersFor(book) : []), [primary, book])
  const maxChapter = chapters.length ? chapters[chapters.length - 1] : 1
  const searchResults = useMemo(
    () => (primary && query.trim() ? primary.search(query) : null),
    [primary, query]
  )
  const browseVerses = useMemo(
    () => (primary && book ? primary.versesFor(book, chapter) : []),
    [primary, book, chapter]
  )
  const maxVerse = browseVerses.length ? browseVerses[browseVerses.length - 1].verse : 1
  const rangedVerses = useMemo(
    () => (rangeOn && vStart <= vEnd ? browseVerses.filter((v) => v.verse >= vStart && v.verse <= vEnd) : browseVerses),
    [browseVerses, rangeOn, vStart, vEnd]
  )
  const verses = searchResults ?? rangedVerses

  // Free-form chapter box: whole number within the selected book's chapters.
  const onChapterText = (raw: string): void => {
    setChapterText(raw)
    const t = raw.trim()
    if (t === '') {
      setChapterError('')
      return
    }
    if (!/^\d+$/.test(t)) {
      setChapterError('Enter a number')
      return
    }
    const n = Number(t)
    if (!chapters.includes(n)) {
      setChapterError(`This book has ${maxChapter} chapter${maxChapter > 1 ? 's' : ''}`)
      return
    }
    setChapterError('')
    if (n !== chapter) {
      setChapter(n)
      setSelected(new Set())
      setRangeOn(false)
    }
  }

  const toggle = (v: BibleVerse): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = keyOf(v)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const selectedVerses = verses.filter((v) => selected.has(keyOf(v)))

  // Accurate label for a selection: one verse → its ref; several within the same
  // chapter → "Book c:13-16,20" (comma lists no longer read like a range); a
  // cross-chapter span → first–last full refs.
  const titleFor = (list: BibleVerse[]): string => {
    if (list.length === 1) return refOf(list[0])
    const sameChapter = list.every((v) => v.book === list[0].book && v.chapter === list[0].chapter)
    if (sameChapter) {
      const prefix = refOf(list[0]).replace(/:\d+$/, '') // "Book c"
      return `${prefix}:${compactVerses(list.map((v) => v.verse))}`
    }
    return `${refOf(list[0])}–${refOf(list[list.length - 1])}`
  }

  const addSelected = (goLive: boolean): void => {
    const toAdd = selectedVerses.length ? selectedVerses : verses
    if (!toAdd.length) return
    const title = titleFor(toAdd)
    // Bible passages auto-advance to the Sermon slide after the verse TTL.
    addItem(
      { title, kind: 'scripture', slides: bilingualScriptureSlides(toAdd, lang, teOf, enOf, refOf), autoAdvance: true },
      goLive
    )
    setSelected(new Set())
  }

  const presentOne = (v: BibleVerse): void => {
    addItem(
      { title: refOf(v), kind: 'scripture', slides: bilingualScriptureSlides([v], lang, teOf, enOf, refOf), autoAdvance: true },
      true
    )
  }

  return (
    <div className="source bible-source">
      <div className="lang-row">
        <LangToggle value={lang} onChange={(l) => setLang(l as PsalmLang)} />
      </div>

      <div className="search-wrap">
        <input
          ref={searchRef}
          className="search"
          placeholder="Search text or reference (e.g. Mark 5:13-16 or 5:13,16)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(new Set()) // selection is scoped to the visible list
          }}
          disabled={loading}
        />
        {bookSuggestions.length > 0 && (
          <div className="book-suggest" role="listbox">
            {bookSuggestions.map((b) => (
              <button
                key={b.book}
                type="button"
                role="option"
                aria-selected={false}
                className="book-suggest-item"
                // onMouseDown (not onClick) so the pick lands before the input blurs.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pickBook(b)
                }}
              >
                <span className="book-suggest-name">{b.display}</span>
                {b.display !== b.book && <span className="book-suggest-key">{b.book}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!searchResults && (
        <>
          <div className="browse-row">
            <select
              value={book}
              onChange={(e) => {
                const nb = e.target.value
                const first = (primary ? primary.chaptersFor(nb)[0] : 1) ?? 1
                setBook(nb)
                setChapter(first)
                setChapterText(String(first))
                setChapterError('')
                setRangeOn(false)
                setSelected(new Set())
              }}
              disabled={loading}
            >
              {books.map((b) => (
                <option key={b.book} value={b.book}>
                  {b.display}
                </option>
              ))}
            </select>
            <label className="chapter-field">
              <span className="chapter-field-pre">Ch.</span>
              <input
                className="search"
                type="text"
                inputMode="numeric"
                value={chapterText}
                onChange={(e) => onChapterText(e.target.value)}
                placeholder={`1–${maxChapter}`}
                aria-label="Chapter number"
                title={`Type a chapter (1–${maxChapter})`}
                disabled={loading}
              />
            </label>
          </div>
          {chapterError && <div className="chapter-error">{chapterError}</div>}
          <div className="verse-range">
            <label className="chk">
              <input type="checkbox" checked={rangeOn} onChange={(e) => setRangeOn(e.target.checked)} disabled={loading} />
              Verse range
            </label>
            {rangeOn && (
              <div className="verse-range-inputs">
                <input
                  type="number"
                  min={1}
                  max={maxVerse}
                  value={vStart}
                  onChange={(e) => setVStart(Math.max(1, Number(e.target.value) || 1))}
                  title="From verse"
                />
                <span>–</span>
                <input
                  type="number"
                  min={1}
                  max={maxVerse}
                  value={vEnd}
                  onChange={(e) => setVEnd(Math.max(1, Number(e.target.value) || 1))}
                  title="To verse"
                />
                <span className="verse-range-max">of {maxVerse}</span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="verse-list">
        {loading && <div className="empty-note">Loading Telugu + English…</div>}
        {!loading && verses.length === 0 && <div className="empty-note">No verses. Try another search.</div>}
        {verses.map((v) => {
          const k = keyOf(v)
          return (
            <div
              key={k}
              className={`verse-item ${selected.has(k) ? 'selected' : ''}`}
              onClick={() => toggle(v)}
              onDoubleClick={() => presentOne(v)}
              title="Click to select · double-click to present now"
            >
              <div className="verse-ref">{refOf(v)}</div>
              <div className="verse-text psalm-text">{previewOf(v)}</div>
            </div>
          )
        })}
      </div>

      <div className="source-actions">
        <button className="btn btn-primary" onClick={() => addSelected(false)} disabled={loading || verses.length === 0}>
          Add {selectedVerses.length ? `${selectedVerses.length} verse${selectedVerses.length > 1 ? 's' : ''}` : 'all'}
        </button>
        <button className="btn" onClick={() => addSelected(true)} disabled={loading || verses.length === 0}>
          Add &amp; Present
        </button>
      </div>
      <div className="source-hint">
        {loading ? 'Loading…' : 'Telugu OV + WEB · double-click a verse to present it instantly'}
      </div>
    </div>
  )
}
