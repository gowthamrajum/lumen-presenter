import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { SlideThumb } from './SlideThumb'
import { Icon } from '../../shared/Icon'

/** Center panel — the slides of the currently-selected schedule item. Clicking
 *  a slide shows it live. */
export function SlidesPanel(): JSX.Element {
  const items = useStore((s) => s.items)
  const selectedItemId = useStore((s) => s.selectedItemId)
  const liveId = useStore((s) => s.liveId)
  const attachMediaToItem = useStore((s) => s.attachMediaToItem)
  const attachMediaUrlToItem = useStore((s) => s.attachMediaUrlToItem)
  const reorderSlides = useStore((s) => s.reorderSlides)

  const [urlOpen, setUrlOpen] = useState(false)
  const [urlVal, setUrlVal] = useState('')
  // drag-and-drop reorder within this item's slides (indices into item.slides)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const endDrag = (): void => {
    setDragIndex(null)
    setOverIndex(null)
  }

  const item = items.find((i) => i.id === selectedItemId) ?? null
  const isMediaItem = item?.kind === 'video' || item?.kind === 'media'

  const submitUrl = (): void => {
    if (!item) return
    const u = urlVal.trim()
    if (!/^https?:\/\//i.test(u)) return
    attachMediaUrlToItem(item.id, u)
    setUrlVal('')
    setUrlOpen(false)
  }

  if (!item) {
    return (
      <div className="slides-panel">
        <div className="slides-empty">
          <div className="slides-empty-icon">
            <Icon name="spark" />
          </div>
          <h2>No item selected</h2>
          <p>
            Pick an item from <b>Sessions</b>, or open the <b>Library</b> to add songs,
            scripture, media, or text. Click a slide to show it on the audience screen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="slides-panel">
      <div className="slides-head">
        <span className="slides-title">{item.title}</span>
        <span className="slides-sub">
          {item.slides.length} slide{item.slides.length === 1 ? '' : 's'}
        </span>
        {isMediaItem && (
          <>
            <button
              className="btn tiny with-ico slides-add-media"
              onClick={() => void attachMediaToItem(item.id)}
              title="Choose an image or video file for this item"
            >
              <Icon name="image" /> Add media
            </button>
            <button
              className="btn tiny with-ico"
              onClick={() => setUrlOpen((v) => !v)}
              title="Attach media from a web link — this also plays on the web broadcast (a local file can't)"
            >
              <Icon name="link" /> Add URL
            </button>
          </>
        )}
      </div>
      {isMediaItem && urlOpen && (
        <div className="media-url-row">
          <input
            className="search"
            placeholder="https://…/welcome.mp4"
            value={urlVal}
            onChange={(e) => setUrlVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
            autoFocus
          />
          <button className="btn tiny" onClick={submitUrl} disabled={!/^https?:\/\//i.test(urlVal.trim())}>
            Set
          </button>
        </div>
      )}
      <div className="slides-grid">
        {item.slides.map((sl, i) => (
          <SlideThumb
            key={sl.id}
            slide={sl}
            index={i}
            live={sl.id === liveId}
            dragging={dragIndex === i}
            dropTarget={overIndex === i && dragIndex !== null && dragIndex !== i}
            onDragStartSlide={() => setDragIndex(i)}
            onDragOverSlide={() => {
              if (overIndex !== i) setOverIndex(i)
            }}
            onDropSlide={() => {
              if (dragIndex !== null && dragIndex !== i) reorderSlides(item.id, dragIndex, i)
              endDrag()
            }}
            onDragEndSlide={endDrag}
          />
        ))}
      </div>
    </div>
  )
}
