import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { psalmSlides, type PsalmLang } from '../slides'
import { Icon } from '../../shared/Icon'
import type { PsalmVerse } from '@shared/types'

const CHAPTERS = Array.from({ length: 150 }, (_, i) => i + 1)

/**
 * Psalms library source — pulls the bilingual (Telugu + English) psalter from
 * the grey-gratis-ice backend (a whole chapter, or a verse range) and adds the
 * chosen verses to the service as scripture slides.
 */
export function PsalmsSource(): JSX.Element {
  const addItem = useStore((s) => s.addItem)

  const [chapter, setChapter] = useState(23)
  const [rangeOn, setRangeOn] = useState(false)
  const [start, setStart] = useState(1)
  const [end, setEnd] = useState(5)
  const [lang, setLang] = useState<PsalmLang>('both')
  const [verses, setVerses] = useState<PsalmVerse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    setSelected(new Set())
    const useRange = rangeOn && start <= end
    const res = await window.lumen.psalms(chapter, useRange ? start : undefined, useRange ? end : undefined)
    if (Array.isArray(res)) setVerses(res)
    else {
      setVerses([])
      setError(res?.error ?? 'Failed to load psalm')
    }
    setLoading(false)
  }, [chapter, rangeOn, start, end])

  // Auto-load on chapter change or toggling range mode; range edits reload via Go.
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, rangeOn])

  const toggle = (id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedVerses = verses.filter((v) => selected.has(v.id))

  const add = (goLive: boolean): void => {
    const toAdd = selectedVerses.length ? selectedVerses : verses
    if (!toAdd.length) return
    const title =
      toAdd.length === 1
        ? `Psalm ${toAdd[0].chapter}:${toAdd[0].verse}`
        : `Psalm ${toAdd[0].chapter}:${toAdd[0].verse}–${toAdd[toAdd.length - 1].verse}`
    addItem({ title, kind: 'scripture', slides: psalmSlides(toAdd, lang) }, goLive)
    setSelected(new Set())
  }

  const presentOne = (v: PsalmVerse): void => {
    addItem({ title: `Psalm ${v.chapter}:${v.verse}`, kind: 'scripture', slides: psalmSlides([v], lang) }, true)
  }

  const textOf = (v: PsalmVerse): string =>
    lang === 'telugu' ? v.telugu : lang === 'english' ? v.english : `${v.telugu}\n${v.english}`

  return (
    <div className="source psalms-source">
      <div className="browse-row">
        <select value={chapter} onChange={(e) => setChapter(Number(e.target.value))} title="Psalm chapter">
          {CHAPTERS.map((c) => (
            <option key={c} value={c}>
              Psalm {c}
            </option>
          ))}
        </select>
        <select value={lang} onChange={(e) => setLang(e.target.value as PsalmLang)} title="Language">
          <option value="both">తెలుగు + English</option>
          <option value="telugu">తెలుగు only</option>
          <option value="english">English only</option>
        </select>
      </div>

      <div className="psalm-range">
        <label className="chk">
          <input type="checkbox" checked={rangeOn} onChange={(e) => setRangeOn(e.target.checked)} />
          Verse range
        </label>
        {rangeOn && (
          <div className="psalm-range-inputs">
            <input
              type="number"
              min={1}
              value={start}
              onChange={(e) => setStart(Math.max(1, Number(e.target.value) || 1))}
              title="From verse"
            />
            <span>–</span>
            <input
              type="number"
              min={1}
              value={end}
              onChange={(e) => setEnd(Math.max(1, Number(e.target.value) || 1))}
              title="To verse"
            />
            <button className="btn tiny with-ico" onClick={() => void load()} title="Load this range">
              <Icon name="refresh" /> Go
            </button>
          </div>
        )}
      </div>

      <div className="verse-list">
        {loading && <div className="empty-note">Loading Psalm {chapter}… (first load can take a moment)</div>}
        {!loading && error && (
          <div className="empty-note">
            {error} <button className="btn tiny" onClick={() => void load()}>Retry</button>
          </div>
        )}
        {!loading && !error && verses.length === 0 && <div className="empty-note">No verses.</div>}
        {verses.map((v) => {
          const ref = `Psalm ${v.chapter}:${v.verse}`
          return (
            <div
              key={v.id}
              className={`verse-item ${selected.has(v.id) ? 'selected' : ''}`}
              onClick={() => toggle(v.id)}
              onDoubleClick={() => presentOne(v)}
              title="Click to select · double-click to present now"
            >
              <div className="verse-ref">{ref}</div>
              <div className="verse-text psalm-text">{textOf(v)}</div>
            </div>
          )
        })}
      </div>

      <div className="source-actions">
        <button className="btn btn-primary" onClick={() => add(false)} disabled={loading || verses.length === 0}>
          Add {selectedVerses.length ? `${selectedVerses.length} verse${selectedVerses.length > 1 ? 's' : ''}` : 'all'}
        </button>
        <button className="btn" onClick={() => add(true)} disabled={loading || verses.length === 0}>
          Add &amp; Present
        </button>
      </div>
      <div className="source-hint">Bilingual psalter · double-click a verse to present it instantly</div>
    </div>
  )
}
