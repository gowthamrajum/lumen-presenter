/**
 * Rough romanisation of Telugu script, in the spelling Telugu speakers actually
 * type on a Latin keyboard ("keerthanala granthamu", "prasangi") rather than a
 * scholarly scheme with diacritics.
 *
 * This exists so the Bible book search is reachable without a Telugu keyboard:
 * the book list only carries the script name (కీర్తనల గ్రంథము) and the English
 * key (Psalms), so "kee" matched neither. It only has to be close — `foldRoman`
 * below absorbs the spelling variation that informal romanisation always has
 * (ee/i, aa/a, th/t), so the match survives a different guess at the vowels.
 */

/** Consonants, bare — the inherent "a" is added by the walker when nothing follows. */
const CONSONANTS: Record<string, string> = {
  క: 'k', ఖ: 'kh', గ: 'g', ఘ: 'gh', ఙ: 'ng',
  చ: 'ch', ఛ: 'chh', జ: 'j', ఝ: 'jh', ఞ: 'nj',
  ట: 't', ఠ: 'th', డ: 'd', ఢ: 'dh', ణ: 'n',
  త: 'th', థ: 'th', ద: 'd', ధ: 'dh', న: 'n',
  ప: 'p', ఫ: 'ph', బ: 'b', భ: 'bh', మ: 'm',
  య: 'y', ర: 'r', ఱ: 'r', ల: 'l', ళ: 'l', ఴ: 'l',
  వ: 'v', శ: 'sh', ష: 'sh', స: 's', హ: 'h',
  ౘ: 'ts', ౙ: 'dz'
}

/**
 * Standalone vowel letters.
 *
 * Long o (ఓ) is written 'o' and long e (ఏ) 'e', NOT 'oo'/'ee'. Doubling them
 * would spell them the same as long u (ఊ) and long i (ఈ), and `foldRoman` then
 * sends "oo" to u and "ee" to i — so యోహాను came out "yuhanu" and could not be
 * reached by typing "yo", which is what anybody types. The doubled spellings
 * stay where they belong: on the vowels that really are u and i.
 */
const VOWELS: Record<string, string> = {
  అ: 'a', ఆ: 'aa', ఇ: 'i', ఈ: 'ee', ఉ: 'u', ఊ: 'oo',
  ఋ: 'ru', ౠ: 'ruu', ఌ: 'lu', ౡ: 'luu',
  ఎ: 'e', ఏ: 'e', ఐ: 'ai', ఒ: 'o', ఓ: 'o', ఔ: 'au'
}

/** Vowel signs that replace a consonant's inherent "a". */
const MATRAS: Record<string, string> = {
  'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo',
  'ృ': 'ru', 'ౄ': 'ruu',
  'ె': 'e', 'ే': 'e', 'ై': 'ai',
  'ొ': 'o', 'ో': 'o', 'ౌ': 'au'
}

const VIRAMA = '్' // ్ — kills the inherent vowel
const ANUSVARA = 'ం' // ం — nasal
const CANDRABINDU = 'ఁ' // ఁ
const VISARGA = 'ః' // ః

/** "కీర్తనల గ్రంథము" -> "keerthanala granthamu". Non-Telugu characters pass through. */
export function romanizeTelugu(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    const cons = CONSONANTS[ch]
    if (cons) {
      out += cons
      const next = s[i + 1]
      if (next === VIRAMA) {
        i++ // bare consonant, no vowel
      } else if (next && MATRAS[next]) {
        out += MATRAS[next]
        i++
      } else {
        out += 'a' // inherent vowel
      }
      continue
    }
    if (VOWELS[ch]) {
      out += VOWELS[ch]
      continue
    }
    if (ch === ANUSVARA || ch === CANDRABINDU) {
      out += 'n'
      continue
    }
    if (ch === VISARGA) {
      out += 'h'
      continue
    }
    if (ch === VIRAMA || MATRAS[ch]) continue // stray mark
    out += ch // spaces, punctuation, Latin already present
  }
  return out
}

/**
 * Collapse the ways the same Telugu sound gets spelled in Latin, so a search
 * matches whichever the operator reached for: "keerthana"/"kirtana",
 * "prasangi"/"prasamgi". Applied to both sides of the comparison.
 */
export function foldRoman(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z ]+/g, '')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/ph/g, 'f')
    .replace(/([a-z])\1+/g, '$1')
    .trim()
}

/** Edit distance, abandoned once it passes `max` — we only care about "close". */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (row[j] < best) best = row[j]
    }
    if (best > max) return false
    prev = row
  }
  return prev[b.length] <= max
}

/**
 * True when `query` starts the text or any word in it — or, once enough has been
 * typed to be discriminating, when it comes within a couple of letters of one.
 *
 * The near-miss arm matters because a book's everyday name and the one this
 * translation prints often differ by an inflection: Psalms is listed as
 * "కీర్తనల గ్రంథము" (keerthanala granthamu) but is spoken of as Keerthanalu, so
 * on a strict prefix the entry vanishes exactly as the operator finishes typing
 * it. Extra letters should never cost you the result.
 */
export function romanMatches(text: string, query: string): boolean {
  if (romanPrefix(text, query)) return true
  const q = foldRoman(query)
  // only once it's long enough that a loose match still means something
  if (q.length < 4) return false
  return foldRoman(text)
    .split(' ')
    .filter(Boolean)
    .some((w) => within(w, q, 2))
}

/** The strict half of the above: `query` starts the text or one of its words.
 *  Kept separate so a caller can prefer real prefixes and only fall back to the
 *  near-miss arm when nothing starts with what was typed. */
export function romanPrefix(text: string, query: string): boolean {
  const q = foldRoman(query)
  if (!q) return false
  const t = foldRoman(text)
  return t.startsWith(q) || t.split(' ').some((w) => w.startsWith(q))
}
