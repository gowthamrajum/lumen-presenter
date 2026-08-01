import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { detectRecurringSection } from '../songArrange'
import { BACKGROUND_PRESETS } from '../presets'
import { autoGroups, isBilingualSection, sectionUnits, unitLines, type SlideUnit } from '../slides'
import { Icon } from '../../shared/Icon'
import type { Background, Song } from '@shared/types'

export interface AddSongChoice {
  /** included section ids, in the presenter's chosen play order */
  includedIds: string[]
  recurringId: string | null
  /** Line indices (into recurringLines, or the recurring section's lines) that
   *  repeat AFTER each stanza. The FIRST occurrence always plays the whole section;
   *  the repeats use only these lines. null = repeat the whole section (or none). */
  repeatLineIndices: number[] | null
  /** the recurring section's full lines, possibly edited/broken by the operator in
   *  the repeat editor — replaces that section's lines when present. */
  recurringLines?: string[]
  /** null = keep the current/global background */
  background: Background | null
  /** Per-section slide grouping the operator set in the grouping editor, as
   *  units-per-slide (see SongSection.groups). Only sections they actually
   *  regrouped appear here; the rest keep the automatic split. */
  groups?: Record<string, number[]>
  /** Per-section lines rewritten by reordering units in the grouping editor.
   *  A unit moves as a whole, so a Telugu line and its transliteration travel
   *  together. Only sections actually reordered appear here. */
  sectionLines?: Record<string, string[]>
  /** Slide grouping for the REPEAT occurrences of the recurring section (the
   *  ticked lines that play after each stanza), units-per-slide. */
  repeatGroups?: number[]
}

/** Cumulative unit index after each slide, i.e. where the breaks sit. */
function groupsToBreaks(groups: number[]): Set<number> {
  const breaks = new Set<number>()
  let at = 0
  for (let i = 0; i < groups.length - 1; i++) {
    at += groups[i]
    breaks.add(at - 1) // "a break follows unit at-1"
  }
  return breaks
}

