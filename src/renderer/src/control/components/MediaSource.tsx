import { useState } from 'react'
import type { Background, MediaFile } from '@shared/types'
import { useStore } from '../../store/useStore'
import { mediaSlide, pptxSlides } from '../slides'
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
  const addItem = useStore((s) => s.addItem)
  const setBackground = useStore((s) => s.setBackground)
  const background = useStore((s) => s.background)

  const [pptxNote, setPptxNote] = useState('')
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
    const bg: Background = { type: m.isVideo ? 'video' : 'image', value: m.url, fit: 'cover' }
    setBackground(bg)
  }

  const addAsSlide = (m: MediaFile): void => {
    addItem({
      title: m.name,
      kind: m.isVideo ? 'video' : 'media',
      slides: [mediaSlide(m.url, m.name, m.isVideo)]
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

  return (
    <div className="source media-source">
      <button className="btn btn-primary full" onClick={() => void importMedia()}>
        + Add image / video…
      </button>

      <button className="btn full" onClick={() => void importFromPptx()}>
        + Import PowerPoint (.pptx)…
      </button>
      {pptxNote && <div className="empty-note">{pptxNote}</div>}

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
      {media.length === 0 && <div className="empty-note">No media yet. Add images or videos above.</div>}
      <div className="media-grid">
        {media.map((m) => (
          <div key={m.path} className="media-tile" title={m.name}>
            <div className="media-thumb">
              {m.isVideo ? (
                <video src={m.url} muted />
              ) : (
                <img src={m.url} alt={m.name} />
              )}
              {m.isVideo && <span className="badge"><Icon name="play" /></span>}
            </div>
            <div className="media-name">{m.name}</div>
            <div className="media-actions">
              <button className="btn tiny" onClick={() => asBackground(m)} title="Use as stage background">
                Background
              </button>
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
