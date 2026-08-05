// PDF import — rasterize a picked PDF into presentable slides.
//
// A PDF is a visual document (a song sheet, a bulletin, an order of service, a
// deck someone exported): the faithful way to "present" it is to show each page
// as it is, not to guess at its text. So we rasterize every page to a PNG and
// make it a full-page image slide (shown `contain` on the black stage — the
// classic "document on screen" look), which then flows through the very same
// live-output, preview, thumbnail, broadcast and save machinery as any other
// media slide.
//
// This runs in the renderer on purpose: rasterizing needs a canvas, and the Node
// main process has none — adding a native canvas (LibreOffice / poppler / node-
// canvas) would break this app's deliberately pure-JS, tool-free import path (see
// pptx.ts). pdf.js is pure JS; here it renders each page to an offscreen DOM
// canvas, and the resulting PNG bytes are handed back to main (savePdfPage) to be
// written into the app's pdf-cache — so a saved service references each page by
// file path, small in JSON, exactly like an imported .pptx image.

import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFPageProxy } from 'pdfjs-dist'
import type { PdfFile, SlideContent } from '@shared/types'
import { uid } from '../store/useStore'
import { pdfPageSlide } from './slides'

// The worker is bundled by Vite and served same-origin, so it loads under the
// app's strict `default-src 'self'` CSP (a blob-url worker would be blocked).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Longest raster edge, in px. Enough for a projector without huge page PNGs. */
const MAX_EDGE = 2000

export interface PdfDeck {
  /** file name without the .pdf extension, used to title the item + label pages */
  name: string
  slides: SlideContent[]
}

/** file name -> a filesystem-safe, unique key for its cached page images. */
function deckKey(name: string): string {
  const safe = name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'pdf'
  return `${safe}-${uid()}`
}

/** Render one page to PNG bytes, on a white page so `contain` reads as paper. */
async function pageToPng(page: PDFPageProxy): Promise<Uint8Array> {
  const unit = page.getViewport({ scale: 1 })
  const longest = Math.max(unit.width, unit.height) || 1
  const scale = Math.min(4, Math.max(0.1, MAX_EDGE / longest))
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(viewport.width))
  canvas.height = Math.max(1, Math.ceil(viewport.height))

  await page.render({ canvas, viewport, background: '#ffffff' }).promise

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  // Free the backing store now rather than waiting on GC — a long PDF would
  // otherwise hold every page's bitmap at once.
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('Could not rasterize a PDF page.')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Rasterize one PDF into a deck of image slides, persisting each page image via
 * the main process. `onPage(done, total)` fires after each page so the operator
 * sees progress on a long document.
 */
export async function renderPdfDeck(
  file: PdfFile,
  onPage?: (done: number, total: number) => void
): Promise<PdfDeck> {
  const name = file.name.replace(/\.pdf$/i, '')
  const key = deckKey(name)
  // getDocument may detach the buffer it is given; hand it a private copy so the
  // caller's PdfFile stays intact (and re-importing the same pick can't fail).
  const doc = await pdfjs.getDocument({ data: file.data.slice() }).promise
  try {
    const total = doc.numPages
    const slides: SlideContent[] = []
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i)
      try {
        const png = await pageToPng(page)
        const url = await window.lumen.savePdfPage(key, i, png)
        slides.push(pdfPageSlide(url, name, i, total))
      } finally {
        page.cleanup()
      }
      onPage?.(i, total)
    }
    return { name, slides }
  } finally {
    await doc.destroy()
  }
}