function breaksToGroups(breaks: Set<number>, unitCount: number): number[] {
  const groups: number[] = []
  let run = 0
  for (let i = 0; i < unitCount; i++) {
    run++
    if (breaks.has(i) || i === unitCount - 1) {
      groups.push(run)
      run = 0
    }
  }
  return groups
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
  // Editable copy of the recurring section's lines + which repeat after each stanza.
  // The operator can retype a line or add one to break it (e.g. repeat only half).
  const [editLines, setEditLines] = useState<{ text: string; repeat: boolean }[]>([])
  const [bgId, setBgId] = useState<string>('default') // 'default' | preset id
  /** which section's slide-grouping editor is expanded, or null */
  const [grouping, setGrouping] = useState<string | null>(null)
  /** operator-chosen units-per-slide, by section id (absent = automatic) */
  const [groups, setGroups] = useState<Record<string, number[]>>({})
  /** section lines rewritten by moving units around (absent = as written) */
  const [lineOverride, setLineOverride] = useState<Record<string, string[]>>({})
  /** grouping for the repeat occurrences (the ticked lines), or null = automatic */
  const [repeatGroups, setRepeatGroups] = useState<number[] | null>(null)

  useEffect(() => {
    setOrder(song.sections.map((s) => s.id))
    setIncluded(new Set(song.sections.map((s) => s.id)))
    setRecurring(detectRecurringSection(song))
    setBgId('default')
    setGrouping(null)
    setGroups({})
    setLineOverride({})
    setRepeatGroups(null)
  }, [song])

  const byId = useMemo(() => new Map(song.sections.map((s) => [s.id, s])), [song])

  // Seed the editable lines from the recurring section (all repeat by default); the
  // user unticks to shorten, edits text, or adds lines. Reset when it changes.
  useEffect(() => {
    const lines = (recurring ? byId.get(recurring)?.lines ?? [] : []).filter((l) => l.trim().length > 0)
    setEditLines(lines.map((text) => ({ text, repeat: true })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring, song])

  const setLineText = (i: number, text: string): void =>
    setEditLines((prev) => prev.map((e, j) => (j === i ? { ...e, text } : e)))
  const toggleLineRepeat = (i: number): void =>
    setEditLines((prev) => prev.map((e, j) => (j === i ? { ...e, repeat: !e.repeat } : e)))
  const addLine = (): void => setEditLines((prev) => [...prev, { text: '', repeat: true }])
  const removeLine = (i: number): void => setEditLines((prev) => prev.filter((_, j) => j !== i))

  const firstLine = (id: string): string => {
    const sec = byId.get(id)
    const l = sec?.lines.find((x) => x.trim().length > 0) ?? ''
    return l.length > 40 ? `${l.slice(0, 40)}…` : l
  }

  // ---- slide grouping ----
  const lpp = Math.max(1, song.linesPerSlide ?? 2)
  /** A section's groupable units: a lyric line, or a whole Telugu+transliteration
   *  pair in a bilingual section — so a break can never split a pair. */
  /** A section's lines as they stand now — reordered if the operator moved units. */
  const linesOf = (id: string): string[] => lineOverride[id] ?? byId.get(id)?.lines ?? []
  const isBi = (id: string): boolean => !!song.bilingual || isBilingualSection(linesOf(id))
  const unitsOf = (id: string): SlideUnit[] => sectionUnits(linesOf(id), isBi(id))

  /**
   * Move a whole unit one step. Because a unit IS the Telugu line plus its
   * transliteration, the two can only ever travel together. The rewritten lines
   * are stored flat, unit by unit, which re-derives to the same units — so the
   * grouping stays meaningful across the move.
   */
  const moveUnit = (id: string, index: number, dir: -1 | 1): void => {
    const units = unitsOf(id)
    const j = index + dir
    if (j < 0 || j >= units.length) return
    // Pin the grouping as it stands. Reordering writes the lines back unit by
    // unit, which interleaves the two languages — so the AUTOMATIC split would
    // then see one pair per block and re-paginate (2 slides became 4). The unit
    // count is unchanged by a swap, so the current grouping still fits exactly.
    const held = groupsOf(id)
    const next = units.slice()
    ;[next[index], next[j]] = [next[j], next[index]]
    setLineOverride((prev) => ({ ...prev, [id]: next.flatMap((u) => unitLines(u)) }))
    setGroups((prev) => ({ ...prev, [id]: held }))
  }
  /** Which slide (group index) a given unit currently sits in. */
  const groupOfUnit = (grps: number[], unitIndex: number): number => {
    let at = 0
    for (let g = 0; g < grps.length; g++) {
      at += grps[g]
      if (unitIndex < at) return g
    }
    return Math.max(0, grps.length - 1)
  }

  /**
   * Move a unit OUT of one stanza and onto the end of another. The unit is the
   * Telugu line with its transliteration, so the pair travels intact across the
   * move too.
   *
   * Both stanzas' groupings are carried across rather than recomputed: the lines
   * are stored flat, unit by unit, which interleaves the languages, and letting
   * the automatic split re-derive would re-paginate both stanzas (the same trap
   * as the within-stanza move). So the source loses one slot from the slide the
   * unit was on, and the target gains one on its last slide.
   */
  const moveUnitTo = (fromId: string, index: number, toId: string): void => {
    if (fromId === toId) return
    const fromUnits = unitsOf(fromId)
    const toUnits = unitsOf(toId)
    const unit = fromUnits[index]
    if (!unit) return

    const fromGroups = groupsOf(fromId).slice()
    const g = groupOfUnit(fromGroups, index)
    fromGroups[g] -= 1
    const nextFromGroups = fromGroups.filter((n) => n > 0)

    const toGroups = groupsOf(toId).slice()
    if (toGroups.length) toGroups[toGroups.length - 1] += 1
    else toGroups.push(1)

    const nextFrom = fromUnits.filter((_, i) => i !== index)
    const nextTo = [...toUnits, unit]

    setLineOverride((prev) => ({
      ...prev,
      [fromId]: nextFrom.flatMap((u) => unitLines(u)),
      [toId]: nextTo.flatMap((u) => unitLines(u))
    }))
    setGroups((prev) => ({ ...prev, [fromId]: nextFromGroups, [toId]: toGroups }))
  }

  /** The grouping in force: the operator's, else what the automatic split gives. */
  const groupsOf = (id: string): number[] => {
    const chosen = groups[id]
    const units = unitsOf(id)
    // A stale grouping (units moved or edited underneath it) falls back rather
    // than mis-slicing — same rule songSlides applies.
    if (chosen && chosen.reduce((a, b) => a + b, 0) === units.length) return chosen
    return autoGroups(linesOf(id), isBi(id), lpp)
  }
  /** Split after this unit, or rejoin across it. */
  const toggleBreak = (id: string, unitIndex: number): void => {
    const units = unitsOf(id)
    const breaks = groupsToBreaks(groupsOf(id))
    if (breaks.has(unitIndex)) breaks.delete(unitIndex)
    else breaks.add(unitIndex)
    setGroups((prev) => ({ ...prev, [id]: breaksToGroups(breaks, units.length) }))
  }
  /** Back to the automatic split AND the written line order. */
  const resetGrouping = (id: string): void => {
    setGroups((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setLineOverride((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
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

  // The recurring section's (edited) non-blank lines, and which of them repeat.
  // repeatLineIndices is null when the WHOLE section repeats (or no recurring section).
  const recEntries = editLines.filter((e) => e.text.trim().length > 0)
  const recurringLines = recurring ? recEntries.map((e) => e.text) : undefined
  const tickedRepeat = recEntries.map((e, i) => (e.repeat ? i : -1)).filter((i) => i >= 0)
  const repeatLineIndices =
    recurring && tickedRepeat.length < recEntries.length ? tickedRepeat : null

  // ---- the repeat's own slide grouping ----
  // The lines that actually play after each stanza, decomposed into units so the
  // repeat can be split on pair boundaries like any other stanza.
  const repeatLines = tickedRepeat.map((i) => recEntries[i].text)
  const repeatUnits = recurring
    ? sectionUnits(repeatLines, !!song.bilingual || isBilingualSection(repeatLines))
    : []
  const repeatBreaksGroups =
    repeatGroups && repeatGroups.reduce((a, b) => a + b, 0) === repeatUnits.length
      ? repeatGroups
      : autoGroups(repeatLines, !!song.bilingual || isBilingualSection(repeatLines), lpp)
  const repeatBreaks = groupsToBreaks(repeatBreaksGroups)
  const toggleRepeatBreak = (u: number): void => {
    const b = new Set(repeatBreaks)
    if (b.has(u)) b.delete(u)
    else b.add(u)
    setRepeatGroups(breaksToGroups(b, repeatUnits.length))
  }

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
            // Only decompose the stanza that's actually expanded.
            const units = grouping === id ? unitsOf(id) : []
            const breaks = grouping === id ? groupsToBreaks(groupsOf(id)) : new Set<number>()
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
                <button
                  className={`ss-slides-btn ${grouping === id ? 'active' : ''} ${groups[id] ? 'custom' : ''}`}
                  disabled={!inc}
                  onClick={() => setGrouping(grouping === id ? null : id)}
                  title="Choose which lines share a slide"
                >
                  {groupsOf(id).length} slide{groupsOf(id).length === 1 ? '' : 's'}
                </button>
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
              {grouping === id && (
                <div className="ss-slides">
                  <div className="ss-slides-hint">
                    Click a divider to split or rejoin a slide
                    {(!!song.bilingual || isBilingualSection(sec.lines)) &&
                      ' · each Telugu line stays with its transliteration'}
                    {groups[id] && (
                      <button className="ss-slides-reset" onClick={() => resetGrouping(id)}>
                        Reset
                      </button>
                    )}
                  </div>
                  {units.map((unit, u) => (
                    <div key={u}>
                      <div className="ss-unit">
                        <span className="ss-unit-move">
                          <button
                            className="icon-btn"
                            onClick={() => moveUnit(id, u, -1)}
                            disabled={u === 0}
                            title="Move these lines up (Telugu and its transliteration together)"
                          >
                            <Icon name="chevron-up" />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => moveUnit(id, u, 1)}
                            disabled={u === units.length - 1}
                            title="Move these lines down (Telugu and its transliteration together)"
                          >
                            <Icon name="chevron-down" />
                          </button>
                        </span>
                        <span className="ss-unit-lines">
                          {unitLines(unit).map((line, k) => (
                            <span key={k} className="ss-unit-line">
                              {line}
                            </span>
                          ))}
                        </span>
                        {order.filter((o) => o !== id && included.has(o)).length > 0 && (
                          <select
                            className="ss-unit-to"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) moveUnitTo(id, u, e.target.value)
                            }}
                            title="Move these lines to another stanza"
                          >
                            <option value="">Move to…</option>
                            {order
                              .filter((o) => o !== id && included.has(o))
                              .map((o) => (
                                <option key={o} value={o}>
                                  {byId.get(o)?.label ?? o}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                      {u < units.length - 1 && (
                        <button
                          className={`ss-divider ${breaks.has(u) ? 'on' : ''}`}
                          onClick={() => toggleBreak(id, u)}
                          title={breaks.has(u) ? 'Rejoin onto one slide' : 'Split onto a new slide'}
                        >
                          <span className="ss-divider-label">{breaks.has(u) ? 'new slide' : 'split here'}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {recurring === id && (
                <div className="ss-repeat-lines">
                  <div className="ss-repeat-hint">
                    First time plays the whole stanza · repeats use only the ticked lines · edit a line or add one to break it
                  </div>
                  {editLines.map((e, i) => (
                    <div key={i} className="ss-repeat-line">
                      <input
                        type="checkbox"
                        checked={e.repeat}
                        onChange={() => toggleLineRepeat(i)}
                        title="Repeat this line after each stanza"
                      />
                      <input
                        className="ss-line-edit"
                        value={e.text}
                        placeholder="(empty line)"
                        spellCheck={false}
                        onChange={(ev) => setLineText(i, ev.target.value)}
                      />
                      <button className="ss-line-del" title="Remove this line" onClick={() => removeLine(i)}>
                        <Icon name="close" />
                      </button>
                    </div>
                  ))}
                  <button className="ss-line-add with-ico" onClick={addLine}>
                    <Icon name="plus" /> Add line
                  </button>

                  {/* The repeat is its own run of slides — split it like any stanza,
                      instead of always falling back to the automatic pagination. */}
                  {repeatUnits.length > 1 && (
                    <div className="ss-slides ss-repeat-slides">
                      <div className="ss-slides-hint">
                        How the repeat splits · {repeatBreaksGroups.length} slide
                        {repeatBreaksGroups.length === 1 ? '' : 's'}
                        {repeatGroups && (
                          <button className="ss-slides-reset" onClick={() => setRepeatGroups(null)}>
                            Reset
                          </button>
                        )}
                      </div>
                      {repeatUnits.map((unit, u) => (
                        <div key={u}>
                          <div className="ss-unit">
                            <span className="ss-unit-lines">
                              {unitLines(unit).map((line, k) => (
                                <span key={k} className="ss-unit-line">
                                  {line}
                                </span>
                              ))}
                            </span>
                          </div>
                          {u < repeatUnits.length - 1 && (
                            <button
                              className={`ss-divider ${repeatBreaks.has(u) ? 'on' : ''}`}
                              onClick={() => toggleRepeatBreak(u)}
                              title={repeatBreaks.has(u) ? 'Rejoin onto one slide' : 'Split onto a new slide'}
                            >
                              <span className="ss-divider-label">
                                {repeatBreaks.has(u) ? 'new slide' : 'split here'}
                              </span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
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
            onClick={() =>
              onConfirm({
                includedIds: includedInOrder,
                recurringId: recurring,
                repeatLineIndices,
                recurringLines,
                background,
                groups,
                sectionLines: lineOverride,
                repeatGroups: repeatGroups ?? undefined
              })
            }
          >
            Add song
          </button>
        </div>
      </div>
    </div>
  )
}
