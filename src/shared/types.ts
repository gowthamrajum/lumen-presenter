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
  /**
   * Line spacing (CSS line-height) for slide body text — **the Go Live audience
   * screen only**. Deliberately local: the operator previews, slide thumbnails
   * and the stage monitor render at DEFAULT_LINE_SPACING, and the publisher
   * strips this field from the relay payload so the web audience mirror, the OBS
   * lower-third and the phone remote keep their own spacing. Undefined on themes
   * saved before this existed — read it through GO_LIVE_LINE_SPACING so an older
   * service still gets the roomier projector default.
   */
  lineSpacing?: number
}

/** Slide-text line-height for the compact surfaces: the operator previews, the
 *  stage monitor, the PowerPoint export — and, via the relay, the Cantica Web
 *  mirror and the OBS lower third. Phones and a YouTube overlay want the lines
 *  close together. Was hard-coded in Stage before `lineSpacing`. */
export const DEFAULT_LINE_SPACING = 1.22

/**
 * Slide-text line-height the Go Live screen starts at. Held at the compact value
 * on purpose: because the text is auto-fitted, every step of extra air is paid
 * for directly in size. Measured on a 4-line bilingual song slide —
 *
 *   spacing  1.00  1.10  1.22  1.40  1.60
 *   font px  47.6  45.4  42.2  37.0  32.8
 *
 * — so defaulting the projector to a roomier value made its text SMALLER than
 * the phone mirror's. The Spacing slider is there for an operator who wants that
 * trade on a given service; it should not be made silently.
 */
export const GO_LIVE_LINE_SPACING = DEFAULT_LINE_SPACING

/**
 * How large a section heading may get, against the normal ceiling — see
 * SlideContent.textScale. Two short lines at full size are bound only by the
 * height of the screen, so "వాక్యోపదేశం / Sermon" grows until it fills it edge
 * to edge; at this it sits in the middle of the slide with air around it.
 * Measured on the output window, not guessed.
 */
export const SECTION_TEXT_SCALE = 0.55

export type BackgroundType = 'color' | 'gradient' | 'image' | 'video' | 'audio' | 'youtube'

export interface Background {
  type: BackgroundType
  /**
   * hex color for 'color'; any CSS background/gradient string for 'gradient';
   * a lumen-media:// (or http) url for image/video/audio; an 11-char YouTube
   * video id for 'youtube'. An 'audio' background has no picture — the slide
   * keeps whatever it would have shown, and the sound plays over it. A 'youtube'
   * background plays the video as an embed on the audience screen (a poster
   * still stands in on the operator's previews).
   */
  value: string
  fit?: 'cover' | 'contain'
  /** optional motion for color/gradient backgrounds (CSS anim id, e.g. 'aurora') */
  anim?: string
}

/** Where a playing clip has got to, reported by the window that is playing it. */
export interface MediaState {
  /** seconds played */
  t: number
  /** seconds long, or 0 while it is still being read */
  duration: number
  paused: boolean
  /** 0–100, or undefined where the player hasn't said yet */
  volume?: number
  muted?: boolean
}

/** What the operator's transport asks of it. */
export interface MediaCommand {
  cmd: 'play' | 'pause' | 'seek' | 'volume' | 'mute'
  /** seconds for 'seek'; 0–100 for 'volume'; 1/0 for 'mute' */
  value?: number
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
  /** for kind 'countdown': epoch ms the output counts down to (ticks locally).
   *  Set ONLY while the slide is live — a countdown runs on air and nowhere
   *  else, so it can't quietly expire in the schedule before you reach it. */
  countdownTo?: number
  /** for kind 'countdown': ms left while the slide is NOT live. The countdown
   *  holds here until the operator brings the slide back up. */
  countdownRemainMs?: number
  /** for kind 'countdown': the duration in minutes, so a reopened service (or a
   *  "Save & restart") can go back to a full count instead of a spent one */
  countdownMinutes?: number
  /** for kind 'clock': show seconds as well as the hour and minute */
  clockSeconds?: boolean
  /** for kind 'clock': IANA zone to read the time in, e.g. "Asia/Kolkata".
   *  Absent = whatever the machine showing the slide is set to. */
  clockTimeZone?: string
  /**
   * This slide moves on by itself after the verse hold, WITHIN its item: to the
   * next slide of the same item, or — from the last one — back to the item's
   * first slide. That is how a verse read during the sermon returns the screen
   * to the sermon card instead of walking on into the offerings.
   *
   * Item-level `autoAdvance` (a Bible passage added as its own section) is the
   * other rule: it reads straight through the service. See useVerseAutoAdvance.
   */
  autoAdvance?: boolean
  /** optional caption shown above a countdown/clock */
  message?: string
  /** small caption rendered at the bottom of the audience screen */
  caption?: string
  /**
   * Broadcast this ONE slide regardless of what its item says.
   *
   * An item's flags are the right granularity almost everywhere — a section
   * card is off-air, a song is on. The sermon is the exception: the card itself
   * is off the stream, but a verse quoted during it is the one thing a viewer
   * at home most needs, and a verse is appended INTO the sermon item so it
   * inherits the card's suppression. Undefined means "whatever the item says",
   * which is every other slide ever made.
   */
  broadcastUsers?: boolean
  broadcastStream?: boolean
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
  /** a line sitting directly above the QR, telling people what it's for.
   *  Separate from `lines`, which sit beside the code rather than over it. */
  qrLabel?: string
  /** render the text on a single line, shrinking to fit width instead of
   *  wrapping (used by bilingual title cards). */
  singleLine?: boolean
  /**
   * Shrink this slide's text against the normal ceiling: 1 is the usual size,
   * 0.5 is half of it. A two-word title card otherwise grows until the block
   * fills the screen edge to edge, which reads as shouting rather than as a
   * heading. Only the CEILING moves — long text is still bound by the space it
   * has, so this can make a slide smaller but never bigger than it would fit.
   */
  textScale?: number
}

