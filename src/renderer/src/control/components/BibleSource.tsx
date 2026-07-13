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
        setBook(b.books()[0]?.book ?? '')
        setChapter(1)
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
  const searchResults = useMemo(
    () => (bible && query.trim() ? bible.search(query) : null),
    [bible, query]
  )
  const browseVerses = useMemo(
    () => (bible && book ? bible.versesFor(book, chapter) : []),
    [bible, book, chapter]
  )
  const verses = searchResults ?? browseVerses

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
        <div className="browse-row">
          <select
            value={book}
            onChange={(e) => {
              setBook(e.target.value)
              setChapter(1)
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
          <select
            value={chapter}
            onChange={(e) => {
              setChapter(Number(e.target.value))
              setSelected(new Set())
            }}
            disabled={loading}
          >
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
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
