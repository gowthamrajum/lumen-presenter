import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store/useStore'
import { makeOutline, pointsOf, readOutline, sectionsOf } from '../outline'
import { Icon } from '../../shared/Icon'

/**
 * The sermon's outline — its title and the preacher's points, one per line, on
 * one slide or split across a few.
 *
 * A long outline on one slide shrinks until it can't be read, so the points are
 * written slide by slide: a box per slide, and "Add a slide" for the next
 * section. They go into the sermon together, straight after the card, and a
 * verse quoted during the sermon comes back to whichever was up. Opening this on
 * a sermon that already has an outline edits that one: there is only one.
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
  const [bodies, setBodies] = useState<string[]>(() =>
    existing ? sectionsOf(existing).map((s) => s.join('\n')) : ['']
  )
  /** The box to focus next: the first on opening, a new one once added. */
  const [focusAt, setFocusAt] = useState(0)
  const boxes = useRef<(HTMLTextAreaElement | null)[]>([])
  const outline = makeOutline(title, bodies.map(pointsOf))

  useEffect(() => {
    boxes.current[focusAt]?.focus()
  }, [focusAt, bodies.length])

  const save = (show: boolean): void => {
    if (!outline) return
    setOutline(itemId, outline)
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

  const addSlide = (): void => {
    setBodies((b) => [...b, ''])
    setFocusAt(bodies.length)
  }
  const removeSlide = (i: number): void => {
    setBodies((b) => b.filter((_, j) => j !== i))
    setFocusAt(Math.max(0, i - 1))
  }

  const many = bodies.length > 1

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
          {bodies.map((body, i) => (
            <label key={i} className="outline-field">
              <span className="outline-slide-head">
                {many ? `Slide ${i + 1} — points, one per line` : 'Points — one per line'}
                {many && (
                  <button
                    type="button"
                    className="btn tiny"
                    onClick={(e) => {
                      e.preventDefault()
                      removeSlide(i)
                    }}
                    title={`Remove slide ${i + 1}`}
                  >
                    Remove
                  </button>
                )}
              </span>
              <textarea
                ref={(el) => {
                  boxes.current[i] = el
                }}
                value={body}
                onChange={(e) => setBodies((b) => b.map((x, j) => (j === i ? e.target.value : x)))}
                rows={many ? 5 : 8}
                placeholder={
                  i === 0
                    ? '1. He knows His sheep\n2. He leads His sheep\n3. He lays down His life'
                    : 'The next section’s points'
                }
              />
            </label>
          ))}
          <button className="btn tiny with-ico" onClick={addSlide}>
            <Icon name="plus" /> Add a slide
          </button>
          <p className="outline-note">
            A long outline reads better split up — put each section on its own slide. They go in straight after the
            sermon card, in this order. A verse added during the sermon comes back to whichever was up.
          </p>
        </div>

        <div className="modal-foot">
          {existing && (
            <button className="btn" onClick={remove}>
              Remove outline
            </button>
          )}
          <span className="verse-hint" />
          <button className="btn" onClick={() => save(true)} disabled={!outline}>
            Save &amp; show
          </button>
          <button className="btn btn-primary" onClick={() => save(false)} disabled={!outline}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
