/**
 * Smart rows — how a song slide's lines are laid out so the words are as big
 * as the screen allows.
 *
 * A song slide keeps every lyric line on one line (so a Telugu line and its
 * transliteration stay together), and the font shrinks until the widest line
 * fits. That is right for ordinary lines. For one long line — a refrain sung
 * as a single phrase — it is not: the width decides everything, the text comes
 * out small, and most of the height sits empty.
 *
 * So the layout is calculated, not guessed:
 *
 *  1. Measure every line in the real font.
 *  2. The font the slide can take is the smaller of what the widest row allows
 *     and what the total height allows (and never above the usual ceiling).
 *  3. While WIDTH is what limits it, split the line that is widest into one
 *     more row — and its transliteration at the SAME word, so each Telugu row
 *     still sits above its own English — and keep the split only if the text
 *     gets meaningfully bigger. Stop when splitting stops paying.
 *
 * A slide whose lines already fit comes back exactly as it went in. Splits fall
 * where the singing does: after a "..", "-", comma or similar pause, never
 * leaving a single word stranded on a row, never separating "(2)" or "||…||"
 * from the words they belong to.
 *
 * Pure — the caller supplies the measuring — so it can be tested exactly.
 */

const TELUGU = /[ఀ-౿]/
/** Rows a slide may grow to, and rows one line may be split into. */
const MAX_ROWS = 8
const MAX_SPLIT = 3
/** A split must make the text at least this much bigger to be kept. */
const MIN_GAIN = 1.08

export interface SmartRowsOptions {
  /** width of `text` when drawn at 100px in the slide's font */
  measure: (text: string) => number
  /** the box the text is fitted into, in px */
  boxW: number
  boxH: number
  /** line spacing the slide is drawn at */
  lineHeight: number
  /** the largest font the slide may take, in px */
  cap: number
}

/** Words, with marks that belong to the word before them glued on. */
export function wordsOf(line: string): string[] {
  const raw = line.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const w of raw) {
    // A lone dash or dots is a pause between phrases; "(2)" and "||" mark a
    // repeat. None of them may start a row.
    const glue = /^(-+|–|—|\.{2,}|…+|\(\d+\)|\|\|.*|[,;:!?])$/.test(w)
    if (glue && out.length) out[out.length - 1] += ` ${w}`
    else out.push(w)
  }
  return out
}

/** A row that ends on a pause is a natural place to break. */
const endsOnPause = (word: string): boolean => /(\.{2,}|…|[,;:!?]|-+|–|—|\|\|)$/.test(word)

/**
 * The best places to cut `lines` (the same number of words each, or a single
 * line) into `k` rows. Cutting at the same word index in every line is what
 * keeps a transliteration under its own Telugu. Cost is the widest resulting
 * row; a cut on a pause is preferred, a one-word row is avoided.
 */
function bestCuts(lines: string[][], k: number, measure: (s: string) => number): number[] | null {
  const n = lines[0].length
  if (k < 2 || n < k * 2) return null // no row may be left with a single word
  const width = (words: string[], a: number, b: number): number => measure(words.slice(a, b).join(' '))
  const cost = (cuts: number[]): number => {
    const bounds = [0, ...cuts, n]
    let widest = 0
    for (const words of lines)
      for (let r = 0; r < bounds.length - 1; r++) widest = Math.max(widest, width(words, bounds[r], bounds[r + 1]))
    // Pauses: a cut right after one costs a little less, so between two near-
    // equal options the one that follows the phrasing wins.
    const pauses = cuts.filter((c) => lines.every((w) => endsOnPause(w[c - 1]))).length
    return widest * (1 - 0.06 * pauses)
  }
  let best: number[] | null = null
  let bestCost = Infinity
  const consider = (cuts: number[]): void => {
    const c = cost(cuts)
    if (c < bestCost) {
      bestCost = c
      best = cuts
    }
  }
  if (k === 2) for (let a = 2; a <= n - 2; a++) consider([a])
  else for (let a = 2; a <= n - 4; a++) for (let b = a + 2; b <= n - 2; b++) consider([a, b])
  return best
}

interface Group {
  /** indexes into the slide's lines that are cut together (a Telugu line and its transliteration) */
  members: number[]
  rows: number
  /** where each member is cut, by line index; a member absent here stays whole */
  cuts: Map<number, number[]>
}

