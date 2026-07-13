import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useStore, uid } from '../../store/useStore'
import { composeFromLines, ensureComposerFont, COMPOSE_W, COMPOSE_H } from '../compose'
import type { Background, ComposedLine } from '@shared/types'

const FONT = "'Anek Telugu', sans-serif"

export function SlideComposer(): JSX.Element | null {
  const composerSlideId = useStore((s) => s.composerSlideId)
  const items = useStore((s) => s.items)
  const setComposed = useStore((s) => s.setComposed)
  const setSlideBackground = useStore((s) => s.setSlideBackground)
  const closeComposer = useStore((s) => s.closeComposer)
  const globalBg = useStore((s) => s.background)

  const slide = composerSlideId
    ? items.flatMap((i) => i.slides).find((s) => s.id === composerSlideId)
    : null

  const [lines, setLines] = useState<ComposedLine[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [editMode, setEditMode] = useState<'line' | 'stanza'>('stanza')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bg, setBg] = useState<Background>({ type: 'color', value: '#0b1020' })
  const [scale, setScale] = useState(1)

  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const drag = useRef<{ startX: number; startY: number; init: Record<string, { x: number; y: number }> } | null>(null)

  // (re)initialise when a slide opens
  useEffect(() => {
    if (!slide) return
    setBg(slide.background ?? globalBg)
    setSelected([])
    setEditingId(null)
    let cancelled = false
    void ensureComposerFont().then(() => {
      if (cancelled) return
      setLines(slide.composed?.length ? slide.composed.map((l) => ({ ...l })) : composeFromLines(slide.lines ?? []))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerSlideId])

  // scale the 960×540 canvas to fit the modal width
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const s = Math.min(1, e.contentRect.width / COMPOSE_W)
      scaleRef.current = s
      setScale(s)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [composerSlideId])

  // arrow-key nudge
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (editingId || !selected.length) return
      let dx = 0
      let dy = 0
      const d = e.shiftKey ? 20 : 5
      if (e.key === 'ArrowUp') dy = -d
      else if (e.key === 'ArrowDown') dy = d
      else if (e.key === 'ArrowLeft') dx = -d
      else if (e.key === 'ArrowRight') dx = d
      else return
      e.preventDefault()
      setLines((prev) => prev.map((l) => (selected.includes(l.id) ? { ...l, x: l.x + dx, y: l.y + dy } : l)))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [selected, editingId])

  if (!slide || !composerSlideId) return null

  const selectFor = (idx: number): string[] => {
    const l = lines[idx]
    if (editMode === 'stanza' && l.stanzaId) return lines.filter((x) => x.stanzaId === l.stanzaId).map((x) => x.id)
    return [l.id]
  }

  const onMouseDown = (e: ReactMouseEvent, idx: number): void => {
    const sel = selectFor(idx)
    setSelected(sel)
    const rect = innerRef.current!.getBoundingClientRect()
    const sc = scaleRef.current
    const init: Record<string, { x: number; y: number }> = {}
    lines.forEach((l) => {
      if (sel.includes(l.id)) init[l.id] = { x: l.x, y: l.y }
    })
    drag.current = { startX: (e.clientX - rect.left) / sc, startY: (e.clientY - rect.top) / sc, init }
  }
  const onMouseMove = (e: ReactMouseEvent): void => {
    if (!drag.current) return
    const rect = innerRef.current!.getBoundingClientRect()
    const sc = scaleRef.current
    const dx = (e.clientX - rect.left) / sc - drag.current.startX
    const dy = (e.clientY - rect.top) / sc - drag.current.startY
    setLines((prev) =>
      prev.map((l) => {
        const i = drag.current!.init[l.id]
        return i ? { ...l, x: i.x + dx, y: i.y + dy } : l
      })
    )
  }
  const onMouseUp = (): void => {
    drag.current = null
  }

  const patchSel = (patch: Partial<ComposedLine>): void =>
    setLines((prev) => prev.map((l) => (selected.includes(l.id) ? { ...l, ...patch } : l)))
  const changeFont = (delta: number): void =>
    setLines((prev) =>
      prev.map((l) =>
        selected.includes(l.id) ? { ...l, fontSize: Math.max(12, Math.min(220, l.fontSize + delta)) } : l
      )
    )
  const addLine = (): void => {
    const nl: ComposedLine = { id: uid(), text: 'New line', x: COMPOSE_W / 2, y: COMPOSE_H / 2, fontSize: 40, align: 'center', stanzaId: null }
    setLines((p) => [...p, nl])
    setSelected([nl.id])
  }
  const deleteSel = (): void => {
    setLines((p) => p.filter((l) => !selected.includes(l.id)))
    setSelected([])
  }
  const save = (): void => {
    setComposed(slide.id, lines)
    setSlideBackground(slide.id, bg)
    closeComposer()
  }

  const first = lines.find((l) => l.id === selected[0])
  const bgStyle =
    bg.type === 'color' || bg.type === 'gradient'
      ? { background: bg.value }
      : { background: '#000' }

  return (
    <div className="modal-backdrop" onClick={closeComposer}>
      <div className="modal composer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Slide Composer</h2>
          <button className="modal-close" onClick={closeComposer} title="Close">
            ×
          </button>
        </div>

        <div className="composer-toolbar">
          <div className="seg">
            {(['line', 'stanza'] as const).map((m) => (
              <button key={m} className={`seg-btn ${editMode === m ? 'active' : ''}`} onClick={() => setEditMode(m)}>
                {m === 'line' ? 'Line' : 'Stanza'}
              </button>
            ))}
          </div>
          <button className="btn tiny" onClick={() => changeFont(-3)} disabled={!selected.length} title="Smaller">
            A−
          </button>
          <button className="btn tiny" onClick={() => changeFont(3)} disabled={!selected.length} title="Larger">
            A+
          </button>
          <label className="cmp-color" title="Text color">
            Text
            <input
              type="color"
              value={first?.color ?? '#ffffff'}
              onChange={(e) => patchSel({ color: e.target.value })}
              disabled={!selected.length}
            />
          </label>
          <label className="cmp-color" title="Background color">
            BG
            <input
              type="color"
              value={bg.type === 'color' ? bg.value : '#0b1020'}
              onChange={(e) => setBg({ type: 'color', value: e.target.value })}
            />
          </label>
          <button className="btn tiny" onClick={addLine}>
            + Line
          </button>
          <button className="btn tiny" onClick={deleteSel} disabled={!selected.length}>
            Delete
          </button>
          <span className="cmp-hint">Drag to move · double-click to edit · arrows nudge</span>
        </div>

        <div className="modal-body composer-body">
          <div className="composer-stage" ref={outerRef} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
            <div className="composer-scale" style={{ width: COMPOSE_W * scale, height: COMPOSE_H * scale }}>
              <div
                ref={innerRef}
                className="composer-canvas"
                style={{ width: COMPOSE_W, height: COMPOSE_H, transform: `scale(${scale})`, ...bgStyle }}
                onMouseDown={() => {
                  if (!drag.current) setSelected([])
                }}
              >
                {bg.type === 'image' && (
                  <img className="composer-bg" src={bg.value} alt="" draggable={false} />
                )}
                {lines.map((l, idx) => (
                  <div
                    key={l.id}
                    className={`composer-line ${selected.includes(l.id) ? 'sel' : ''}`}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      onMouseDown(e, idx)
                    }}
                    onDoubleClick={() => setEditingId(l.id)}
                    style={{
                      left: `${l.x}px`,
                      top: `${l.y}px`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${l.fontSize}px`,
                      color: l.color || '#ffffff',
                      fontFamily: FONT,
                      textAlign: l.align || 'center'
                    }}
                  >
                    {editingId === l.id ? (
                      <textarea
                        autoFocus
                        className="composer-edit"
                        value={l.text}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, text: e.target.value } : x)))
                        }
                        onBlur={() => setEditingId(null)}
                        style={{ fontSize: `${l.fontSize}px`, fontFamily: FONT }}
                      />
                    ) : (
                      l.text
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <span className="cmp-count">{lines.length} lines</span>
          <button className="btn" onClick={closeComposer}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save layout
          </button>
        </div>
      </div>
    </div>
  )
}
