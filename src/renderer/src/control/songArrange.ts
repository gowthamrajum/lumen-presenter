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
 * Build the play order for a song the presenter is adding. `includedIds` is the
 * presenter's chosen sections in the order they arranged them — that order is
 * respected verbatim. If a `recurringId` is chosen (and included and non-empty)
 * it plays after every other included section — leading too when it's first in
 * the arrangement, for the worship-standard order Pallavi, V1, Pallavi, V2,
 * Pallavi. Sections that merely duplicate the refrain's lyrics are collapsed into
 * it so it never plays back-to-back. Returns [] if nothing is included.
 */
export function buildSongArrangement(
  song: Song,
  includedIds: string[],
  recurringId: string | null
): string[] {
  const byId = new Map(song.sections.map((s) => [s.id, s]))
  // Preserve the arranged order; drop ids that no longer exist.
  const included = includedIds.map((id) => byId.get(id)).filter((s): s is SongSection => Boolean(s))
  if (!included.length) return []

  const rec = recurringId ? byId.get(recurringId) : undefined
  if (rec && includedIds.includes(rec.id) && hasContent(rec)) {
    const recKey = blockKey(rec)
    // "Is this slide the refrain?" is decided by lyric block, not id — a second
    // chorus/refrain copy counts as the refrain too. Those collapse into it (so
    // it never plays back-to-back); everything else is a distinct stanza.
    const isRefrain = (s: SongSection): boolean => blockKey(s) === recKey
    const others = included.filter((s) => !isRefrain(s))
    if (!others.length) return [rec.id] // the whole selection is the refrain — play it once
    // Lead with the refrain when the presenter placed a refrain slide first.
    const arr: string[] = isRefrain(included[0]) ? [rec.id] : []
    for (const s of others) {
      arr.push(s.id)
      arr.push(rec.id)
    }
    return arr
  }
  // no repeat (or nothing to interleave with): just the included sections, in order
  return included.map((s) => s.id)
}
