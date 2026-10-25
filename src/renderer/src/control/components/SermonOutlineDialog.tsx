import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store/useStore'
import { pointsOf, readOutline } from '../outline'
import { Icon } from '../../shared/Icon'

/**
 * The sermon's outline — its title and the preacher's points, one per line.
 *
 * It becomes one slide inside the sermon, straight after the card, and a verse
 * quoted during the sermon comes back to it when it is done. Opening this on a
 * sermon that already has one edits that one: there is only ever one outline.
 */
export function SermonOutlineDialog({
  itemId,
  itemTitle,
  onClose
}: {
  itemId: string
  itemTitle: string
  onClose: () => void
}): JSX.Element {
  const setOutline = useStore((s) => s.setOutline)
  const goLive = useStore((s) => s.goLive)
  // Read once, when the dialog opens: it is what the boxes start from.
  const [existing] = useState(() => readOutline(useStore.getState().items.find((it) => it.id === itemId)?.slides ?? []))

  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.points.join('\n') ?? '')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const points = pointsOf(body)

  useEffect(() => {
    bodyRef.current?.focus()
  }, [])

  const save = (show: boolean): void => {
    if (!points.length) return
    setOutline(itemId, { title: title.trim(), points })
    if (show) {
      const sl = useStore.getState().items.find((it) => it.id === itemId)?.slides.find((s) => s.outline)
      if (sl) goLive(sl.id)
    }
    onClose()
  }

  const remove = (): void => {
    setOutline(itemId, null)
    onClose()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal outline-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Sermon outline for ${itemTitle}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          // ⌘/Ctrl+Enter saves — Enter on its own is the next point.
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(false)
        }}
      >
        <div className="modal-head">
          <h2>{existing ? 'Edit the sermon outline' : 'Add a sermon outline'}</h2>
          <button className="modal-close" onClick={onClose} title="Close (Esc)">
            <Icon name="close" />
          </button>
        </div>

        <div className="modal-body">
          <label className="outline-field">
            <span>Sermon title (optional)</span>
            <input
              className="search"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Good Shepherd"
            />
          </label>
          <label className="outline-field">
            <span>Points — one per line</span>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder={'1. He knows His sheep\n2. He leads His sheep\n3. He lays down His life'}
            />
          </label>
          <p className="outline-note">
            One slide, straight after the sermon card. A verse added during the sermon comes back here when
            it’s done.
          </p>
        </div>

        <div className="modal-foot">
          {existing && (
            <button className="btn" onClick={remove}>
              Remove outline
            </button>
          )}
          <span className="verse-hint" />
          <button className="btn" onClick={() => save(true)} disabled={!points.length}>
            Save &amp; show
          </button>
          <button className="btn btn-primary" onClick={() => save(false)} disabled={!points.length}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