/**
 * Milliseconds left on a countdown, whether it is running (`countdownTo`) or
 * held (`countdownRemainMs`). A slide that has never been on air has neither,
 * and shows its full configured duration.
 */
/**
 * The wall time a clock slide should show, formatted. A zone the platform
 * doesn't know (a hand-edited or imported service) falls back to local time
 * rather than throwing — a clock that is an hour wrong still beats a blank
 * screen mid-service.
 */
export function formatClock(slide: SlideContent, now: number): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  if (slide.clockSeconds) opts.second = '2-digit'
  if (slide.clockTimeZone) {
    try {
      return new Date(now).toLocaleTimeString([], { ...opts, timeZone: slide.clockTimeZone })
    } catch {
      /* unknown zone — fall through to local */
    }
  }
  return new Date(now).toLocaleTimeString([], opts)
}

/** "Asia/Kolkata" -> "Kolkata", for labelling a clock slide by its zone. */
export function timeZoneLabel(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ')
}

export function countdownRemaining(slide: SlideContent, now: number): number {
  if (slide.countdownTo != null) return Math.max(0, slide.countdownTo - now)
  if (slide.countdownRemainMs != null) return Math.max(0, slide.countdownRemainMs)
  return (slide.countdownMinutes ?? 0) * 60_000
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
  /** The live item is a clip to be HEARD, not a backdrop: the audience output
   *  unmutes it, it plays once instead of looping, and the service moves on when
   *  it ends. Off (silent, looping) unless the operator turns it on. */
  sound?: boolean
  /** global/stage background, used when a slide has no background of its own */
  background: Background
  blackout: boolean
  /** hide text but keep the background visible */
  clearText: boolean
  showLogo: boolean
  theme: ThemeStyle
  /** Lyric-free outline of the whole service for the audience app's "Order" tab:
   *  one entry per schedule item, with the one owning the live slide flagged.
   *  `count` is how many slides the item plays and `nth` how far into the live
   *  one we are, so the phone operator's drawer can say "3/10" — deciding
   *  whether to jump needs the size of what you are jumping into. Counts, not
   *  words: still lyric-free. */
  order?: Array<{
    id: string
    title: string
    kind: ItemKind
    live: boolean
    count?: number
    nth?: number
  }>
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
  | 'pdf'
  | 'blank'
  | 'countdown'

/** A titled group of slides within a service (e.g. one imported PowerPoint,
 *  a video, a scripture reading, or a song). */
/**
 * A service built on the web (cantica-web's Service Builder) and kept on the
 * relay. Cantica lists these so Sunday's songs can be pulled in without a file
 * changing hands, and re-pulled when whoever built it changes their mind.
 */
export interface RemoteService {
  id: number
  /** the gathering, e.g. "Sunday Morning" — unique per date on the relay */
  serviceDay: string
  /** YYYY-MM-DD */
  serviceDate: string
  createdDateTime: string
  /** bumped on every edit; this is what tells Cantica the deck moved on */
  updatedDateTime: string
  /** characters of stored deck — the list endpoint's cheap size hint */
  serviceDataLength?: number
}

/** Asking the relay for one service has three answers, not two: here it is, it
 *  has been deleted, or the relay could not be reached. */
export type RemoteServiceResult =
  | { status: 'ok'; service: RemoteService & { serviceData: unknown } }
  | { status: 'gone' }
  | { status: 'unreachable' }

/**
 * Publishing this session to the relay, so the phone can see it.
 *
 * `taken` is not a failure: the relay keys a service on (date, day) and one
 * already sits on that slot. It is handed back whole, because the only useful
 * next question — "replace the service built on the web?" — needs to name what
 * would be replaced.
 */
export type RemotePublishResult =
  | { status: 'ok'; service: RemoteService; created: boolean }
  | { status: 'taken'; existing: RemoteService }
  | { status: 'unreachable'; message?: string }
  | { status: 'error'; message: string }

/** The web service an imported item came from, and the version it came from. */
export interface ItemSource {
  serviceId: number
  updatedAt: string
  /** the slot it was filed under, kept so a later version of the same service
   *  can be matched against it item for item */
  slot?: 'worship' | 'offering' | 'communion' | 'media'
}

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
  /** When live, this item's verse auto-advances to the Sermon slide after a TTL.
   *  Set on Bible passages only (not psalms / responsive readings). */
  autoAdvance?: boolean
  /** Play this item's video with sound on the audience screen. A video is a
   *  BACKDROP by default — silent and looping — so this is what turns one into a
   *  clip: unmuted, played once, and followed by the next item. Never set by
   *  default; the operator turns it on per item. */
  sound?: boolean
  /** Which web-built service this item came from, so a later edit of that
   *  service can replace exactly these items and leave the rest of the order
   *  alone. Absent on anything built inside Cantica. */
  source?: ItemSource
  /**
   * Where an IMPORTED item wants to land in an order that already exists —
   * "worship" between the clock and Sunday School, "communion" after the Sermon
   * and before the Offerings card, "offering" against the Offerings card,
   * "media" just before the announcements.
   * Written by the Service Builder, consumed and dropped by the importer, so it
   * never appears in a service Cantica itself saved.
   */
  slot?: 'worship' | 'offering' | 'communion' | 'media'
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
  /** The relay row this service was published to, if it has been. Kept with the
   *  service so reopening it a week later still updates that copy rather than
   *  colliding with it. */
  publishedTo?: { id: number; day: string; date: string } | null
}

