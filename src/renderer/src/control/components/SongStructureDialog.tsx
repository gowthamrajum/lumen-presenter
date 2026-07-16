import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { detectRecurringSection } from '../songArrange'
import { BACKGROUND_PRESETS } from '../presets'
import { Icon } from '../../shared/Icon'
import type { Background, Song } from '@shared/types'

export interface AddSongChoice {
  /** included section ids, in the presenter's chosen play order */
  includedIds: string[]
  recurringId: string | null
  /** Line indices (into the recurring section's lines) that repeat AFTER each
   *  stanza. The FIRST occurrence always plays the whole section; the repeats use
   *  only these lines. null = repeat the whole section (or no recurring section). */
  repeatLineIndices: number[] | null
  /** null = keep the current/global background */
  background: Background | null
}

function swatchStyle(bg: Background): CSSProperties {
  if (bg.type === 'color' || bg.type === 'gradient') return { background: bg.value }
  if (bg.type === 'image') return { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { background: '#111' } // video renders a real preview element instead
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
  // Which of the recurring section's lines repeat after each stanza (by index).
  const [repeatLines, setRepeatLines] = useState<Set<number>>(new Set())
  const [bgId, setBgId] = useState<string>('default') // 'default' | preset id

  useEffect(() => {
    setOrder(song.sections.map((s) => s.id))
    setIncluded(new Set(song.sections.map((s) => s.id)))
    setRecurring(detectRecurringSection(song))
    setBgId('default')
  }, [song])

  const byId = useMemo(() => new Map(song.sections.map((s) => [s.id, s])), [song])

  // Non-blank line indices of a section.
  const contentIdx = (id: string | null): number[] =>
    !id ? [] : (byId.get(id)?.lines ?? []).map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0)

  // Default to repeating the WHOLE recurring section (all lines ticked); the user
  // unticks lines to shorten the repeat. Reset whenever the repeat section changes.
  useEffect(() => {
    setRepeatLines(new Set(contentIdx(recurring)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring, song])

  const toggleRepeatLine = (i: number): void =>
    setRepeatLines((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

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

  // Repeats use only the ticked lines; null when the WHOLE section repeats (all
  // lines ticked) or there's no recurring section — then the play order is unchanged.
  const allRepeatIdx = contentIdx(recurring)
  const tickedRepeat = allRepeatIdx.filter((i) => repeatLines.has(i))
  const repeatLineIndices = recurring && tickedRepeat.length < allRepeatIdx.length ? tickedRepeat : null

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
              <div key={id} className="ss-rowgroup">
                <div className={`ss-row ${recurring === id ? 'active' : ''} ${inc ? '' : 'off'}`}>
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
              {recurring === id && (
                <div className="ss-repeat-lines">
                  <div className="ss-repeat-hint">
                    First time plays the whole stanza · repeats use only the ticked lines
                  </div>
                  {sec.lines.map((line, i) =>
                    line.trim() ? (
                      <label key={i} className="ss-repeat-line">
                        <input type="checkbox" checked={repeatLines.has(i)} onChange={() => toggleRepeatLine(i)} />
                        <span>{line}</span>
                      </label>
                    ) : null
                  )}
                </div>
              )}
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
            onClick={() => onConfirm({ includedIds: includedInOrder, recurringId: recurring, repeatLineIndices, background })}
          >
            Add song
          </button>
        </div>
      </div>
    </div>
  )
}
