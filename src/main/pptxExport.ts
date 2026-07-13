// Render a whole session to a PowerPoint (.pptx) deck — one image slide per
// SlideContent, captured from the same <Stage> the audience output uses, so the
// export is pixel-faithful (Telugu, composed layouts, exact look).
//
// A hidden 1920×1080 window loads output.html?export=1 (the ExportHost). We push
// each slide's LiveState into it, wait for it to settle (fonts + media), grab the
// frame with capturePage(), and pack the PNGs with buildPptx().

import { BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import type { LiveState, PptxExportRequest } from '../shared/types'
import { buildPptx } from './pptxWrite'

/** Flatten every item's slides into per-slide LiveStates, in program order. A
 *  slide's own background wins (Stage handles that); otherwise the session's. */
function slideStates(req: PptxExportRequest): LiveState[] {
  const states: LiveState[] = []
  for (const it of req.items) {
    for (const slide of it.slides) {
      states.push({
        slide,
        background: req.background,
        blackout: false,
        clearText: false,
        showLogo: false,
        theme: req.theme
      })
    }
  }
  return states
}

/** Poll the hidden page until the ExportHost has mounted and loaded its fonts. */
async function waitForReady(win: BrowserWindow, timeoutMs = 20_000): Promise<void> {
  const start = Date.now()
  for (;;) {
    const ready = await win.webContents
      .executeJavaScript(
        'typeof window.__lumenRenderSlide === "function" && window.__lumenReady === true'
      )
      .catch(() => false)
    if (ready) return
    if (Date.now() - start > timeoutMs) throw new Error('export renderer did not become ready')
    await new Promise((r) => setTimeout(r, 60))
  }
}

export interface ExportOptions {
  /** absolute path to the preload script (unused by the host but harmless) */
  preloadPath: string
  /** output.html?export=1 url (dev server or file) */
  exportUrl: string
  onProgress?: (done: number, total: number) => void
}

export async function exportSessionToPptx(
  req: PptxExportRequest,
  outPath: string,
  opts: ExportOptions
): Promise<{ count: number }> {
  const states = slideStates(req)
  if (states.length === 0) throw new Error('nothing to export — the session has no slides')

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: true,
    show: false,
    webPreferences: {
      preload: opts.preloadPath,
      // Keep painting + timers alive while hidden so capturePage() gets a real
      // frame and the RAF-based settle in ExportHost actually fires.
      backgroundThrottling: false,
      offscreen: false
    }
  })

  try {
    await win.loadURL(opts.exportUrl)
    await waitForReady(win)

    const pngs: Uint8Array[] = []
    for (let i = 0; i < states.length; i++) {
      // executeJavaScript awaits the returned promise, so this resolves only once
      // the slide has fully painted + its media loaded.
      await win.webContents.executeJavaScript(
        `window.__lumenRenderSlide(${JSON.stringify(states[i])})`
      )
      const image = await win.webContents.capturePage()
      pngs.push(image.toPNG())
      opts.onProgress?.(i + 1, states.length)
    }

    const pptx = buildPptx(pngs)
    await writeFile(outPath, Buffer.from(pptx))
    return { count: states.length }
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/** Build the export url from the app's renderer url (adds ?export=1). */
export function exportUrlFrom(rendererOutputUrl: string): string {
  const sep = rendererOutputUrl.includes('?') ? '&' : '?'
  return `${rendererOutputUrl}${sep}export=1`
}

/** Convenience for callers that only have __dirname to the built main bundle. */
export function preloadPathFrom(mainDir: string): string {
  return join(mainDir, '../preload/index.js')
}
