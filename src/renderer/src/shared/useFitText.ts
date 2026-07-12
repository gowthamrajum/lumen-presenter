import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Returns a container ref and a font size (px) that is the largest size at
 * which `content` fits inside the container without overflowing. Re-fits on
 * container resize and whenever `deps` change.
 */
export function useFitText(
  deps: unknown[],
  opts: { min?: number; max?: number; scale?: number } = {}
): { ref: React.RefObject<HTMLDivElement>; fontSize: number } {
  const { min = 12, max = 4000, scale = 1 } = opts
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

      let lo = min
      let hi = Math.min(max, availH)
      // binary search for the largest size that fits the box
      for (let i = 0; i < 18 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2
        el.style.fontSize = `${mid}px`
        const fits = el.scrollWidth <= availW + 1 && el.scrollHeight <= availH + 1
        if (fits) lo = mid
        else hi = mid
      }
      // apply the user's size bias on top of the natural fit
      const finalSize = Math.max(min, lo * scale)
      el.style.fontSize = `${finalSize}px`
      setFontSize(finalSize)
    }

    fit()
    const ro = new ResizeObserver(fit)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ref, fontSize }
}
