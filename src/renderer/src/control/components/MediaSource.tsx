import { useState } from 'react'
import type { Background, MediaFile } from '@shared/types'
import { useStore } from '../../store/useStore'
import { mediaSlide, pptxSlides } from '../slides'

const PRESET_COLORS = ['#0b1020', '#000000', '#101826', '#1b1035', '#0d2818', '#2a0d0d', '#243b53']

export function MediaSource(): JSX.Element {
  const media = useStore((s) => s.media)
  const importMedia = useStore((s) => s.importMedia)
  const importPptx = useStore((s) => s.importPptx)
  const addSlides = useStore((s) => s.addSlides)
  const setBackground = useStore((s) => s.setBackground)
  const background = useStore((s) => s.background)

  const [pptxNote, setPptxNote] = useState('')

  const asBackground = (m: MediaFile): void => {
    const bg: Background = { type: m.isVideo ? 'video' : 'image', value: m.url, fit: 'cover' }
    setBackground(bg)
  }

  const addAsSlide = (m: MediaFile): void => {
    addSlides([mediaSlide(m.url, m.name, m.isVideo)])
  }

  const importFromPptx = async (): Promise<void> => {
    setPptxNote('Importing…')
    const decks = await importPptx()
    if (!decks.length) return setPptxNote('') // dialog canceled
    const slides = decks.flatMap(pptxSlides)
    if (!slides.length) return setPptxNote('No slides found in that file.')
    addSlides(slides)
    const from = decks.length === 1 ? decks[0].name : `${decks.length} files`
    setPptxNote(`Added ${slides.length} slide${slides.length === 1 ? '' : 's'} from ${from}.`)
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

      <div className="section-label">Stage background color</div>
      <div className="color-row">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${background.type === 'color' && background.value === c ? 'active' : ''}`}
            style={{ background: c }}
            title={c}
            onClick={() => setBackground({ type: 'color', value: c })}
          />
        ))}
        <label className="swatch custom" title="Custom color">
          <input
            type="color"
            value={background.type === 'color' ? background.value : '#000000'}
            onChange={(e) => setBackground({ type: 'color', value: e.target.value })}
          />
        </label>
      </div>

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
              {m.isVideo && <span className="badge">▶</span>}
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
