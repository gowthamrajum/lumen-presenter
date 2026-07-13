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

  const item = items.find((i) => i.id === selectedItemId) ?? null
  const isMediaItem = item?.kind === 'video' || item?.kind === 'media'

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
          <button
            className="btn tiny with-ico slides-add-media"
            onClick={() => void attachMediaToItem(item.id)}
            title="Choose an image or video for this item"
          >
            <Icon name="image" /> Add media
          </button>
        )}
      </div>
      <div className="slides-grid">
        {item.slides.map((sl, i) => (
          <SlideThumb key={sl.id} slide={sl} index={i} live={sl.id === liveId} />
        ))}
      </div>
    </div>
  )
}