/** Portable service backup: the whole deck as a versioned JSON envelope, written
 *  to / read from a file. Kept deliberately clean + versioned so another tool
 *  (e.g. worshipReady) can produce/consume it later. */
export interface ServiceExport {
  format: 'cantica-service'
  version: 1
  exportedAt: string
  service: {
    name: string
    items: ServiceItem[]
    background?: Background
    theme?: ThemeStyle
  }
  /** OBS lower-third size/style (text size, position, colors, band). Included so a
   *  backup restores the OBS look too; the room slug + control PIN are deliberately
   *  NOT exported (install-specific, unrelated to the deck). */
  obsStyle?: ObsStyle
}

export interface ServiceExportResult {
  ok: boolean
  path?: string
  /** number of slides written into the exported service JSON */
  count?: number
  canceled?: boolean
  error?: string
}

export interface ServiceImportResult {
  ok: boolean
  service?: Service
  /** OBS style from the file, if present (applied to the broadcast config on import) */
  obsStyle?: ObsStyle
  canceled?: boolean
  error?: string
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
  /**
   * Operator-chosen slide grouping, as a count of UNITS per slide. A unit is one
   * lyric line — except in a bilingual section, where it is a Telugu line
   * together with its English transliteration, so a grouping can never split a
   * pair. Absent (the default) = the automatic split by linesPerSlide.
   * Ignored if it no longer sums to the section's unit count (the lines were
   * edited underneath it), which falls back to the automatic split.
   */
  groups?: number[]
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
  /** the song's first Telugu line — the title as the congregation knows it,
   *  shown under the transliterated name in the library list */
  telugu?: string
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
  /** lumen-media:// url usable directly in img/video/audio src */
  url: string
  isVideo: boolean
  isAudio: boolean
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

// ---- PDF import ----
/**
 * A PDF the operator picked, handed to the renderer as raw bytes. A PDF is
 * rasterized page-by-page in the renderer (where a canvas exists — the Node main
 * process has none, and this repo deliberately ships no native tooling), then
 * each page PNG is written back to the app's pdf-cache via savePdfPage. That keeps
 * the import path pure-JS, mirroring the .pptx importer.
 */
export interface PdfFile {
  /** original file name including the .pdf extension */
  name: string
  /** the file's bytes */
  data: Uint8Array
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
  /**
   * The senior PIN. Claims the operator seat even when somebody is holding it.
   *
   * Two levels because there are two kinds of person driving: a volunteer given
   * the ordinary PIN for the morning, and whoever is responsible for the
   * service. The second needs to be able to take over without finding the first
   * one's phone — which by then is usually in a pocket.
   */
  masterPin?: string
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
  // lineSpacing intentionally absent: the Go Live screen spaces itself.
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
