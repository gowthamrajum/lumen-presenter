import { useStore } from '../../store/useStore'
import { SlideThumb } from './SlideThumb'
import { blankSlide } from '../slides'
import type { ItemKind } from '@shared/types'

const KIND_ICON: Record<ItemKind, string> = {
  scripture: '✝',
  song: '♪',
  text: '¶',
  media: '🖼',
  video: '▶',
  ppt: '▤',
  blank: '⬛',
  countdown: '⏱'
}

export function ServiceView(): JSX.Element {
  const items = useStore((s) => s.items)
  const liveId = useStore((s) => s.liveId)
  const serviceName = useStore((s) => s.serviceName)
  const clearService = useStore((s) => s.clearService)
  const removeItem = useStore((s) => s.removeItem)
  const moveItem = useStore((s) => s.moveItem)
  const duplicateItem = useStore((s) => s.duplicateItem)
  const addItem = useStore((s) => s.addItem)

  const totalSlides = items.reduce((n, it) => n + it.slides.length, 0)
  let running = 0

  return (
    <div className="service">
      <div className="deck-header">
        <div className="deck-title">
          {serviceName}
          <span className="deck-count">
            {items.length} item{items.length === 1 ? '' : 's'} · {totalSlides} slide
            {totalSlides === 1 ? '' : 's'}
          </span>
        </div>
        <div className="deck-header-actions">
          <button
            className="btn tiny"
            onClick={() => addItem({ title: 'Blank', kind: 'blank', slides: [blankSlide('#000000')] })}
          >
            + Blank
          </button>
          <button className="btn tiny" onClick={clearService} disabled={items.length === 0}>
            Clear
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="deck-empty">
          <div className="deck-empty-icon">✦</div>
          <h2>This service is empty</h2>
          <p>
            Add scripture, media, PowerPoint, or text from the left — each becomes an item in your
            service. Click a slide to send it live and use the arrow keys to advance. Save the
            service from the <b>Services</b> tab so it&apos;s ready next Sunday.
          </p>
        </div>
      ) : (
        <div className="items">
          {items.map((it, idx) => {
            const start = running
            running += it.slides.length
            return (
              <div key={it.id} className="item">
                <div className="item-head">
                  <span className={`item-icon kind-${it.kind}`}>{KIND_ICON[it.kind]}</span>
                  <span className="item-title" title={it.title}>
                    {it.title}
                  </span>
                  <span className="item-count">{it.slides.length}</span>
                  <button
                    className="item-btn"
                    title="Move up"
                    onClick={() => moveItem(it.id, -1)}
                    disabled={idx === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="item-btn"
                    title="Move down"
                    onClick={() => moveItem(it.id, 1)}
                    disabled={idx === items.length - 1}
                  >
                    ↓
                  </button>
                  <button className="item-btn" title="Duplicate item" onClick={() => duplicateItem(it.id)}>
                    ⧉
                  </button>
                  <button
                    className="item-remove"
                    title="Remove this item"
                    onClick={() => removeItem(it.id)}
                  >
                    ×
                  </button>
                </div>
                <div className="item-grid">
                  {it.slides.map((sl, i) => (
                    <SlideThumb key={sl.id} slide={sl} index={start + i} live={sl.id === liveId} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
