import { useEffect, useState } from 'react'
import { detectRecurringSection } from '../songArrange'
import type { Song } from '@shared/types'

/**
 * Asks which section recurs after every stanza (e.g. the Pallavi). The detected
 * refrain is pre-selected; "None" keeps the song in its written order.
 */
export function SongStructureDialog({
  song,
  onCancel,
  onConfirm
}: {
  song: Song
  onCancel: () => void
  onConfirm: (recurringId: string | null) => void
}): JSX.Element {
  const [choice, setChoice] = useState<string | null>(null)

  useEffect(() => {
    setChoice(detectRecurringSection(song))
  }, [song])

  const firstLine = (s: Song['sections'][number]): string => {
    const l = s.lines.find((x) => x.trim().length > 0) ?? ''
    return l.length > 44 ? `${l.slice(0, 44)}…` : l
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal song-structure" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Repeat a section?</h2>
          <button className="modal-close" onClick={onCancel} title="Cancel">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="ss-hint">
            Pick the part that recurs (the Pallavi / chorus). It’ll be added after every stanza.
          </p>

          <label className={`ss-row ${choice === null ? 'active' : ''}`}>
            <input type="radio" name="recurring" checked={choice === null} onChange={() => setChoice(null)} />
            <div className="ss-text">
              <div className="ss-label">None</div>
              <div className="ss-preview">Keep the song in its written order</div>
            </div>
          </label>

          {song.sections.map((s) => (
            <label key={s.id} className={`ss-row ${choice === s.id ? 'active' : ''}`}>
              <input
                type="radio"
                name="recurring"
                checked={choice === s.id}
                onChange={() => setChoice(s.id)}
              />
              <div className="ss-text">
                <div className="ss-label">{s.label}</div>
                <div className="ss-preview">{firstLine(s) || '—'}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onConfirm(choice)}>
            Add song
          </button>
        </div>
      </div>
    </div>
  )
}
