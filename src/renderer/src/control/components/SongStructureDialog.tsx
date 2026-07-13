import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { detectRecurringSection } from '../songArrange'
import { BACKGROUND_PRESETS } from '../presets'
import type { Background, Song } from '@shared/types'

export interface AddSongChoice {
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
 * Shown when adding a song: choose which stanzas to present, which part recurs
 * after each stanza (auto-detected), and a background (default = the current one).
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
  const [included, setIncluded] = useState<Set<string>>(() => new Set(song.sections.map((s) => s.id)))
  const [recurring, setRecurring] = useState<string | null>(null)
  const [bgId, setBgId] = useState<string>('default') // 'default' | preset id

  useEffect(() => {
    setIncluded(new Set(song.sections.map((s) => s.id)))
    setRecurring(detectRecurringSection(song))
    setBgId('default')
  }, [song])

  const firstLine = (s: Song['sections'][number]): string => {
    const l = s.lines.find((x) => x.trim().length > 0) ?? ''
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

  const background = useMemo<Background | null>(
    () => (bgId === 'default' ? null : BACKGROUND_PRESETS.find((p) => p.id === bgId)?.background ?? null),
    [bgId]
  )

  const canAdd = included.size > 0

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal add-song" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Add “{song.title || 'Song'}”</h2>
          <button className="modal-close" onClick={onCancel} title="Cancel">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="ss-sub">Stanzas — tick to include, ↻ to repeat after each stanza</div>
          <label className={`ss-row norepeat ${recurring === null ? 'active' : ''}`}>
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

          {song.sections.map((s) => {
            const inc = included.has(s.id)
            return (
              <div key={s.id} className={`ss-row ${recurring === s.id ? 'active' : ''} ${inc ? '' : 'off'}`}>
                <input type="checkbox" className="ss-inc" checked={inc} onChange={() => toggleInclude(s.id)} title="Include this stanza" />
                <div className="ss-text">
                  <div className="ss-label">{s.label}</div>
                  <div className="ss-preview">{firstLine(s) || '—'}</div>
                </div>
                <input
                  type="radio"
                  name="recurring"
                  className="ss-repeat"
                  checked={recurring === s.id}
                  disabled={!inc}
                  onChange={() => setRecurring(s.id)}
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
            onClick={() => onConfirm({ includedIds: [...included], recurringId: recurring, background })}
          >
            Add song
          </button>
        </div>
      </div>
    </div>
  )
}
