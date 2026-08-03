import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Bible, BibleBook, BibleVerse } from '@shared/bible'
import { referenceOf } from '@shared/bible'
import { romanizeTelugu, romanMatches } from '@shared/bible/translit'

/**
 * The one Bible search box, and the one list of what it found.
 *
 * Both live here because there are two places that look verses up — the Library's
 * Bible source and the sermon's add-a-verse box — and an operator who has learnt
 * that "kee" finds Keerthanalu and that Down walks the books should not discover
 * that half of it works depending on which one is open.
 */

/** Romanised Telugu book names, so every book is reachable from a Latin
 *  keyboard ("kee" → Keerthanalu, "pra" → Prasangi). Always taken from the
 *  Telugu translation, whichever language is being read. */
export function useRomanNames(telugu: Bible | null): Map<string, string> {
  return useMemo(() => {
    const m = new Map<string, string>()
    for (const b of telugu?.books() ?? []) m.set(b.book, romanizeTelugu(b.display))
    return m
  }, [telugu])
}

/** Books worth suggesting for what has been typed so far. Empty once a chapter
 *  number is present or the name is already complete — there is nothing left to
 *  offer, and a dangling suggestion swallows the Enter key. */
export function useBookSuggestions(
  query: string,
  books: BibleBook[],
  romanNames: Map<string, string>
): BibleBook[] {
  return useMemo(() => {
    const m = query.trim().match(/^(.+?)\s*(\d+\s*(?::[\d\s,-]+)?)?$/)
    const bq = m?.[1]?.trim().toLowerCase() ?? ''
    if (!bq || m?.[2]) return []
    const hits = books.filter(
      (b) =>
        b.display.toLowerCase().startsWith(bq) ||
        b.book.toLowerCase().startsWith(bq) ||
        romanMatches(romanNames.get(b.book) ?? '', bq)
    )
    if (hits.length === 1 && (hits[0].display.toLowerCase() === bq || hits[0].book.toLowerCase() === bq)) return []
    return hits.slice(0, 8)
  }, [query, books, romanNames])
}

/**
 * The search box with its book list: Down/Up walk the books, Enter takes the
 * highlighted one (leaving a trailing space to type "3:16" after it), Escape
 * puts the list away. With no list in the way a fully-typed reference is
 * complete, so Enter means `onSubmit`.
 */
export function BibleSearchBox({
  value,
  onChange,
  onSubmit,
  books,
  romanNames,
  placeholder,
  disabled,
  inputRef,
  autoFocus
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  books: BibleBook[]
  romanNames: Map<string, string>
  placeholder?: string
  disabled?: boolean
  inputRef?: RefObject<HTMLInputElement>
  autoFocus?: boolean
}): JSX.Element {
  const ownRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? ownRef
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(0)
  const all = useBookSuggestions(value, books, romanNames)
  const suggestions = open ? all : []

  useEffect(() => setActive(0), [value])
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus, disabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (b: BibleBook): void => {
    onChange(`${b.display} `) // trailing space: the chapter is typed next
    setOpen(false)
    ref.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        onSubmit()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(suggestions[Math.min(active, suggestions.length - 1)])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="search-wrap">
      <input
        ref={ref}
        className="search"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />
      {suggestions.length > 0 && (
        <div className="book-suggest" role="listbox">
          {suggestions.map((b, i) => (
            <button
              key={b.book}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`book-suggest-item ${i === active ? 'active' : ''}`}
              ref={(el) => {
                if (i === active) el?.scrollIntoView({ block: 'nearest' })
              }}
              onMouseEnter={() => setActive(i)}
              // onMouseDown (not onClick) so the pick lands before the input blurs.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(b)
              }}
            >
              <span className="book-suggest-name">{b.display}</span>
              {b.display !== b.book && <span className="book-suggest-key">{b.book}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** What the search found: click a verse to select it, double-click to put it up
 *  on its own. With nothing selected, the caller takes the whole list. */
export function VerseList({
  verses,
  selected,
  onToggle,
  onPresent,
  refOf,
  previewOf,
  loading,
  emptyNote = 'No verses. Try another search.'
}: {
  verses: BibleVerse[]
  selected: Set<string>
  onToggle: (v: BibleVerse) => void
  onPresent: (v: BibleVerse) => void
  refOf: (v: BibleVerse) => string
  previewOf: (v: BibleVerse) => string
  loading?: boolean
  emptyNote?: string
}): JSX.Element {
  return (
    <div className="verse-list">
      {loading && <div className="empty-note">Loading Telugu + English…</div>}
      {!loading && verses.length === 0 && <div className="empty-note">{emptyNote}</div>}
      {verses.map((v) => {
        const k = referenceOf(v)
        return (
          <div
            key={k}
            className={`verse-item ${selected.has(k) ? 'selected' : ''}`}
            onClick={() => onToggle(v)}
            onDoubleClick={() => onPresent(v)}
            title="Click to select · double-click to present now"
          >
            <div className="verse-ref">{refOf(v)}</div>
            <div className="verse-text psalm-text">{previewOf(v)}</div>
          </div>
        )
      })}
    </div>
  )
}
