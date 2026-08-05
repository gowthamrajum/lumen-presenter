import { useState } from 'react'
import type { Background, MediaFile } from '@shared/types'
import { useStore } from '../../store/useStore'
import { mediaSlide, pptxSlides } from '../slides'
import { renderPdfDeck } from '../pdf'
import { BACKGROUND_PRESETS, BACKGROUND_CATEGORIES } from '../presets'
import { Icon } from '../../shared/Icon'

// Presets grouped into their categories, in display order (empty groups dropped).
const BG_GROUPS = BACKGROUND_CATEGORIES.map((cat) => ({
  cat,
  presets: BACKGROUND_PRESETS.filter((p) => p.category === cat)
})).filter((g) => g.presets.length > 0)

const swatchBg = (bg: Background): React.CSSProperties =>
  bg.type === 'image'
    ? { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: bg.value }

export function MediaSource(): JSX.Element {
  const media = useStore((s) => s.media)
  const importMedia = useStore((s) => s.importMedia)
  const importPptx = useStore((s) => s.importPptx)
  const importPdf = useStore((s) => s.importPdf)
  const addItem = useStore((s) => s.addItem)
  const setBackground = useStore((s) => s.setBackground)
  const background = useStore((s) => s.background)

  const [pptxNote, setPptxNote] = useState('')
  const [pdfNote, setPdfNote] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  // Which background categories are collapsed (persisted). All start collapsed.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('bg-cat-collapsed')
      if (s) return new Set(JSON.parse(s) as string[])
    } catch {
      /* ignore */
    }
    return new Set(BACKGROUND_CATEGORIES)
  })
  const toggleCat = (c: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      try {
        localStorage.setItem('bg-cat-collapsed', JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })

  const isActiveBg = (bg: Background): boolean =>
    background.type === bg.type && background.value === bg.value

  const asBackground = (m: MediaFile): void => {
    // A sound is not a background — there is nothing to look at — so the button
    // isn't offered for one (see the row below).
    const bg: Background = { type: m.isVideo ? 'video' : 'image', value: m.url, fit: 'cover' }
    setBackground(bg)
  }

  const addAsSlide = (m: MediaFile): void => {
    addItem({
      title: m.name,
      kind: m.isVideo ? 'video' : 'media',
      slides: [mediaSlide(m.url, m.name, m.isVideo, m.isAudio)],
      // A track added as its own item is there to be HEARD: it would otherwise
      // arrive muted like a video backdrop and do nothing at all.
      sound: m.isAudio || undefined
    })
  }

  const importFromPptx = async (): Promise<void> => {
    setPptxNote('Importing…')
    const decks = await importPptx()
    if (!decks.length) return setPptxNote('') // dialog canceled
    let total = 0
    for (const d of decks) {
      const slides = pptxSlides(d)
      if (!slides.length) continue
      addItem({ title: d.name, kind: 'ppt', slides }) // one service item per file
      total += slides.length
    }
    if (!total) return setPptxNote('No slides found in that file.')
    const from = decks.length === 1 ? decks[0].name : `${decks.length} files`
    setPptxNote(`Added ${total} slide${total === 1 ? '' : 's'} from ${from}.`)
  }

  const importFromPdf = async (): Promise<void> => {
    const files = await importPdf()
    if (!files.length) return // dialog canceled
    setPdfBusy(true)
    setPdfNote('Rendering…')
    let total = 0
    let done = 0
    try {
      // Render one document at a time (a page at a time within it), so a big PDF
      // reports progress and its item lands as soon as it is ready.
      for (const file of files) {
        const multi = files.length > 1
        const deck = await renderPdfDeck(file, (p, n) =>
          setPdfNote(multi ? `Rendering ${file.name} — page ${p} of ${n}…` : `Rendering page ${p} of ${n}…`)
        )
        if (!deck.slides.length) continue
        addItem({ title: deck.name, kind: 'pdf', slides: deck.slides }) // one item per file
        total += deck.slides.length
        done += 1
      }
    } catch (err) {
      setPdfBusy(false)
      return setPdfNote(`Couldn't import that PDF: ${err instanceof Error ? err.message : String(err)}`)
    }
    setPdfBusy(false)
    if (!total) return setPdfNote('No pages found in that file.')
    const from = done === 1 ? files[0].name.replace(/\.pdf$/i, '') : `${done} files`
    setPdfNote(`Added ${total} page${total === 1 ? '' : 's'} from ${from}.`)
  }

  return (
    <div className="source media-source">
      <button className="btn btn-primary full" onClick={() => void importMedia()}>
        + Add image / video / audio…
      </button>

      <button className="btn full" onClick={() => void importFromPptx()}>
        + Import PowerPoint (.pptx)…
      </button>
      {pptxNote && <div className="empty-note">{pptxNote}</div>}

      <button className="btn full" onClick={() => void importFromPdf()} disabled={pdfBusy}>
        + Import PDF (.pdf)…
      </button>
      {pdfNote && <div className="empty-note">{pdfNote}</div>}

      <div className="section-label">Backgrounds</div>
      {BG_GROUPS.map(({ cat, presets }) => {
        const open = !collapsed.has(cat)
        return (
          <div key={cat} className={`bg-cat ${open ? 'open' : ''}`}>
            <button className="bg-cat-head" onClick={() => toggleCat(cat)} aria-expanded={open}>
              <Icon name={open ? 'chevron-down' : 'chevron-right'} />
              <span className="bg-cat-name">{cat}</span>
              <span className="bg-cat-count">{presets.length}</span>
            </button>
            {open && (
              <div className="bg-gallery">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    className={`bg-tile ${isActiveBg(p.background) ? 'active' : ''}`}
                    title={p.name}
                    onClick={() => setBackground(p.background)}
                  >
                    <span className="bg-swatch" style={swatchBg(p.background)} />
                    <span className="bg-name">{p.name}</span>
                  </button>
                ))}
                {cat === 'Neutral' && (
                  <label className="bg-tile custom" title="Custom color">
                    <span className="bg-swatch rainbow" />
                    <span className="bg-name">Custom</span>
                    <input
                      type="color"
                      value={background.type === 'color' ? background.value : '#000000'}
                      onChange={(e) => setBackground({ type: 'color', value: e.target.value })}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="section-label">Library</div>
      {media.length === 0 && <div className="empty-note">No media yet. Add images, videos or audio above.</div>}
      <div className="media-grid">
        {media.map((m) => (
          <div key={m.path} className="media-tile" title={m.name}>
            <div className="media-thumb">
              {m.isAudio ? (
                <div className="media-audio-thumb">
                  <Icon name="sound" />
                </div>
              ) : m.isVideo ? (
                <video src={m.url} muted />
              ) : (
                <img src={m.url} alt={m.name} />
              )}
              {m.isVideo && <span className="badge"><Icon name="play" /></span>}
              {m.isAudio && <span className="badge"><Icon name="sound" /></span>}
            </div>
            <div className="media-name">{m.name}</div>
            <div className="media-actions">
              {/* A sound has nothing to look at, so it cannot be a background. */}
              {!m.isAudio && (
                <button className="btn tiny" onClick={() => asBackground(m)} title="Use as stage background">
                  Background
                </button>
              )}
              <button className="btn tiny" onClick={() => addAsSlide(m)} title="Add as a slide">
                + Slide
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
