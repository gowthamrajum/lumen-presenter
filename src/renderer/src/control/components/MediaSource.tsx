import { useState } from 'react'
import type { Background, MediaFile } from '@shared/types'
import { useStore } from '../../store/useStore'
import { mediaSlide, pptxSlides } from '../slides'
import { BACKGROUND_PRESETS } from '../presets'
import { Icon } from '../../shared/Icon'

export function MediaSource(): JSX.Element {
  const media = useStore((s) => s.media)
  const importMedia = useStore((s) => s.importMedia)
  const importPptx = useStore((s) => s.importPptx)
  const addItem = useStore((s) => s.addItem)
  const setBackground = useStore((s) => s.setBackground)
  const background = useStore((s) => s.background)

  const [pptxNote, setPptxNote] = useState('')

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
      <div className="bg-gallery">
        {BACKGROUND_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`bg-tile ${isActiveBg(p.background) ? 'active' : ''}`}
            title={p.name}
            onClick={() => setBackground(p.background)}
          >
            <span className="bg-swatch" style={{ background: p.background.value }} />
            <span className="bg-name">{p.name}</span>
          </button>
        ))}
        <label className="bg-tile custom" title="Custom color">
          <span className="bg-swatch rainbow" />
          <span className="bg-name">Custom</span>
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
