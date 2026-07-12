import type { Background, SlideContent } from '@shared/types'
import type { BibleVerse } from '@shared/bible'
import { referenceOf } from '@shared/bible'
import { uid } from '../store/useStore'

/** One slide per verse, with the reference as the caption. */
export function scriptureSlides(verses: BibleVerse[]): SlideContent[] {
  return verses.map((v) => ({
    id: uid(),
    kind: 'scripture',
    label: referenceOf(v),
    lines: [v.text],
    caption: referenceOf(v)
  }))
}

/**
 * Free text -> slides. Blank lines separate slides; single newlines separate
 * lines within a slide.
 */
export function textSlides(text: string, label = 'Text'): SlideContent[] {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  const src = blocks.length ? blocks : ['']
  return src.map((block, i) => ({
    id: uid(),
    kind: 'text',
    label: blocks.length > 1 ? `${label} ${i + 1}` : label,
    lines: block.split('\n')
  }))
}

/** A media-only slide: just a background (image/video), no text. */
export function mediaSlide(url: string, name: string, isVideo: boolean): SlideContent {
  const background: Background = { type: isVideo ? 'video' : 'image', value: url, fit: 'cover' }
  return { id: uid(), kind: 'media', label: name, lines: [], background }
}

/** A blank slide with a solid color (useful as an intentional interstitial). */
export function blankSlide(color = '#000000'): SlideContent {
  return {
    id: uid(),
    kind: 'blank',
    label: 'Blank',
    lines: [],
    background: { type: 'color', value: color }
  }
}
