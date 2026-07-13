import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { psalmSlides, type PsalmLang } from '../slides'
import { Icon } from '../../shared/Icon'
import { LangToggle } from './LangToggle'
import type { PsalmVerse, PsalmEnglish } from '@shared/types'

// Required ESV attribution, shown whenever ESV text is displayed (Crossway terms).
const ESV_NOTICE =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway. Used by permission. All rights reserved.'

/**
 * Psalms library source — bilingual (Telugu OV + English). The English is the
 * bundled WEBBE (offline, public domain) or the ESV fetched on demand from the
 * Crossway API (free for church use, needs a key + attribution). The language
 * toggle picks what lands on the slide: both, Telugu, or English.
 */
export function PsalmsSource(): JSX.Element {
  const addItem = useStore((s) => s.addItem)
  const addPsalm = useStore((s) => s.addPsalm)

  const [chapter, setChapter] = useState(23)
  const [chapterText, setChapterText] = useState('23')
  const [chapterError, setChapterError] = useState('')
  const [rangeOn, setRangeOn] = useState(false)
  const [start, setStart] = useState(1)
  const [end, setEnd] = useState(5)
  const [lang, setLang] = useState<PsalmLang>('both')
  const [version, setVersion] = useState<PsalmEnglish>('webbe')
  const [verses, setVerses] = useState<PsalmVerse[]>([])
  const [usedEnglish, setUsedEnglish] = useState<PsalmEnglish>('webbe')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Default to ESV when it's available (a local key or the backend proxy).
  useEffect(() => {
    void window.lumen.esvKeyStatus().then((r) => {
      if (r.hasKey) setVersion('esv')
    })
  }, [])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    setNotice('')
    setSelected(new Set())
    const useRange = rangeOn && start <= end
    const res = await window.lumen.psalms(
      chapter,
      useRange ? start : undefined,
      useRange ? end : undefined,
      version
    )
    if ('error' in res) {
      setVerses([])
      setError(res.error)
    } else {
      setVerses(res.verses)
      setUsedEnglish(res.english)
      setNotice(res.notice ?? '')
    }
    setLoading(false)
  }, [chapter, rangeOn, start, end, version])

  // Auto-load on chapter / range-toggle / version change; range edits reload via Go.
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, rangeOn, version])

  const toggle = (id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedVerses = verses.filter((v) => selected.has(v.id))
  const esvCaptions = usedEnglish === 'esv'

  const add = (goLive: boolean): void => {
    const toAdd = selectedVerses.length ? selectedVerses : verses
    if (!toAdd.length) return
    const first = toAdd[0]
    const last = toAdd[toAdd.length - 1]
    const title =
      toAdd.length === 1 ? `Psalm ${first.chapter}:${first.verse}` : `Psalm ${first.chapter}:${first.verse}–${last.verse}`
    // Reference for the Responsive-Reading heading: whole chapter → "23";
    // a range/selection → "23:1-6".
    const wholeChapter = !rangeOn && selectedVerses.length === 0
    const reference = wholeChapter
      ? `${first.chapter}`
      : `${first.chapter}:${first.verse}${toAdd.length > 1 ? `-${last.verse}` : ''}`
    addPsalm({ title, slides: psalmSlides(toAdd, lang, esvCaptions), reference }, goLive)
    setSelected(new Set())
  }

  const presentOne = (v: PsalmVerse): void => {
    addItem(
      { title: `Psalm ${v.chapter}:${v.verse}`, kind: 'scripture', slides: psalmSlides([v], lang, esvCaptions) },
      true
    )
  }

  const textOf = (v: PsalmVerse): string =>
    lang === 'telugu' ? v.telugu : lang === 'english' ? v.english : `${v.telugu}\n${v.english}`

  // Free-form chapter box: expect a whole number 1–150, flag out-of-bounds.
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
    if (n < 1 || n > 150) {
      setChapterError('Psalms are 1–150')
      return
    }
    setChapterError('')
    if (n !== chapter) setChapter(n)
  }

  return (
    <div className="source psalms-source">
      <div className="browse-row">
        <label className="chapter-field">
          <span className="chapter-field-pre">Psalm</span>
          <input
            className="search"
            type="text"
            inputMode="numeric"
            value={chapterText}
            onChange={(e) => onChapterText(e.target.value)}
            placeholder="1–150"
            aria-label="Psalm chapter number"
            title="Type a psalm number (1–150)"
          />
        </label>
      </div>
      {chapterError && <div className="chapter-error">{chapterError}</div>}

      <div className="lang-row">
        <LangToggle value={lang} onChange={(l) => setLang(l as PsalmLang)} />
      </div>

      <div className="lang-row">
        <div className="seg lang-toggle" role="radiogroup" aria-label="English version" title="English text">
          <button
            type="button"
            role="radio"
            aria-checked={version === 'webbe'}
            className={`seg-btn${version === 'webbe' ? ' active' : ''}`}
            onClick={() => setVersion('webbe')}
          >
            WEBBE
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={version === 'esv'}
            className={`seg-btn${version === 'esv' ? ' active' : ''}`}
            onClick={() => setVersion('esv')}
          >
            ESV
          </button>
        </div>
      </div>

      {notice && <div className="empty-note">{notice}</div>}

      <div className="verse-range">
        <label className="chk">
          <input type="checkbox" checked={rangeOn} onChange={(e) => setRangeOn(e.target.checked)} />
          Verse range
        </label>
        {rangeOn && (
          <div className="verse-range-inputs">
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
        {loading && <div className="empty-note">Loading Psalm {chapter}…</div>}
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

      <div className="source-hint">
        {loading ? 'Loading…' : `Showing Psalm ${chapter}${rangeOn ? ` · verses ${start}–${end}` : ''}`} ·
        double-click a verse to present it instantly
      </div>

      {usedEnglish === 'esv' && verses.length > 0 && (
        <div className="esv-attribution">
          {ESV_NOTICE}{' '}
          <a href="https://www.esv.org" target="_blank" rel="noreferrer">
            esv.org
          </a>
        </div>
      )}
    </div>
  )
}
