import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bible, referenceOf, compactVerses, type BibleVerse } from '@shared/bible'
import { useStore } from '../../store/useStore'
import { bilingualScriptureSlides, type PsalmLang } from '../slides'
import { LangToggle } from './LangToggle'
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

  // `search` resolves a reference ("John 3", "John 3:16", "John 3:16-18") and
  // falls back to matching the text, which is the same thing the Bible panel
  // types into — one box, no book picker to walk.
  const verses = useMemo(
    () => (primary && query.trim() ? primary.search(query) : []),
    [primary, query]
  )

  const titleOf = (list: BibleVerse[]): string => {
    if (!list.length) return ''
    if (list.length === 1) return refOf(list[0])
    const sameChapter = list.every((v) => v.book === list[0].book && v.chapter === list[0].chapter)
    if (sameChapter) return `${refOf(list[0]).replace(/:\d+$/, '')}:${compactVerses(list.map((v) => v.verse))}`
    return `${refOf(list[0])}–${refOf(list[list.length - 1])}`
  }

  const add = (): void => {
    if (!verses.length) return
    // No autoAdvance: a sermon verse stays up for as long as it is being
    // preached on, which is not something a timer can know.
    appendSlides(itemId, bilingualScriptureSlides(verses, lang, teOf, enOf, refOf), true)
    setAdded((a) => [titleOf(verses), ...a])
    setQuery('')
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
          <input
            ref={inputRef}
            className="search verse-search"
            placeholder={loading ? 'Opening the bibles…' : 'John 3:16   ·   Rom 8:1-4   ·   యోహాను 3'}
            value={query}
            // Never disabled: the operator types the reference the moment they
            // hear it, and the bibles land in their own time — the preview just
            // fills in when they do.
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
          />

          <div className="verse-preview">
            {query.trim() && verses.length === 0 && (
              <div className="empty-note">Nothing found for “{query.trim()}”.</div>
            )}
            {verses.length > 0 && (
              <>
                <div className="verse-preview-head">
                  <b>{titleOf(verses)}</b>
                  <span className="verse-count">
                    {verses.length} verse{verses.length === 1 ? '' : 's'} — press Enter to show it
                  </span>
                </div>
                {verses.slice(0, 4).map((v) => (
                  <div key={referenceOf(v)} className="verse-preview-line">
                    <span className="verse-ref">{refOf(v)}</span>
                    <span className="verse-text">
                      {lang === 'english' ? enOf(v) : teOf(v) || enOf(v)}
                    </span>
                  </div>
                ))}
                {verses.length > 4 && <div className="verse-more">…and {verses.length - 4} more</div>}
              </>
            )}
          </div>

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
