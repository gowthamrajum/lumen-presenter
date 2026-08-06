import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { SlideThumb } from './SlideThumb'
import { SermonVerseDialog } from './SermonVerseDialog'
import { MediaTransport } from './MediaTransport'
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
  const [verseOpen, setVerseOpen] = useState(false)
  // drag-and-drop reorder within this item's slides (indices into item.slides)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const endDrag = (): void => {
    setDragIndex(null)
    setOverIndex(null)
  }

  const item = items.find((i) => i.id === selectedItemId) ?? null
  const isMediaItem = item?.kind === 'video' || item?.kind === 'media'
  // Anything with a clip or a track on it gets a transport, whatever kind the
  // item calls itself — a song slide with a backing track has one too.
  const hasPlayable = !!item?.slides.some(
    (sl) =>
      sl.background?.type === 'video' ||
      sl.background?.type === 'audio' ||
      sl.background?.type === 'youtube'
  )
  // The sermon is the one section that grows while it runs: the preacher quotes
  // a reference and it has to be on the screen before they have finished saying
  // it. Anywhere in this panel is the target, so it doesn't have to be aimed at.
  const isSermon = !!item && /sermon|వాక్యోపదేశం/i.test(item.title)

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
    <div
      className={`slides-panel ${isSermon ? 'sermon-panel' : ''}`}
      onClick={(e) => {
        // Anywhere that isn't already something: a slide, a button, the media
        // row. Those keep doing what they did.
        if (!isSermon) return
        const el = e.target as HTMLElement
        if (el.closest('.slide-thumb, button, input, .media-url-row')) return
        setVerseOpen(true)
      }}
    >
      {verseOpen && item && (
        <SermonVerseDialog itemId={item.id} itemTitle={item.title} onClose={() => setVerseOpen(false)} />
      )}
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
              title="Choose an image, video or audio file for this item"
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
            placeholder="YouTube link or https://…/welcome.mp4"
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
      {hasPlayable && item && <MediaTransport item={item} />}
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
        {/* Clicking the panel anywhere does this too — the tile is so that the
            operator knows it, and has something to aim at when they'd rather. */}
        {isSermon && (
          <button className="verse-add-tile" onClick={() => setVerseOpen(true)}>
            <Icon name="plus" />
            <span className="verse-add-title">Add a verse</span>
            <span className="verse-add-sub">Type a reference, press Enter</span>
          </button>
        )}
      </div>
    </div>
  )
}
