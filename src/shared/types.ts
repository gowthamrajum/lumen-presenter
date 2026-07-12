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
  /**
   * Full-bleed image layers drawn above the background (in order), below the
   * live text. Used by PowerPoint import for pre-rendered photo + text-PNG
   * slides so the baked-in words are preserved.
   */
  overlays?: string[]
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

/** One slide extracted from an imported PowerPoint (.pptx) deck. */
export interface ImportedSlide {
  /** 1-based position in the source deck */
  index: number
  /** text lines pulled from the slide's shapes, in reading order */
  lines: string[]
  /**
   * lumen-media:// url of the slide's bottom-most background image, resolved
   * through the slide -> layout -> master inheritance chain. Beats color.
   */
  backgroundUrl?: string
  /**
   * Additional full-bleed image layers stacked above the background, in paint
   * order. Decks that pre-render slides use a photo + a transparent text PNG;
   * both must be drawn to keep the words.
   */
  overlayUrls?: string[]
  /** hex background color (e.g. from the master/theme) when there's no image */
  backgroundColor?: string
}

/** The result of importing a single .pptx file. */
export interface PptxImport {
  /** source file name without extension, used to label slides */
  name: string
  slides: ImportedSlide[]
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
