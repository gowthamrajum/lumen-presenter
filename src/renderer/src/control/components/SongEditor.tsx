import { useState } from 'react'
import { useStore, uid } from '../../store/useStore'
import { Icon } from '../../shared/Icon'
import type { Song, SongSection, SongSectionKind } from '@shared/types'

const KIND_LABEL: Record<SongSectionKind, string> = {
  verse: 'Verse',
  prechorus: 'Pre-Chorus',
  chorus: 'Chorus',
  bridge: 'Bridge',
  tag: 'Tag',
  intro: 'Intro',
  ending: 'Ending',
  other: 'Other'
}
const KINDS = Object.keys(KIND_LABEL) as SongSectionKind[]

function defaultLabel(kind: SongSectionKind, sections: SongSection[]): string {
  if (kind === 'verse') return `Verse ${sections.filter((s) => s.kind === 'verse').length + 1}`
  return KIND_LABEL[kind]
}

export function SongEditor({ song, onClose }: { song: Song; onClose: () => void }): JSX.Element {
  const saveSong = useStore((s) => s.saveSong)
  const [draft, setDraft] = useState<Song>(song)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (patch: Partial<Song>): void => setDraft((d) => ({ ...d, ...patch }))
  const setSection = (id: string, patch: Partial<SongSection>): void =>
    setDraft((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const addSection = (kind: SongSectionKind): void =>
    setDraft((d) => ({
      ...d,
      sections: [...d.sections, { id: uid(), kind, label: defaultLabel(kind, d.sections), lines: [] }]
    }))
  const removeSection = (id: string): void =>
    setDraft((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) }))
  const moveSection = (id: string, dir: -1 | 1): void =>
    setDraft((d) => {
      const i = d.sections.findIndex((s) => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.sections.length) return d
      const sections = d.sections.slice()
      ;[sections[i], sections[j]] = [sections[j], sections[i]]
      return { ...d, sections }
    })

  const save = async (): Promise<void> => {
    setSaving(true)
    setError('')
    try {
      await saveSong({ ...draft, title: draft.title.trim() || 'Untitled Song' })
      onClose()
    } catch (e) {
      setError(`Could not save: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal song-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Song</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="modal-body">
          <input
            className="search"
            placeholder="Song title"
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            autoFocus
          />
          <div className="song-meta-row">
            <input
              className="search"
              placeholder="Author (optional)"
              value={draft.author ?? ''}
              onChange={(e) => set({ author: e.target.value })}
            />
            <input
              className="search"
              placeholder="CCLI # (optional)"
              value={draft.ccli ?? ''}
              onChange={(e) => set({ ccli: e.target.value })}
            />
            <label className="song-lpp" title="Lyric lines shown per slide">
              Lines/slide
              <input
                type="number"
                min={1}
                max={8}
                value={draft.linesPerSlide ?? 2}
                onChange={(e) => set({ linesPerSlide: Math.max(1, Math.min(8, Number(e.target.value) || 2)) })}
              />
            </label>
          </div>

          <div className="section-label">Sections — order is the play order</div>
          {draft.sections.map((sec, i) => (
            <div key={sec.id} className="song-section">
              <div className="song-section-head">
                <select
                  value={sec.kind}
                  onChange={(e) => setSection(sec.id, { kind: e.target.value as SongSectionKind })}
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  className="search"
                  value={sec.label}
                  onChange={(e) => setSection(sec.id, { label: e.target.value })}
                />
                <button className="btn tiny icon-btn" onClick={() => moveSection(sec.id, -1)} disabled={i === 0} title="Move up">
                  <Icon name="chevron-up" />
                </button>
                <button
                  className="btn tiny icon-btn"
                  onClick={() => moveSection(sec.id, 1)}
                  disabled={i === draft.sections.length - 1}
                  title="Move down"
                >
                  <Icon name="chevron-down" />
                </button>
                <button className="btn tiny icon-btn" onClick={() => removeSection(sec.id)} title="Remove section">
                  <Icon name="close" />
                </button>
              </div>
              <textarea
                className="text-input song-lyrics"
                placeholder="Lyric lines for this section…"
                value={sec.lines.join('\n')}
                onChange={(e) => setSection(sec.id, { lines: e.target.value.split('\n') })}
              />
            </div>
          ))}

          <div className="theme-row add-sections">
            <button className="btn tiny" onClick={() => addSection('verse')}>
              + Verse
            </button>
            <button className="btn tiny" onClick={() => addSection('chorus')}>
              + Chorus
            </button>
            <button className="btn tiny" onClick={() => addSection('prechorus')}>
              + Pre-Chorus
            </button>
            <button className="btn tiny" onClick={() => addSection('bridge')}>
              + Bridge
            </button>
            <button className="btn tiny" onClick={() => addSection('tag')}>
              + Tag
            </button>
          </div>
        </div>

        <div className="modal-foot">
          {error && <span className="modal-error">{error}</span>}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !draft.title.trim()}>
            {saving ? 'Saving…' : 'Save to library'}
          </button>
        </div>
      </div>
    </div>
  )
}
