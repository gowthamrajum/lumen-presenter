import type { Song, SongSection } from '@shared/types'

/** Normalized lyric block (blank lines dropped) — used to spot repeated sections. */
function blockKey(s: SongSection): string {
  return s.lines.map((l) => l.trim()).filter(Boolean).join('\n')
}
function hasContent(s: SongSection): boolean {
  return s.lines.some((l) => l.trim().length > 0)
}

/**
 * Guess which section recurs after each stanza (the Pallavi / chorus / refrain).
 * Prefers an explicit chorus, then a telltale label, then a section whose lyric
 * block is repeated elsewhere. Only ever returns a section that has lyrics, so a
 * language view where the refrain is empty won't be pre-selected. Null if unsure.
 */
export function detectRecurringSection(song: Song): string | null {
  const secs = song.sections.filter(hasContent)
  if (secs.length < 2) return null

  const chorus = secs.find((s) => s.kind === 'chorus')
  if (chorus) return chorus.id

  const labelled = secs.find((s) => /pallavi|chorus|refrain|పల్లవి/i.test(s.label))
  if (labelled) return labelled.id

  // A section whose exact lyric block appears more than once is a refrain.
  const firstId = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const s of secs) {
    const k = blockKey(s)
    if (!k) continue
    seen.set(k, (seen.get(k) ?? 0) + 1)
    if (!firstId.has(k)) firstId.set(k, s.id)
  }
  for (const [k, n] of seen) if (n > 1) return firstId.get(k) ?? null

  return null
}

/**
 * Build an arrangement that plays the chosen recurring section after every other
 * section. When that section opens the song (a Pallavi written first) it also
 * leads, giving the worship-standard order: Pallavi, V1, Pallavi, V2, Pallavi.
 * Sections that duplicate the refrain's lyrics are collapsed into it so it never
 * plays back-to-back. Returns [] (fall back to written order) if the choice has
 * no lyrics or nothing else to interleave with.
 */
export function buildRepeatArrangement(song: Song, recurringId: string): string[] {
  const rec = song.sections.find((s) => s.id === recurringId)
  if (!rec || !hasContent(rec)) return []
  const recKey = blockKey(rec)

  // Every non-recurring section, minus any that are just another copy of the refrain.
  const others = song.sections.filter((s) => s.id !== recurringId && blockKey(s) !== recKey)
  if (!others.length) return []

  const recIdx = song.sections.findIndex((s) => s.id === recurringId)
  const firstOtherIdx = song.sections.findIndex((s) => others.some((o) => o.id === s.id))
  const arr: string[] = recIdx < firstOtherIdx ? [recurringId] : [] // lead if it opens the song

  for (const s of others) {
    arr.push(s.id)
    arr.push(recurringId)
  }
  return arr
}
