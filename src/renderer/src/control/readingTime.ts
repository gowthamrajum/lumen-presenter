/**
 * How long a verse needs to be on the screen: long enough to read, plus a
 * moment, and no longer.
 *
 * A fixed minute was wrong in both directions — "Jesus wept" sat there for
 * fifty seconds after everyone had finished, and a long verse in Romans was
 * gone before the back row got to the end of it. So the hold is measured from
 * the slide's own words.
 *
 * The congregation reads the TELUGU. The English underneath is there for the
 * people who can't read the script, not as a second thing to get through — so
 * the Telugu sets the pace, and the English is measured only when a slide has
 * no Telugu on it at all. Timing to whichever side was longer would hold every
 * slide to the English translation, which is almost always the wordier of the
 * two, and leave the room waiting on text it isn't reading.
 *
 * The rates are deliberately unhurried: the number to beat isn't private
 * reading speed, it's reading projected text across a room, so they sit well
 * below the ~250 wpm a reader manages on paper.
 */
const TELUGU_CHAR = /[ఀ-౿]/
const WORDS_PER_SECOND = { telugu: 1.5, english: 2.2 }

/**
 * What every verse gets before a word of it is counted: time to notice the
 * slide changed, find the start of the line, and take it in afterwards. The
 * reading estimate is added on top, so this is also the floor — a two-word
 * verse still gets its twelve seconds and a little.
 */
const BASE_MS = 12_000
/** Nothing reads for two minutes; past this the operator is in charge anyway. */
export const MAX_HOLD_MS = 120_000
/** What a slide with no words to measure falls back to. */
export const DEFAULT_HOLD_MS = 60_000

const wordsIn = (lines: string[]): number =>
  lines.join(' ').trim().split(/\s+/).filter(Boolean).length

/**
 * The hold for one slide, from the text on it. Returns DEFAULT_HOLD_MS when
 * there is nothing to measure, so a slide that isn't words (a countdown, an
 * image) is unaffected.
 */
export function readingHoldMs(lines: string[] | undefined): number {
  const src = (lines ?? []).filter((l) => l && l.trim())
  if (!src.length) return DEFAULT_HOLD_MS

  const telugu = wordsIn(src.filter((l) => TELUGU_CHAR.test(l)))
  const english = wordsIn(src.filter((l) => !TELUGU_CHAR.test(l)))
  if (!telugu && !english) return DEFAULT_HOLD_MS

  const seconds = telugu
    ? telugu / WORDS_PER_SECOND.telugu
    : english / WORDS_PER_SECOND.english
  const ms = Math.min(MAX_HOLD_MS, BASE_MS + seconds * 1000)
  return Math.round(ms / 1000) * 1000 // whole seconds; the operator sees this count down
}
