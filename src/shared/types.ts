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
  /**
   * Optional QR code (image URL or data-URL) shown beside the text — e.g. the
   * giving/offering QR. Rendered on a light card so it scans on any background,
   * on both the local output and the web broadcast.
   */
  qr?: string
  /** render the text on a single line, shrinking to fit width instead of
   *  wrapping (used by bilingual title cards). */
  singleLine?: boolean
}

export interface LiveState {
  slide: SlideContent | null
  /** the following slide, for the stage-display confidence monitor */
  next?: SlideContent | null
  /** Per-channel broadcast suppression for the LIVE item. Local output always
   *  shows the slide; these only gate the web relay (see the main publisher),
   *  independently for the User (audience mirror) and Stream (OBS) views. */
  noBroadcastUsers?: boolean
  noBroadcastStream?: boolean
  /** Same, for the item owning the NEXT slide, so the relay can drop `next`
   *  per-channel (the local stage monitor still shows it). */
  nextNoBroadcastUsers?: boolean
  nextNoBroadcastStream?: boolean
  /** global/stage background, used when a slide has no background of its own */
  background: Background
  blackout: boolean
  /** hide text but keep the background visible */
  clearText: boolean
  showLogo: boolean
  theme: ThemeStyle
  /** Lyric-free outline of the whole service for the audience app's "Order" tab:
   *  one entry per schedule item, with the one owning the live slide flagged. */
  order?: Array<{ id: string; title: string; kind: ItemKind; live: boolean }>
  /** The service's name, so the broadcast directory can label a session by the
   *  service rather than by whatever slide happens to be live. */
  name?: string
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
  /** Per-channel web-broadcast suppression. The item always shows on the local
   *  output; these hide it from the web relay independently for the User
   *  (audience) view and the Stream (OBS) view. Both true = fully off-air (red);
   *  one true = partial (yellow); neither = on all (green). */
  noBroadcastUsers?: boolean
  noBroadcastStream?: boolean
  /** @deprecated legacy single flag (both channels). Read via the helpers;
   *  normalized to the two fields above when a saved service is opened. */
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
  /** section lines are pre-arranged as bilingual blocks (2 Telugu lines then their
   *  2 English lines per slide); slide splitting then chunks plainly, without the
   *  single-language repeat-grouping. */
  bilingual?: boolean
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

/** A bilingual psalm verse (Telugu OV + English). */
export interface PsalmVerse {
  id: number
  chapter: number
  verse: number
  telugu: string
  english: string
}

/** Which English text is used for the Psalms: bundled WEBBE (offline, public
 *  domain) or the ESV (fetched on demand via the Crossway API). */
export type PsalmEnglish = 'webbe' | 'esv'

/** Result of a Psalms lookup. `english` is what actually got used (an ESV
 *  request can fall back to WEBBE — `notice` explains when it does). */
export interface PsalmsResult {
  verses: PsalmVerse[]
  english: PsalmEnglish
  notice?: string
}
export interface PsalmsError {
  error: string
  /** true when the ESV needs an API key to be entered */
  needKey?: boolean
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

// ---- PowerPoint export ----
/** A whole session handed to the main process to render + pack into a .pptx.
 *  One slide per SlideContent, captured exactly as the audience output shows it. */
export interface PptxExportRequest {
  /** used for the default file name */
  name: string
  items: ServiceItem[]
  /** global/stage background for slides without their own */
  background: Background
  theme: ThemeStyle
}

/** Progress of a running export, pushed to the control window. */
export interface PptxExportProgress {
  done: number
  total: number
}

/** Result of an export attempt (canceled when the operator dismisses the save dialog). */
export interface PptxExportResult {
  ok: boolean
  path?: string
  count?: number
  canceled?: boolean
  error?: string
}

// ---- web broadcast (OBS) ----
/** How the OBS lower-third lyrics are styled and sized. Flows through the
 *  broadcast state (as a shared field) so the operator can adjust it live and the
 *  OBS Browser source updates instantly — it only affects the transparent OBS
 *  overlay, never the local output or the audience mirror. */
export interface ObsStyle {
  /** lower-third base text size in cqh of the 16:9 frame (≈3 small … 9 huge) */
  size: number
  /** where the lyrics band sits vertically */
  position: 'bottom' | 'center' | 'top'
  /** main lyric text color */
  textColor: string
  /** color for the small reference caption (e.g. "John 3:16") */
  accentColor: string
  /** render lyrics in ALL CAPS */
  uppercase: boolean
  /** dark gradient behind the text for legibility over any video */
  scrim: boolean
}

/** Operator config for broadcasting live state to the web relay (for OBS). */
export interface BroadcastConfig {
  enabled: boolean
  /** relay base, e.g. https://grey-gratis-ice.onrender.com */
  base: string
  /** channel slug (auto-generated once so installs don't collide) */
  room: string
  /** short PIN a phone remote must supply to drive this room's live slides
   *  (auto-generated once; regenerate to revoke). Paired with the unguessable
   *  room slug. */
  controlPin?: string
  /** styling for the OBS lower-third (size/position/colors); applied live. */
  obsStyle?: ObsStyle
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

export const DEFAULT_OBS_STYLE: ObsStyle = {
  size: 5.2,
  position: 'bottom',
  textColor: '#ffffff',
  accentColor: '#ffd27f',
  uppercase: false,
  // Off by default: the OBS overlay is fully transparent (text only, with its own
  // shadow/outline for legibility). Turn the shaded band on for busy footage.
  scrim: false
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
