import type { ThemeStyle } from './types'

/**
 * How slide text stands off its background.
 *
 * A thin, solid black OUTLINE by default — the church's choice once motion
 * backgrounds arrived: a soft shadow reads on a dark still, and fades into a
 * bright or busy video. Sharp, opaque copies of the text in a ring around it
 * (16 directions, plus an inner 8 to close the gaps on tight curves), sized in
 * em so the outline keeps its proportion at any size — not -webkit-text-stroke,
 * which straddles the glyph edge and eats into Telugu's thin strokes.
 *
 * Outline only: with it on, the shadow is not drawn as well (the two together
 * look muddy). `outline` absent — every theme saved before it existed — is on.
 */
export const OUTLINE_TEXT_SHADOW = '0.04em 0em 0 #000, 0.037em 0.015em 0 #000, 0.028em 0.028em 0 #000, 0.015em 0.037em 0 #000, 0em 0.04em 0 #000, -0.015em 0.037em 0 #000, -0.028em 0.028em 0 #000, -0.037em 0.015em 0 #000, -0.04em 0em 0 #000, -0.037em -0.015em 0 #000, -0.028em -0.028em 0 #000, -0.015em -0.037em 0 #000, 0em -0.04em 0 #000, 0.015em -0.037em 0 #000, 0.028em -0.028em 0 #000, 0.037em -0.015em 0 #000, 0.022em 0em 0 #000, 0.016em 0.016em 0 #000, 0em 0.022em 0 #000, -0.016em 0.016em 0 #000, -0.022em 0em 0 #000, -0.016em -0.016em 0 #000, 0em -0.022em 0 #000, 0.016em -0.016em 0 #000'
/** The caption is smaller, so its outline is a touch heavier to match. */
export const OUTLINE_CAPTION_SHADOW = '0.06em 0em 0 #000, 0.055em 0.023em 0 #000, 0.042em 0.042em 0 #000, 0.023em 0.055em 0 #000, 0em 0.06em 0 #000, -0.023em 0.055em 0 #000, -0.042em 0.042em 0 #000, -0.055em 0.023em 0 #000, -0.06em 0em 0 #000, -0.055em -0.023em 0 #000, -0.042em -0.042em 0 #000, -0.023em -0.055em 0 #000, 0em -0.06em 0 #000, 0.023em -0.055em 0 #000, 0.042em -0.042em 0 #000, 0.055em -0.023em 0 #000, 0.033em 0em 0 #000, 0.023em 0.023em 0 #000, 0em 0.033em 0 #000, -0.023em 0.023em 0 #000, -0.033em 0em 0 #000, -0.023em -0.023em 0 #000, 0em -0.033em 0 #000, 0.023em -0.023em 0 #000'
export const SOFT_TEXT_SHADOW = '0 2px 18px rgba(0,0,0,0.65)'

export const outlineOn = (theme: Pick<ThemeStyle, 'outline'>): boolean => theme.outline !== false

/** The text-shadow for slide text under this theme. */
export function textEffect(theme: Pick<ThemeStyle, 'outline' | 'shadow'>): string {
  if (outlineOn(theme)) return OUTLINE_TEXT_SHADOW
  return theme.shadow ? SOFT_TEXT_SHADOW : 'none'
}
