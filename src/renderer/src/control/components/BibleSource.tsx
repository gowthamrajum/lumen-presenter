import { useMemo, useState } from 'react'
import { Bible, referenceOf, type BibleVerse } from '@shared/bible'
import { useStore } from '../../store/useStore'
import { scriptureSlides } from '../slides'

const bible = new Bible()

export function BibleSource(): JSX.Element {
  const addSlides = useStore((s) => s.addSlides)
  const outputOpen = useStore((s) => s.outputStatus.open)

  const books = useMemo(() => bible.books(), [])
  const [query, setQuery] = useState('')
  const [book, setBook] = useState(books[0]?.book ?? 'John')
  const [chapter, setChapter] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const chapters = useMemo(() => bible.chaptersFor(book), [book])
  const searchResults = useMemo(() => (query.trim() ? bible.search(query) : null), [query])
  const browseVerses = useMemo(() => bible.versesFor(book, chapter), [book, chapter])
  const verses = searchResults ?? browseVerses

  const keyOf = (v: BibleVerse): string => referenceOf(v)

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
    addSlides(scriptureSlides(toAdd), goLive)
    setSelected(new Set())
  }

  const presentOne = (v: BibleVerse): void => {
    addSlides(scriptureSlides([v]), true)
  }

  return (
    <div className="source bible-source">
      <input
        className="search"
        placeholder="Search text or reference (e.g. John 3:16)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!searchResults && (
        <div className="browse-row">
          <select value={book} onChange={(e) => { setBook(e.target.value); setChapter(1) }}>
            {books.map((b) => (
              <option key={b.book} value={b.book}>
                {b.book}
              </option>
            ))}
          </select>
          <select value={chapter} onChange={(e) => setChapter(Number(e.target.value))}>
            {chapters.map((c) => (
              <option key={c} value={c}>
                Ch. {c}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="verse-list">
        {verses.length === 0 && <div className="empty-note">No verses. Try another search.</div>}
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
        <button className="btn btn-primary" onClick={() => addSelected(false)} disabled={verses.length === 0}>
          Add {selectedVerses.length ? `${selectedVerses.length} verse${selectedVerses.length > 1 ? 's' : ''}` : 'all'}
        </button>
        <button
          className="btn"
          onClick={() => addSelected(true)}
          disabled={verses.length === 0}
          title={outputOpen ? 'Add and show now' : 'Add and go live (opens on next Go Live)'}
        >
          Add &amp; Present
        </button>
      </div>
      <div className="source-hint">Translation: {bible.name} · double-click a verse to present it instantly</div>
    </div>
  )
}
