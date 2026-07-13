import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Returns a container ref and a font size (px) chosen so the content fits the
 * container without overflowing, while never exceeding a sensible ceiling.
 *
 * The ceiling ("predictive sizing") is what keeps short slides — a single word
 * or a two-word line — from ballooning to fill the whole box and clipping their
 * glyph ink against the edges. Short text tops out at `maxFraction` of the
 * container height; only text too long to fit at that size is shrunk down. A
 * small safety inset keeps ink off the borders.
 */
export function useFitText(
  deps: unknown[],
  opts: { min?: number; max?: number; scale?: number; maxFraction?: number } = {}
): { ref: React.RefObject<HTMLDivElement>; fontSize: number } {
  const { min = 12, max = 4000, scale = 1, maxFraction = 0.4 } = opts
  const ref = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(48)

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

      let lo = min
      let hi = Math.max(min, cap)
      // Largest size that fits the box, bounded by the ceiling.
      for (let i = 0; i < 20 && hi - lo > 0.4; i++) {
        const mid = (lo + hi) / 2
        el.style.fontSize = `${mid}px`
        const fits = el.scrollWidth <= availW + 1 && el.scrollHeight <= targetH + 1
        if (fits) lo = mid
        else hi = mid
      }
      el.style.fontSize = `${lo}px`
      setFontSize(lo)
    }

    fit()
    const ro = new ResizeObserver(fit)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ref, fontSize }
}
