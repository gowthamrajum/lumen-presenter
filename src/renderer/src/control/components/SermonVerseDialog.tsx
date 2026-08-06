import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bible, referenceOf, compactVerses, type BibleVerse } from '@shared/bible'
import { useStore } from '../../store/useStore'
import { bilingualScriptureSlides, type PsalmLang } from '../slides'
import { LangToggle } from './LangToggle'
import { BibleSearchBox, VerseList, explainNoMatch, useRomanNames } from './BibleSearch'
import { Icon } from '../../shared/Icon'

/**
 * Verses during the sermon, at the speed they get quoted.
 *
 * A preacher names a reference and the next one a minute later. Going to the
 * Library, finding the Bible tab, searching and adding — each time, and each
 * time landing a new section in the schedule — is too slow to keep up and
 * leaves the order littered with one-verse items by the end.
 *
 * So: type the reference, press Enter, it is on the screen. The box clears and
 * keeps the focus, ready for the next one, and every verse is appended to the
 * sermon itself rather than becoming its own item.
 */
export function SermonVerseDialog({
  itemId,
  itemTitle,
  onClose
}: {
  itemId: string
  itemTitle: string
  onClose: () => void
}): JSX.Element {
  const appendSlides = useStore((s) => s.appendSlides)

  const [telugu, setTelugu] = useState<Bible | null>(null)
  const [web, setWeb] = useState<Bible | null>(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState<PsalmLang>('both')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /** what this sitting has put on the screen, newest first */
  const [added, setAdded] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([window.lumen.loadTranslation('telugu'), window.lumen.loadTranslation('web')])
      .then(([te, en]) => {
        if (cancelled) return
        setTelugu(te ? new Bible(te) : null)
        setWeb(en ? new Bible(en) : null)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  // The dialog is opened to type into, so the box takes the focus immediately —
  // and again once the bibles land, because an operator who started typing
  // before then would otherwise be typing into a box that had lost it.
  useEffect(() => {
    inputRef.current?.focus()
  }, [loading])

  const primary = lang === 'english' ? web : telugu
  const teOf = (v: BibleVerse): string => telugu?.verse(v.book, v.chapter, v.verse)?.text ?? ''
  const enOf = (v: BibleVerse): string => web?.verse(v.book, v.chapter, v.verse)?.text ?? ''
  const refOf = (v: BibleVerse): string => primary?.reference(v) ?? referenceOf(v)
  const keyOf = (v: BibleVerse): string => referenceOf(v)
  const previewOf = (v: BibleVerse): string => {
    const te = teOf(v)
    const en = enOf(v)
    return lang === 'telugu' ? te : lang === 'english' ? en : [te, en].filter(Boolean).join('\n')
  }

  const books = useMemo(() => primary?.books() ?? [], [primary])
  const romanNames = useRomanNames(telugu)

  // `search` resolves a reference ("John 3", "John 3:16", "John 3:16-18") and
  // falls back to matching the text — the same call the Bible panel makes.
  const verses = useMemo(
    () => (primary && query.trim() ? primary.search(query) : []),
    [primary, query]
  )
  const selectedVerses = verses.filter((v) => selected.has(keyOf(v)))
  const toggle = (v: BibleVerse): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      const k = keyOf(v)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const titleOf = (list: BibleVerse[]): string => {
    if (!list.length) return ''
    if (list.length === 1) return refOf(list[0])
    const sameChapter = list.every((v) => v.book === list[0].book && v.chapter === list[0].chapter)
    if (sameChapter) return `${refOf(list[0]).replace(/:\d+$/, '')}:${compactVerses(list.map((v) => v.verse))}`
    return `${refOf(list[0])}–${refOf(list[list.length - 1])}`
  }

  /** Whatever is ticked, or the whole result when nothing is — the same rule the
   *  Bible panel's Add button follows. */
  const add = (list: BibleVerse[] = selectedVerses.length ? selectedVerses : verses): void => {
    if (!list.length) return
    // Each verse holds its minute and then moves on WITHIN the sermon: the next
    // verse of the passage, and from the last one back to the sermon card. The
    // operator can add time or stop it from the Live panel.
    const slides = bilingualScriptureSlides(list, lang, teOf, enOf, refOf).map((sl) => ({
      ...sl,
      autoAdvance: true,
      // On the air even though the sermon card is not. The card is a heading and
      // stays off the stream; the verse is the one thing from the sermon a
      // viewer at home is relying on, and it inherits the card's silence unless
      // it says otherwise.
      broadcastUsers: true,
      broadcastStream: true
    }))
    appendSlides(itemId, slides, true)
    setAdded((a) => [titleOf(list), ...a])
    setQuery('')
    setSelected(new Set())
    inputRef.current?.focus()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal verse-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Add a verse to ${itemTitle}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Add a verse to {itemTitle}</h2>
          <button className="modal-close" onClick={onClose} title="Close (Esc)">
            <Icon name="close" />
          </button>
        </div>

        <div className="modal-body">
          <div className="lang-row">
            <LangToggle value={lang} onChange={(l) => setLang(l as PsalmLang)} />
          </div>
          {/* The same box and the same list as the Library's Bible source: Down
              walks the books, "kee" finds Keerthanalu, a verse can be ticked or
              double-clicked. Anything else and the two would drift. */}
          <div onKeyDown={(e) => e.key === 'Escape' && !e.defaultPrevented && onClose()}>
            <BibleSearchBox
              value={query}
              onChange={(v) => {
                setQuery(v)
                setSelected(new Set())
              }}
              onSubmit={() => add()}
              books={books}
              romanNames={romanNames}
              placeholder={loading ? 'Opening the bibles…' : 'John 3:16 · Rom 8:1-4 · kee 23 · యోహాను 3'}
              inputRef={inputRef}
              autoFocus
            />
          </div>

          {verses.length > 0 && (
            <div className="verse-preview-head">
              <b>{titleOf(selectedVerses.length ? selectedVerses : verses)}</b>
              <span className="verse-count">
                {selectedVerses.length
                  ? `${selectedVerses.length} selected — Enter shows those`
                  : `${verses.length} verse${verses.length === 1 ? '' : 's'} — Enter shows them all`}
              </span>
            </div>
          )}
          <VerseList
            verses={verses}
            selected={selected}
            onToggle={toggle}
            onPresent={(v) => add([v])}
            refOf={refOf}
            previewOf={previewOf}
            loading={loading}
            emptyNote={explainNoMatch(primary, query)}
          />

          {added.length > 0 && (
            <div className="verse-added">
              <span className="verse-added-label">Added to {itemTitle}</span>
              {added.map((a, i) => (
                <span key={`${a}-${i}`} className="verse-chip">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <span className="verse-hint">Enter shows it and clears the box for the next one.</span>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
