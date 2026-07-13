import { useEffect, useRef, useState } from 'react'
import type { LiveState } from '@shared/types'
import { Stage } from '../shared/Stage'

/**
 * Offscreen render surface for the PowerPoint export. Loaded in a hidden 1920×1080
 * window via `output.html?export=1`. The main process drives it one slide at a
 * time through `window.__lumenRenderSlide(state)`, which resolves only once the
 * slide has painted and its fonts / background media have loaded — so the
 * subsequent `capturePage()` is a faithful, fully-settled frame.
 *
 * It renders the very same <Stage> the audience output uses, so what a viewer
 * sees on the projector is exactly what lands in the .pptx.
 */
export function ExportHost(): JSX.Element {
  const [state, setState] = useState<LiveState | null>(null)
  const resolveRef = useRef<null | (() => void)>(null)

  // Expose the imperative render entry + a readiness flag the main process polls.
  useEffect(() => {
    const w = window as unknown as {
      __lumenRenderSlide?: (s: LiveState) => Promise<void>
      __lumenReady?: boolean
    }
    w.__lumenRenderSlide = (s: LiveState) =>
      new Promise<void>((resolve) => {
        resolveRef.current = resolve
        setState(s)
      })

    // Force the Telugu + Latin faces to load before we report ready, so the very
    // first slide's auto-fit measures real glyph metrics (not a fallback font).
    const markReady = (): void => {
      w.__lumenReady = true
    }
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) {
      Promise.all([
        fonts.load('700 48px "Anek Telugu"', 'కీర్తన ఆరాధన Aa'),
        fonts.load('400 48px "Anek Telugu"', 'కీర్తన ఆరాధన Aa')
      ])
        .catch(() => undefined)
        .then(() => fonts.ready)
        .then(markReady, markReady)
    } else {
      markReady()
    }

    return () => {
      w.__lumenRenderSlide = undefined
    }
  }, [])

  // Once a new slide commits, wait for layout + background images/videos, then a
  // final frame, before resolving the pending render promise.
  useEffect(() => {
    if (!state || !resolveRef.current) return
    const resolve = resolveRef.current
    resolveRef.current = null
    let cancelled = false

    // Two RAFs guarantee React has committed and the browser has laid out +
    // painted the new slide (useFitText runs synchronously in a layout effect).
    const afterPaint = (fn: () => void): void => {
      requestAnimationFrame(() => requestAnimationFrame(fn))
    }

    afterPaint(async () => {
      const root = document.getElementById('root')
      if (root) {
        const imgs = Array.from(root.querySelectorAll('img'))
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((r) => {
                  img.onload = img.onerror = (): void => r()
                })
          )
        )
        const vids = Array.from(root.querySelectorAll('video'))
        await Promise.all(
          vids.map((v) =>
            v.readyState >= 2
              ? Promise.resolve()
              : new Promise<void>((r) => {
                  const t = setTimeout(() => r(), 1200)
                  v.onloadeddata = (): void => {
                    clearTimeout(t)
                    r()
                  }
                  v.onerror = (): void => {
                    clearTimeout(t)
                    r()
                  }
                })
          )
        )
      }
      // One more frame so any late layout (image decode, fit) is on screen.
      requestAnimationFrame(() => {
        if (!cancelled) resolve()
      })
    })

    return () => {
      cancelled = true
    }
  }, [state])

  return state ? <Stage state={state} /> : <div />
}