/** The rows to draw for `lines`. Returns `lines` itself when nothing helps. */
export function smartRows(lines: string[], o: SmartRowsOptions): string[] {
  if (!lines.length || o.boxW <= 0 || o.boxH <= 0) return lines
  const words = lines.map(wordsOf)

  // Pair each Telugu line with its transliteration: a bilingual slide carries
  // its Telugu block first and the matching Latin lines after, in order.
  const te = lines.map((l, i) => (TELUGU.test(l) ? i : -1)).filter((i) => i >= 0)
  const lat = lines.map((l, i) => (!TELUGU.test(l) && /[A-Za-z]/.test(l) ? i : -1)).filter((i) => i >= 0)
  const paired = new Set<number>()
  const groups: Group[] = []
  if (te.length && te.length === lat.length) {
    te.forEach((t, i) => {
      groups.push({ members: [t, lat[i]], rows: 1, cuts: new Map() })
      paired.add(t)
      paired.add(lat[i])
    })
  }
  lines.forEach((_, i) => {
    if (!paired.has(i)) groups.push({ members: [i], rows: 1, cuts: new Map() })
  })

  /** One line's rows under its group's current cuts. */
  const rowsOfLine = (i: number, g: Group): string[] => {
    const cuts = g.cuts.get(i)
    if (!cuts) return [lines[i]]
    const w = words[i]
    const bounds = [0, ...cuts, w.length]
    return bounds.slice(0, -1).map((a, r) => w.slice(a, bounds[r + 1]).join(' '))
  }
  const groupOf = new Map<number, Group>()
  for (const g of groups) for (const m of g.members) groupOf.set(m, g)
  /** The slide's rows, in the slide's own order. */
  const layout = (): string[] => lines.flatMap((_, i) => rowsOfLine(i, groupOf.get(i)!))

  const sizeFor = (rows: string[]): { size: number; widthBound: boolean } => {
    const widest = Math.max(...rows.map((r) => o.measure(r)), 1)
    const byWidth = ((o.boxW * 0.9) / widest) * 100
    const byHeight = (o.boxH * 0.92) / (rows.length * o.lineHeight)
    const size = Math.min(byWidth, byHeight, o.cap)
    return { size, widthBound: byWidth < byHeight && byWidth < o.cap }
  }

  let rows = layout()
  let fit = sizeFor(rows)
  /** The widest row a group currently draws. */
  const groupWidth = (g: Group): number => Math.max(...g.members.flatMap((m) => rowsOfLine(m, g)).map(o.measure))
  /** The cuts that split `g` into one more row, or null when it can't be. */
  const nextCuts = (g: Group): Map<number, number[]> | null => {
    // Same word count in every member: one cut for all, so each row of the
    // transliteration is the reading of the Telugu row above it. Otherwise
    // each member is cut on its own — a transliteration that doesn't match
    // word for word can't share a cut, but it can still be balanced.
    const k = g.rows + 1
    const sameCount = g.members.every((m) => words[m].length === words[g.members[0]].length)
    const next = new Map<number, number[]>()
    if (sameCount) {
      const shared = bestCuts(g.members.map((m) => words[m]), k, o.measure)
      if (shared) for (const m of g.members) next.set(m, shared)
    } else {
      for (const m of g.members) {
        const own = bestCuts([words[m]], k, o.measure)
        if (own) next.set(m, own)
      }
    }
    return next.size ? next : null
  }

  // Each pass splits, one row further, every group that is (near enough) as
  // wide as the widest — two equally long lines have to be split together, or
  // the one left whole still sets the size and the split buys nothing.
  for (let pass = 0; pass < MAX_ROWS && fit.widthBound; pass++) {
    const widest = Math.max(...groups.map(groupWidth))
    const limiting = groups.filter((g) => groupWidth(g) >= widest * 0.9)
    if (limiting.some((g) => g.rows >= MAX_SPLIT)) break
    const planned = limiting.map((g) => ({ g, cuts: nextCuts(g) }))
    if (planned.some((p) => !p.cuts)) break
    const before = limiting.map((g) => ({ g, rows: g.rows, cuts: g.cuts }))
    for (const p of planned) {
      p.g.rows += 1
      p.g.cuts = p.cuts!
    }
    const trial = layout()
    const trialFit = sizeFor(trial)
    if (trial.length > MAX_ROWS || trialFit.size < fit.size * MIN_GAIN) {
      for (const bk of before) {
        bk.g.rows = bk.rows
        bk.g.cuts = bk.cuts
      }
      break
    }
    rows = trial
    fit = trialFit
  }
  return rows.length === lines.length ? lines : rows
}
