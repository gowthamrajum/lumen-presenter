import { useEffect, useMemo, useState } from 'react'
import { Bible, type BibleVerse } from '@shared/bible'
import { useStore } from '../../store/useStore'
import { scriptureSlides } from '../slides'
import { TRANSLATIONS, DEFAULT_TRANSLATION_ID, translationMeta } from '../translations'

export function BibleSource(): JSX.Element {
  const addItem = useStore((s) => s.addItem)

  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION_ID)
  const [bible, setBible] = useState<Bible | null>(null)
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [book, setBook] = useState('')
  const [chapter, setChapter] = useState(1)
  const [chapterText, setChapterText] = useState('1')
  const [chapterError, setChapterError] = useState('')
  const [rangeOn, setRangeOn] = useState(false)
  const [vStart, setVStart] = useState(1)
  const [vEnd, setVEnd] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Load the selected translation (Telugu comes from the main process).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setBible(null)
    translationMeta(translationId)
      .load()
      .then((t) => {
        if (cancelled) return
        const b = new Bible(t)
        setBible(b)
        const firstBook = b.books()[0]?.book ?? ''
        const firstChapter = firstBook ? b.chaptersFor(firstBook)[0] ?? 1 : 1
        setBook(firstBook)
        setChapter(firstChapter)
        setChapterText(String(firstChapter))
        setChapterError('')
        setRangeOn(false)
        setSelected(new Set())
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [translationId])

  const books = useMemo(() => bible?.books() ?? [], [bible])
  const chapters = useMemo(() => (bible && book ? bible.chaptersFor(book) : []), [bible, book])
  const maxChapter = chapters.length ? chapters[chapters.length - 1] : 1
  const searchResults = useMemo(
    () => (bible && query.trim() ? bible.search(query) : null),
    [bible, query]
  )
  const browseVerses = useMemo(
    () => (bible && book ? bible.versesFor(book, chapter) : []),
    [bible, book, chapter]
  )
  const maxVerse = browseVerses.length ? browseVerses[browseVerses.length - 1].verse : 1
  // In browse mode, an optional verse range narrows the chapter to vStart–vEnd.
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
    // Only chapters this book actually has (matches the old dropdown's set).
    if (!chapters.includes(n)) {
      setChapterError(`This book has ${maxChapter} chapter${maxChapter > 1 ? 's' : ''}`)
      return
    }
    setChapterError('')
    // Only drop the selection / stale range when the chapter really changes.
    if (n !== chapter) {
      setChapter(n)
      setSelected(new Set())
      setRangeOn(false)
    }
  }

  const refOf = (v: BibleVerse): string => bible?.reference(v) ?? `${v.book} ${v.chapter}:${v.verse}`
  const keyOf = refOf

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

  const addSelected = (goLive: boolean): void => {
    const toAdd = selectedVerses.length ? selectedVerses : verses
    if (!toAdd.length) return
    const title =
      toAdd.length === 1
        ? refOf(toAdd[0])
        : `${refOf(toAdd[0])}–${toAdd[toAdd.length - 1].verse}`
    addItem({ title, kind: 'scripture', slides: scriptureSlides(toAdd, refOf) }, goLive)
    setSelected(new Set())
  }

  const presentOne = (v: BibleVerse): void => {
    addItem({ title: refOf(v), kind: 'scripture', slides: scriptureSlides([v], refOf) }, true)
  }

  return (
    <div className="source bible-source">
      <select
        className="translation-select"
        value={translationId}
        onChange={(e) => setTranslationId(e.target.value)}
        title="Bible translation"
      >
        {TRANSLATIONS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <input
        className="search"
        placeholder="Search text or reference"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setSelected(new Set()) // selection is scoped to the visible list
        }}
        disabled={loading}
      />

      {!searchResults && (
        <>
          <div className="browse-row">
            <select
              value={book}
              onChange={(e) => {
                const nb = e.target.value
                const first = (bible ? bible.chaptersFor(nb)[0] : 1) ?? 1
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
        {loading && <div className="empty-note">Loading {translationMeta(translationId).name}…</div>}
        {!loading && verses.length === 0 && (
          <div className="empty-note">No verses. Try another search.</div>
        )}
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
              <div className="verse-ref">{k}</div>
              <div className="verse-text">{v.text}</div>
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
        {bible ? `${bible.name} · ` : ''}double-click a verse to present it instantly
      </div>
    </div>
  )
}
