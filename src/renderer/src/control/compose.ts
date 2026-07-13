import type { ComposedLine } from '@shared/types'
import { uid } from '../store/useStore'

// Reference composer canvas — layouts are authored at this size and scaled to
// any output. (Ported from worshipReady's CanvasEditor / buildSongSlideLines.)
export const COMPOSE_W = 960
export const COMPOSE_H = 540
const FONT = "'Anek Telugu', sans-serif"
const MAX_TEXT_WIDTH = 800
const MAX_TEXT_HEIGHT = COMPOSE_H * 0.9
const MIN_FONT = 14
const MAX_FONT = 70
const LINE_HEIGHT_FACTOR = 1.5
const TARGET_FILL = 0.85
const MIN_SP_FACTOR = 1.4
const MAX_SP_FACTOR = 2.5

let _ctx: CanvasRenderingContext2D | null = null
function ctx(): CanvasRenderingContext2D {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d')
  return _ctx!
}

/** Largest integer font size in [MIN_FONT, MAX_FONT] where `text` fits `maxWidth`. */
function fitLineToWidth(text: string, maxWidth: number): number {
  const c = ctx()
  let lo = MIN_FONT
  let hi = MAX_FONT
  let best = MIN_FONT
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    c.font = `${mid}px ${FONT}`
    if (c.measureText(text).width <= maxWidth) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

/** Font size where every line fits horizontally and the block fits vertically. */
function fitStanzaFontSize(lines: string[]): number {
  const horiz = Math.min(...lines.map((t) => fitLineToWidth(t, MAX_TEXT_WIDTH)))
  const vert = Math.floor((MAX_TEXT_HEIGHT * 0.9) / (lines.length * LINE_HEIGHT_FACTOR))
  return Math.min(horiz, vert, MAX_FONT)
}

function calcSpacing(fontSize: number, n: number): number {
  if (n <= 1) return fontSize * 1.5
  const targetH = COMPOSE_H * TARGET_FILL
  const dynamic = (targetH - fontSize) / (n - 1)
  return Math.min(fontSize * MAX_SP_FACTOR, Math.max(fontSize * MIN_SP_FACTOR, dynamic))
}

/**
 * Convert an array of lines into vertically-centred, auto-fit ComposedLines on
 * the 960×540 reference canvas. Blank lines are dropped.
 */
export function composeFromLines(lines: string[]): ComposedLine[] {
  const filtered = lines
    .filter((l) => l != null && l.trim() !== '')
    .map((l) => l.replace(/\s{3,}\|\|/g, '  ||'))
  if (!filtered.length) return []

  const fontSize = fitStanzaFontSize(filtered)
  const spacing = calcSpacing(fontSize, filtered.length)
  const blockH = (filtered.length - 1) * spacing + fontSize
  const startY = (COMPOSE_H - blockH) / 2 + fontSize / 2
  const stanzaId = `st-${uid()}`

  return filtered.map((text, i) => ({
    id: uid(),
    text,
    x: COMPOSE_W / 2,
    y: Math.round(startY + i * spacing),
    fontSize,
    align: 'center' as const,
    stanzaId
  }))
}

/** Ensure Anek Telugu is in the font cache before measuring (best-effort). */
export async function ensureComposerFont(): Promise<void> {
  try {
    await document.fonts.load(`${MIN_FONT}px ${FONT}`)
    await document.fonts.load(`${MAX_FONT}px ${FONT}`)
  } catch {
    // non-browser / load failure — continue best-effort
  }
}
