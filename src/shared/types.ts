// Shared contract between the main process, the operator (control) window,
// and the audience (output) window.

export interface ThemeStyle {
  fontFamily: string
  textColor: string
  /** color used for the small reference caption */
  captionColor: string
  /** base size multiplier for body text (1 = default) */
  fontScale: number
  textAlign: 'left' | 'center' | 'right'
  shadow: boolean
  uppercase: boolean
  /** 0..1 dark scrim over the background to keep text legible */
  scrim: number
}

export type BackgroundType = 'color' | 'image' | 'video'

export interface Background {
  type: BackgroundType
  /** hex color for 'color'; a lumen-media:// url for image/video */
  value: string
  fit?: 'cover' | 'contain'
}

export type SlideKind = 'text' | 'scripture' | 'media' | 'blank'

export interface SlideContent {
  id: string
  kind: SlideKind
  /** small label shown in the operator grid, e.g. "Verse 1" or "John 3:16" */
  label?: string
  /** body lines shown large on the audience screen */
  lines: string[]
  /** small caption rendered at the bottom of the audience screen */
  caption?: string
  /** optional per-slide background overriding the global background */
  background?: Background
}

export interface LiveState {
  slide: SlideContent | null
  /** global/stage background, used when a slide has no background of its own */
  background: Background
  blackout: boolean
  /** hide text but keep the background visible */
  clearText: boolean
  showLogo: boolean
  theme: ThemeStyle
}

export interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  primary: boolean
  internal: boolean
}

export interface OutputStatus {
  open: boolean
  displayId: number | null
}

export interface MediaFile {
  path: string
  name: string
  /** lumen-media:// url usable directly in img/video src */
  url: string
  isVideo: boolean
}

export const DEFAULT_THEME: ThemeStyle = {
  fontFamily: `'Inter', 'Helvetica Neue', Arial, sans-serif`,
  textColor: '#ffffff',
  captionColor: '#ffd27f',
  fontScale: 1,
  textAlign: 'center',
  shadow: true,
  uppercase: false,
  scrim: 0.35
}

export const DEFAULT_BACKGROUND: Background = {
  type: 'color',
  value: '#0b1020',
  fit: 'cover'
}

export const DEFAULT_LIVE: LiveState = {
  slide: null,
  background: DEFAULT_BACKGROUND,
  blackout: false,
  clearText: false,
  showLogo: false,
  theme: DEFAULT_THEME
}
