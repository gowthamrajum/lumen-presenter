import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { detectRecurringSection } from '../songArrange'
import { BACKGROUND_PRESETS } from '../presets'
import { Icon } from '../../shared/Icon'
import type { Background, Song } from '@shared/types'

export interface AddSongChoice {
  /** included section ids, in the presenter's chosen play order */
  includedIds: string[]
  recurringId: string | null
  /** null = keep the current/global background */
  background: Background | null
}

function swatchStyle(bg: Background): CSSProperties {
  if (bg.type === 'color' || bg.type === 'gradient') return { background: bg.value }
  return { background: '#111' } // image/video render a real preview element instead
}

/**
 * Shown when adding a song: choose which stanzas to present, reorder them, pick
 * which part recurs after each stanza (auto-detected), and a background (default
 * = the current one). The order the presenter arranges here is the play order.
 */
export function SongStructureDialog({
  song,
  currentBackground,
  onCancel,
  onConfirm
}: {
  song: Song
  currentBackground: Background
  onCancel: () => void
  onConfirm: (choice: AddSongChoice) => void
}): JSX.Element {
  // The full section order (reorderable). `included` decides which of these play.
  const [order, setOrder] = useState<string[]>(() => song.sections.map((s) => s.id))
  const [included, setIncluded] = useState<Set<string>>(() => new Set(song.sections.map((s) => s.id)))
  const [recurring, setRecurring] = useState<string | null>(null)
  const [bgId, setBgId] = useState<string>('default') // 'default' | preset id

  useEffect(() => {
    setOrder(song.sections.map((s) => s.id))
    setIncluded(new Set(song.sections.map((s) => s.id)))
    setRecurring(detectRecurringSection(song))
    setBgId('default')
  }, [song])

  const byId = useMemo(() => new Map(song.sections.map((s) => [s.id, s])), [song])

  const firstLine = (id: string): string => {
    const sec = byId.get(id)
    const l = sec?.lines.find((x) => x.trim().length > 0) ?? ''
    return l.length > 40 ? `${l.slice(0, 40)}…` : l
  }

  const toggleInclude = (id: string): void => {
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (recurring === id) setRecurring(null) // can't repeat a section you dropped
      } else {
        next.add(id)
      }
      return next
    })
  }

  const move = (id: string, dir: -1 | 1): void =>
    setOrder((prev) => {
      const i = prev.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const background = useMemo<Background | null>(
    () => (bgId === 'default' ? null : BACKGROUND_PRESETS.find((p) => p.id === bgId)?.background ?? null),
    [bgId]
  )

  // Included sections in the arranged order — this is what gets played.
  const includedInOrder = order.filter((id) => included.has(id))
  const canAdd = includedInOrder.length > 0

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal add-song" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Add “{song.title || 'Song'}”</h2>
          <button className="modal-close" onClick={onCancel} title="Cancel">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <div className="ss-sub">Stanzas — reorder and tick to include; pick one to repeat after each stanza</div>
          <label className={`ss-row norepeat ${recurring === null ? 'active' : ''}`}>
            <span className="ss-reorder-spacer" />
            <span className="ss-inc-spacer" />
            <div className="ss-text">
              <div className="ss-label">Don’t repeat any section</div>
            </div>
            <input
              type="radio"
              name="recurring"
              className="ss-repeat"
              checked={recurring === null}
              onChange={() => setRecurring(null)}
              title="No repeat"
            />
          </label>

          {order.map((id, idx) => {
            const sec = byId.get(id)
            if (!sec) return null
            const inc = included.has(id)
            return (
              <div key={id} className={`ss-row ${recurring === id ? 'active' : ''} ${inc ? '' : 'off'}`}>
                <span className="ss-reorder">
                  <button
                    className="ss-move icon-btn"
                    onClick={() => move(id, -1)}
                    disabled={idx === 0}
                    title="Move up"
                  >
                    <Icon name="chevron-up" />
                  </button>
                  <button
                    className="ss-move icon-btn"
                    onClick={() => move(id, 1)}
                    disabled={idx === order.length - 1}
                    title="Move down"
                  >
                    <Icon name="chevron-down" />
                  </button>
                </span>
                <input type="checkbox" className="ss-inc" checked={inc} onChange={() => toggleInclude(id)} title="Include this stanza" />
                <div className="ss-text">
                  <div className="ss-label">{sec.label}</div>
                  <div className="ss-preview">{firstLine(id) || '—'}</div>
                </div>
                <input
                  type="radio"
                  name="recurring"
                  className="ss-repeat"
                  checked={recurring === id}
                  disabled={!inc}
                  onChange={() => setRecurring(id)}
                  title="Repeat this after each stanza"
                />
              </div>
            )
          })}

          <div className="ss-sub ss-bg-head">Background</div>
          <div className="ss-swatches">
            <button
              className={`ss-swatch ${bgId === 'default' ? 'active' : ''}`}
              style={swatchStyle(currentBackground)}
              onClick={() => setBgId('default')}
              title="Keep the current background"
            >
              {currentBackground.type === 'image' && (
                <img className="ss-swatch-media" src={currentBackground.value} alt="" draggable={false} />
              )}
              {currentBackground.type === 'video' && (
                <video className="ss-swatch-media" src={currentBackground.value} muted playsInline />
              )}
              <span className="ss-swatch-tag">Default</span>
            </button>
            {BACKGROUND_PRESETS.map((p) => (
              <button
                key={p.id}
                className={`ss-swatch ${bgId === p.id ? 'active' : ''}`}
                style={swatchStyle(p.background)}
                onClick={() => setBgId(p.id)}
                title={p.name}
              />
            ))}
          </div>
        </div>
        <div className="modal-foot">
          {!canAdd && <span className="modal-error">Pick at least one stanza</span>}
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!canAdd}
            onClick={() => onConfirm({ includedIds: includedInOrder, recurringId: recurring, background })}
          >
            Add song
          </button>
        </div>
      </div>
    </div>
  )
}
