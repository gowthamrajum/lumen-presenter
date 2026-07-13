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

export type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

export interface Background {
  type: BackgroundType
  /**
   * hex color for 'color'; any CSS background/gradient string for 'gradient';
   * a lumen-media:// url for image/video.
   */
  value: string
  fit?: 'cover' | 'contain'
  /** optional motion for color/gradient backgrounds (CSS anim id, e.g. 'aurora') */
  anim?: string
}

export type SlideKind = 'text' | 'scripture' | 'media' | 'blank' | 'countdown' | 'clock'

/**
 * A freely-positioned text line on the slide composer's 960×540 reference
 * canvas. x/y are the CENTER of the line; the renderer scales the whole canvas
 * to any output size. Produced by the composer and by songs sent to Canvas.
 */
export interface ComposedLine {
  id: string
  text: string
  /** center x on the 960-wide reference canvas */
  x: number
  /** center y on the 540-tall reference canvas */
  y: number
  /** font size in reference-canvas pixels (of 540 tall) */
  fontSize: number
  color?: string
  align?: 'left' | 'center' | 'right'
  /** lines sharing a stanzaId move together in the composer's stanza mode */
  stanzaId?: string | null
}

export interface SlideContent {
  id: string
  kind: SlideKind
  /** small label shown in the operator grid, e.g. "Verse 1" or "John 3:16" */
  label?: string
  /** body lines shown large on the audience screen */
  lines: string[]
  /** for kind 'countdown': epoch ms the output counts down to (ticks locally) */
  countdownTo?: number
  /** for kind 'countdown': the duration in minutes, so a reopened service can
   *  re-arm a fresh target instead of showing an expired 0:00 */
  countdownMinutes?: number
  /** optional caption shown above a countdown/clock */
  message?: string
  /** small caption rendered at the bottom of the audience screen */
  caption?: string
  /** optional per-slide background overriding the global background */
  background?: Background
  /** freely-positioned composed layout (from the Slide Composer / songs to Canvas);
   *  when present, the renderer draws these instead of the auto-fit `lines` */
  composed?: ComposedLine[]
  /**
   * Full-bleed image layers drawn above the background (in order), below the
   * live text. Used by PowerPoint import for pre-rendered photo + text-PNG
   * slides so the baked-in words are preserved.
   */
  overlays?: string[]
}

export interface LiveState {
  slide: SlideContent | null
  /** the following slide, for the stage-display confidence monitor */
  next?: SlideContent | null
  /** true when the live item is marked no-broadcast: local output shows it, but
   *  the web relay must suppress it (see the main-process publisher) */
  noBroadcast?: boolean
  /** true when the NEXT slide belongs to a no-broadcast item, so the relay drops
   *  `next` (the local stage monitor still shows it) */
  nextNoBroadcast?: boolean
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

/** A screen's assigned output layout. Each connected display can host one. */
export type ScreenRole = 'off' | 'audience' | 'stage'

/** Status of a display currently showing output. */
export interface ScreenInfo {
  displayId: number
  role: ScreenRole
  /** true when it opened as a movable window (shares the operator's screen) */
  windowed: boolean
}

/** The kind of a service item, used for its badge/icon in the program view. */
export type ItemKind =
  | 'scripture'
  | 'song'
  | 'text'
  | 'media'
  | 'video'
  | 'ppt'
  | 'blank'
  | 'countdown'

/** A titled group of slides within a service (e.g. one imported PowerPoint,
 *  a video, a scripture reading, or a song). */
export interface ServiceItem {
  id: string
  title: string
  kind: ItemKind
  slides: SlideContent[]
  /** when true, this item is shown locally but never sent to the web broadcast
   *  (e.g. a break, or live Praise & Worship you don't want on the stream) */
  noBroadcast?: boolean
}

/** A worship service / setlist: an ordered collection of items plus the look
 *  it was saved with. Persisted to disk so it survives restarts. */
export interface Service {
  id: string
  name: string
  savedAt?: string
  items: ServiceItem[]
  background?: Background
  theme?: ThemeStyle
}

/** Lightweight service listing (no slide payloads). */
export interface ServiceMeta {
  id: string
  name: string
  savedAt?: string
  itemCount: number
}

// ---- songs ----
export type SongSectionKind =
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'bridge'
  | 'tag'
  | 'intro'
  | 'ending'
  | 'other'

export interface SongSection {
  id: string
  kind: SongSectionKind
  /** display label, e.g. "Verse 1", "Chorus" */
  label: string
  /** lyric lines for this section (split into slides by linesPerSlide) */
  lines: string[]
}

export interface Song {
  id: string
  title: string
  author?: string
  ccli?: string
  sections: SongSection[]
  /** ordered section ids defining play order; empty/absent = sections order */
  arrangement?: string[]
  /** lyric lines per slide (default 2) */
  linesPerSlide?: number
  savedAt?: string
}

/** Lightweight song listing (no lyric payloads). */
export interface SongMeta {
  id: string
  title: string
  author?: string
  savedAt?: string
}

/** Song shape returned by the remote songs backend (Telugu catalog). */
export interface RemoteStanza {
  stanza_number?: number
  telugu?: string[]
  english?: string[]
}
export interface RemoteSong {
  song_id: number
  song_name: string
  main_stanza?: { telugu?: string[]; english?: string[] }
  stanzas?: RemoteStanza[]
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

// ---- web broadcast (OBS) ----
/** Operator config for broadcasting live state to the web relay (for OBS). */
export interface BroadcastConfig {
  enabled: boolean
  /** relay base, e.g. https://grey-gratis-ice.onrender.com */
  base: string
  /** channel slug (auto-generated once so installs don't collide) */
  room: string
}

/** Live status of the broadcast publisher, pushed to the control window. */
export interface BroadcastStatus {
  enabled: boolean
  /** true once the last publish succeeded */
  ok: boolean
  /** epoch ms of the last successful publish, or null */
  lastAt: number | null
  /** last error message, or null */
  lastError: string | null
  /** server revision counter returned by the relay */
  rev: number
}

export const DEFAULT_THEME: ThemeStyle = {
  fontFamily: `'Anek Telugu', 'Inter', 'Helvetica Neue', Arial, sans-serif`,
  textColor: '#ffffff',
  captionColor: '#ffd27f',
  fontScale: 1,
  textAlign: 'center',
  shadow: true,
  uppercase: false,
  scrim: 0.35
}

export const DEFAULT_BACKGROUND: Background = {
  type: 'gradient',
  value: 'radial-gradient(circle at 50% 28%, #3a2b6b 0%, #1c1440 55%, #0a0720 100%)',
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
