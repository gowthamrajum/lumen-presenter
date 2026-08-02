import { useLayoutEffect, useRef, useState } from 'react'

/** Tightest line spacing used while measuring, and the floor for auto spacing. */
export const AUTO_SPACING_MIN = 1.15
/** Loosest auto spacing — past this a two-word slide reads as scattered. */
export const AUTO_SPACING_MAX = 2.2

/**
 * The spacing auto mode aims for. Lines are spaced FIRST and the font takes
 * whatever room is left — the slide is not required to fill the screen.
 *
 * Filling the screen and spacing the lines are the same budget: glyphs and gaps
 * share the usable height. Sizing the text to fill first left spacing pinned at
 * 1.17-1.28 no matter what, because nothing was ever spare. Spacing first gives
 * the gaps their room and lets the font be smaller, which is the trade that was
 * asked for.
 */
export const AUTO_SPACING_TARGET = 1.8

/**
 * Below this share of the box height the text stops being readable from a hall,
 * and spacing backs off toward AUTO_SPACING_MIN rather than shrink it further.
 * Only very dense slides ever reach it.
 */
export const AUTO_MIN_FONT_SHARE = 0.055

/**
 * Returns a container ref, a font size (px) chosen so the content fits the
 * container without overflowing, and — when `autoSpacing` is on — the line
 * spacing to render it at.
 *
 * The ceiling ("predictive sizing") is what keeps short slides — a single word
 * or a two-word line — from ballooning to fill the whole box and clipping their
 * glyph ink against the edges. Short text tops out at `maxFraction` of the
 * container height; only text too long to fit at that size is shrunk down. A
 * small safety inset keeps ink off the borders.
 *
 * ## Auto spacing
 *
 * A fixed line spacing is a poor deal on an auto-fitted slide: the text is sized
 * to fill the box, so asking for more air just shrinks the font by the same
 * amount and the slide looks the same. Worse, whatever vertical room is left
 * over — a two-line slide in a 16:9 box has a lot — is simply wasted.
 *
 * With `autoSpacing` the fit runs at AUTO_SPACING_MIN (the tightest, so the font
 * comes out as large as possible), then the leftover height is handed back as
 * space between the lines. A sparse slide ends up large AND airy; a dense one
 * stays tight because there is nothing spare. Neither needs anyone to touch a
 * slider.
 */
export function useFitText(
  deps: unknown[],
  opts: {
    min?: number
    max?: number
    scale?: number
    maxFraction?: number
    /** Distribute leftover vertical space as line spacing (Go Live screen). */
    autoSpacing?: boolean
    /** Fixed line spacing to measure against when autoSpacing is off. */
    lineHeight?: number
  } = {}
): { ref: React.RefObject<HTMLDivElement>; fontSize: number; lineHeight: number } {
  const {
    min = 12,
    max = 4000,
    scale = 1,
    maxFraction = 0.4,
    autoSpacing = false,
    lineHeight: fixedLineHeight = 1.22
  } = opts
  const ref = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(48)
  const [lineHeight, setLineHeight] = useState(fixedLineHeight)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = (): void => {
      const parent = el.parentElement
      if (!parent) return
      const availW = parent.clientWidth
      const availH = parent.clientHeight
      if (availW === 0 || availH === 0) return

      // Vertical breathing room so ascenders/descenders never clip top/bottom.
      // Horizontal room comes from the element's own max-width (< 100%), which
      // keeps scrollWidth correct for wrapping text.
      const targetH = availH * 0.92

      // Ceiling: cap the font at a fraction of the container height so short
      // text stays a consistent, readable size instead of filling the box.
      // The user's Size bias raises/lowers this ceiling.
      const cap = Math.min(max, availH * maxFraction * scale)

      /** Largest font that fits at a given line spacing. */
      const fitAt = (lh: number): number => {
        el.style.lineHeight = String(lh)
        let lo = min
        let hi = Math.max(min, cap)
        for (let i = 0; i < 20 && hi - lo > 0.4; i++) {
          const mid = (lo + hi) / 2
          el.style.fontSize = `${mid}px`
          const fits = el.scrollWidth <= availW + 1 && el.scrollHeight <= targetH + 1
          if (fits) lo = mid
          else hi = mid
        }
        return lo
      }

      if (!autoSpacing) {
        const size = fitAt(fixedLineHeight)
        el.style.fontSize = `${size}px`
        setFontSize(size)
        setLineHeight(fixedLineHeight)
        return
      }

      // Space the lines first. Only if that leaves the text too small to read
      // from a hall does the spacing give ground, and then only as far as it
      // must — a dense slide ends tighter than a sparse one, which is right.
      const floor = availH * AUTO_MIN_FONT_SHARE
      let usedLH = AUTO_SPACING_TARGET
      let size = fitAt(usedLH)
      if (size < floor) {
        for (const lh of [1.6, 1.45, 1.3, AUTO_SPACING_MIN]) {
          const s2 = fitAt(lh)
          usedLH = lh
          size = s2
          if (s2 >= floor) break
        }
      }
      el.style.lineHeight = String(usedLH)
      el.style.fontSize = `${size}px`
      setFontSize(size)
      setLineHeight(usedLH)
    }

    fit()
    const ro = new ResizeObserver(fit)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ref, fontSize, lineHeight }
}
