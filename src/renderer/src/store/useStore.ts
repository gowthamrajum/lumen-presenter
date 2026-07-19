import { create } from 'zustand'
import {
  DEFAULT_BACKGROUND,
  DEFAULT_THEME,
  type Background,
  type ComposedLine,
  type DisplayInfo,
  type ItemKind,
  type LiveState,
  type MediaFile,
  type ScreenInfo,
  type ScreenRole,
  type PptxImport,
  type Service,
  type ServiceExport,
  type ServiceExportResult,
  type ServiceImportResult,
  type ServiceItem,
  type ServiceMeta,
  type SlideContent,
  type Song,
  type SongMeta,
  type RemoteSong,
  type ThemeStyle
} from '@shared/types'
import { SERVICE_TEMPLATES } from '../control/templates'
import { loadSessionCache, saveSessionCache } from './sessionCache'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Re-arm countdown slides to a fresh target (relative to `now`) so a restored
 *  or reopened service doesn't show an expired 0:00; also migrates legacy
 *  broadcast flags. Shared by openService and the session-cache restore. */
function reArmItems(items: ServiceItem[], now: number): ServiceItem[] {
  return items.map((it) => ({
    ...normalizeBroadcast(it),
    slides: it.slides.map((sl) =>
      sl.kind === 'countdown' && sl.countdownMinutes != null
        ? { ...sl, countdownTo: now + sl.countdownMinutes * 60_000 }
        : sl
    )
  }))
}

/** Flipped true once init() has restored any cache, so the auto-save
 *  subscription doesn't fire during startup (or in a non-control window). */
let cacheReady = false
/** Last-persisted snapshot, shared by init() (to seed the baseline) and the
 *  auto-save subscription (to dedup). Seeding it after restore stops the first
 *  transient change from re-writing the session and re-stamping its TTL. */
let cacheLast = ''
/** Baseline for the disk auto-save dedup (content only). */
let autoSaveLast = ''

function sessionSnapshot(s: AppState): string {
  return JSON.stringify({
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    items: s.items,
    background: s.background,
    theme: s.theme
  })
}

/** Content key for disk auto-save dedup — deliberately excludes serviceId so the
 *  id assigned on the first save doesn't re-trigger another save. */
function contentSnapshot(s: AppState): string {
  return JSON.stringify({
    serviceName: s.serviceName,
    items: s.items,
    background: s.background,
    theme: s.theme
  })
}

/** "July 13, 2026" for stamping template-created session names with a friendly date. */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
function stampNow(): string {
  const d = new Date()
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

interface AppState {
  // the current service (working setlist)
  serviceId: string | null
  serviceName: string
  items: ServiceItem[]
  /** the item whose slides are shown in the center panel */
  selectedItemId: string | null
  /** where the next added item(s) land: a schedule index, or null = append */
  insertAt: number | null
  liveId: string | null
  /** disk auto-save status shown in the Sessions header (no manual Save) */
  autoSaveStatus: 'idle' | 'saving' | 'saved'

  theme: ThemeStyle
  background: Background
  blackout: boolean
  clearText: boolean
  showLogo: boolean

  media: MediaFile[]
  savedServices: ServiceMeta[]
  songs: SongMeta[]
  /** slide id currently open in the Slide Composer, or null */
  composerSlideId: string | null
  /** countdown/clock slide id currently open in the timer settings dialog, or null */
  timerSlideId: string | null

  screens: ScreenInfo[]
  displays: DisplayInfo[]

  // lifecycle
  init: () => Promise<void>
  refreshDisplays: () => Promise<void>

  // media library
  importMedia: () => Promise<void>
  importPptx: () => Promise<PptxImport[]>

  // service items
  /** arm the insertion point for the next add ("+ between sections"); null = append */
  setInsertAt: (index: number | null) => void
  addItem: (
    item: { title: string; kind: ItemKind; slides: SlideContent[]; autoAdvance?: boolean },
    goLiveFirst?: boolean
  ) => void
  /** add a song wrapped with Praise & Worship bookends (audience-only broadcast) */
  addSong: (item: { title: string; slides: SlideContent[] }, goLiveFirst?: boolean) => void
  /** add a psalm prefixed with a Responsive-Reading heading (broadcast to all) */
  addPsalm: (item: { title: string; slides: SlideContent[]; reference: string }, goLiveFirst?: boolean) => void
  removeItem: (id: string) => void
  removeSlide: (id: string) => void
  /** copy a slide; `placement` puts the duplicate right after it (default) or at
   *  the end of its song/item */
  duplicateSlide: (id: string, placement?: 'after' | 'end') => void
  /** move a slide one step earlier/later within its song/item (repeat to move anywhere) */
  moveSlide: (id: string, dir: -1 | 1) => void
  /** drag-reorder: move a slide from index `from` to index `to` within its item */
  reorderSlides: (itemId: string, from: number, to: number) => void
  moveItem: (id: string, dir: -1 | 1) => void
  /** move the item at `from` to index `to` (drag-and-drop reorder) */
  reorderItems: (from: number, to: number) => void
  duplicateItem: (id: string) => void
  /** turn a broadcast channel on/off for one item (on = broadcasting) */
  setItemBroadcast: (id: string, channel: 'users' | 'stream', on: boolean) => void
  /** turn both channels on/off for one item at once */
  setItemBroadcastAll: (id: string, on: boolean) => void
  /** pick a media file and set it as the item's (first) slide background */
  attachMediaToItem: (itemId: string) => Promise<void>
  /** set a web-URL image/video as the item's (first) slide background — reaches
   *  the web broadcast too, unlike a local file */
  attachMediaUrlToItem: (itemId: string, url: string) => void
  selectItem: (id: string | null) => void
  clearService: () => void
  renameService: (name: string) => void

  // slide composer
  setComposed: (slideId: string, composed: ComposedLine[]) => void
  setSlideBackground: (slideId: string, bg: Background | undefined) => void
  openComposer: (slideId: string) => void
  closeComposer: () => void

  // pre-service timer (countdown / clock) settings
  openTimerConfig: (slideId: string) => void
  closeTimerConfig: () => void
  /** reconfigure a countdown/clock slide: `minutes` re-arms the countdown from now
   *  (and stores the duration so a reopened service re-arms too); `message` sets
   *  the caption. Updates the live output immediately when the slide is on air. */
  setTimer: (slideId: string, cfg: { minutes?: number; message?: string }) => void

  // song library (persisted)
  refreshSongs: () => Promise<void>
  saveSong: (song: Song) => Promise<void>
  deleteSong: (id: string) => Promise<void>

  // remote song catalog (backend)
  remoteSongs: RemoteSong[]
  remoteState: 'idle' | 'loading' | 'ready' | 'error'
  remoteError: string
  loadRemoteSongs: (force?: boolean) => Promise<void>

  // saved services (persisted)
  refreshServices: () => Promise<void>
  saveService: () => Promise<void>
  openService: (id: string) => Promise<void>
  deleteService: (id: string) => Promise<void>
  /** write the current deck to a portable JSON file (user picks the path) */
  exportServiceJson: () => Promise<ServiceExportResult>
  /** load a deck from a JSON file into the current service */
  importServiceJson: () => Promise<ServiceImportResult>
  newService: () => void
  /** start a fresh service pre-populated from a named template outline */
  applyTemplate: (templateId: string) => void

  // live control
  goLive: (id: string | null) => void
  goNext: () => void
  goPrev: () => void
  /** Jump live to the service's Sermon slide (the item titled "Sermon" /
   *  "వాక్యోపదేశం"). Used by the verse auto-advance. No-op if there's no such
   *  item or its slide is already live. Returns true if it moved. */
  goToSermon: () => boolean
  /** epoch ms when the live Bible verse will auto-advance to the Sermon, or null
   *  when no auto-advance is pending. The operator can extend or hold it. */
  autoAdvanceAt: number | null
  /** (re)arm the auto-advance to fire `ms` from now */
  armAutoAdvance: (ms: number) => void
  /** push the pending auto-advance back by `ms` (operator "Extend"); no-op if none */
  extendAutoAdvance: (ms: number) => void
  /** stop a pending auto-advance (operator "Hold", or leaving the verse) */
  cancelAutoAdvance: () => void
  toggleBlackout: () => void
  toggleClear: () => void
  toggleLogo: () => void

  // look
  setBackground: (bg: Background) => void
  setTheme: (patch: Partial<ThemeStyle>) => void
  applyTheme: (patch: Partial<ThemeStyle>, background?: Background) => void

  // output screens (per display)
  setScreen: (displayId: number, role: ScreenRole) => Promise<void>
}

/** Flattened slide list across all items, in program order. */
export function selectSlides(s: AppState): SlideContent[] {
  return s.items.flatMap((it) => it.slides)
}

/** Whether an item is suppressed on a given web-broadcast channel. Reads the
 *  per-channel flag, falling back to the legacy single `noBroadcast`. */
export function suppressedOn(it: ServiceItem | undefined, channel: 'users' | 'stream'): boolean {
  if (!it) return false
  const chan = channel === 'users' ? it.noBroadcastUsers : it.noBroadcastStream
  return chan ?? it.noBroadcast ?? false
}

/** Item kinds that broadcast to the web by default: the welcome video, songs, and
 *  scripture (psalms / passages). Everything else — countdown, plain text
 *  (announcements, sermon, offerings, benediction), media, imported PowerPoint,
 *  blanks — is OFF-air by default. The operator can flip any item in the schedule. */
export const BROADCASTABLE_KINDS = new Set<ItemKind>(['video', 'song', 'scripture'])

/** Default per-channel broadcast flags for a new item, by kind. */
export function broadcastDefaults(kind: ItemKind): Pick<ServiceItem, 'noBroadcastUsers' | 'noBroadcastStream'> {
  return BROADCASTABLE_KINDS.has(kind) ? {} : { noBroadcastUsers: true, noBroadcastStream: true }
}

/** Splice new items into the list at `at` (clamped), or append when `at` is null. */
function insertItems(items: ServiceItem[], at: number | null, add: ServiceItem[]): ServiceItem[] {
  if (at == null) return [...items, ...add]
  const i = Math.max(0, Math.min(at, items.length))
  const copy = items.slice()
  copy.splice(i, 0, ...add)
  return copy
}

/** The bilingual title used to detect / build a Praise & Worship bookend. */
const WORSHIP_TITLE = 'Praise & Worship'

/** A 'Praise & Worship' title card that bookends songs. Broadcasts to the Users
 *  (audience mirror) only — the OBS/Stream channel shows empty. */
export function worshipBookend(): ServiceItem {
  return {
    id: uid(),
    title: WORSHIP_TITLE,
    kind: 'song',
    slides: [
      { id: uid(), kind: 'text', label: WORSHIP_TITLE, lines: ['స్తుతి ఆరాధన', WORSHIP_TITLE], singleLine: true }
    ],
    noBroadcastUsers: false, // to the audience (Users)
    noBroadcastStream: true // OBS / Stream shows empty
  }
}

/** The Responsive-Reading heading card that pre-fixes a psalm. Broadcasts to all. */
export function responsiveReadingHeading(reference: string): ServiceItem {
  return {
    id: uid(),
    title: 'Responsive Reading',
    kind: 'scripture',
    slides: [
      {
        id: uid(),
        kind: 'text',
        label: 'Responsive Reading',
        lines: ['ఉత్తర ప్రత్యుత్తర వాక్య పఠనం', 'Responsive Reading', `కీర్తనలు ${reference}`, `Psalm ${reference}`]
      }
    ]
  }
}

/** Materialize the legacy `noBroadcast` flag into the two channel flags and drop
 *  it, so items carry an unambiguous per-channel state. */
export function normalizeBroadcast(it: ServiceItem): ServiceItem {
  if (it.noBroadcast === undefined) return it
  const { noBroadcast, ...rest } = it
  return {
    ...rest,
    noBroadcastUsers: it.noBroadcastUsers ?? noBroadcast,
    noBroadcastStream: it.noBroadcastStream ?? noBroadcast
  }
}

export function selectLive(s: AppState): LiveState {
  const slides = selectSlides(s)
  const i = slides.findIndex((d) => d.id === s.liveId)
  const liveItem = i >= 0 ? s.items.find((it) => it.slides.some((sl) => sl.id === s.liveId)) : undefined
  const nextSlide = i >= 0 ? slides[i + 1] ?? null : null
  const nextItem = nextSlide ? s.items.find((it) => it.slides.some((sl) => sl.id === nextSlide.id)) : undefined
  return {
    slide: i >= 0 ? slides[i] : null,
    next: nextSlide,
    noBroadcastUsers: suppressedOn(liveItem, 'users'),
    noBroadcastStream: suppressedOn(liveItem, 'stream'),
    nextNoBroadcastUsers: suppressedOn(nextItem, 'users'),
    nextNoBroadcastStream: suppressedOn(nextItem, 'stream'),
    background: s.background,
    blackout: s.blackout,
    clearText: s.clearText,
    showLogo: s.showLogo,
    theme: s.theme,
    // Lyric-free service outline for the audience app's "Order" tab. Titles/kinds
    // only (never slide text), with the item owning the live slide flagged.
    order: s.items.map((it) => ({
      id: it.id,
      title: it.title,
      kind: it.kind,
      live: liveItem ? it.id === liveItem.id : false
    })),
    // Service name so the broadcast directory labels the session by the service.
    name: s.serviceName
  }
}

export const useStore = create<AppState>((set, get) => {
  const push = (): void => {
    void window.lumen.setLive(selectLive(get()))
  }
  // Register IPC subscriptions exactly once (StrictMode/HMR can call init twice).
  let subscribed = false

  return {
    serviceId: null,
    serviceName: 'Untitled Service',
    items: [],
    selectedItemId: null,
    insertAt: null,
    liveId: null,
    autoAdvanceAt: null,
    autoSaveStatus: 'idle',

    theme: DEFAULT_THEME,
    background: DEFAULT_BACKGROUND,
    blackout: false,
    clearText: false,
    showLogo: false,

    media: [],
    savedServices: [],
    songs: [],
    composerSlideId: null,
    timerSlideId: null,

    remoteSongs: [],
    remoteState: 'idle',
    remoteError: '',

    screens: [],
    displays: [],

    init: async () => {
      const [displays, screens, services, songs] = await Promise.all([
        window.lumen.listDisplays(),
        window.lumen.screensStatus(),
        window.lumen.listServices(),
        window.lumen.listSongs()
      ])
      set({ displays, screens, savedServices: services, songs })
      if (!subscribed) {
        subscribed = true
        window.lumen.onScreensChanged((s) => set({ screens: s }))
        window.lumen.onDisplaysChanged((d) => set({ displays: d }))
      }
      // Restore the last working session from cache (unless expired) so an
      // in-progress setlist survives a restart without an explicit Save. Only if
      // the store is still pristine — the UI is interactive during the IPC load
      // above, so don't clobber anything the operator already started.
      const cached = loadSessionCache()
      if (cached && Array.isArray(cached.items) && cached.items.length && get().items.length === 0) {
        const items = reArmItems(cached.items, Date.now())
        set({
          serviceId: cached.serviceId ?? null,
          serviceName: cached.serviceName || 'Untitled Service',
          items,
          selectedItemId: items[0]?.id ?? null,
          liveId: null,
          background: cached.background ?? get().background,
          theme: cached.theme ?? get().theme
        })
      }
      cacheReady = true
      // Seed the baselines so the first transient change (selectItem, an incoming
      // display event, …) doesn't needlessly re-save / re-stamp the TTL.
      cacheLast = sessionSnapshot(get())
      autoSaveLast = contentSnapshot(get())
      push()
    },

    refreshDisplays: async () => {
      set({ displays: await window.lumen.listDisplays() })
    },

    importMedia: async () => {
      const files = await window.lumen.pickMedia()
      if (!files.length) return
      set((s) => {
        const existing = new Set(s.media.map((m) => m.path))
        const fresh = files.filter((f) => !existing.has(f.path))
        return { media: [...s.media, ...fresh] }
      })
    },

    importPptx: () => window.lumen.importPptx(),

    setInsertAt: (index) => set({ insertAt: index }),

    addItem: ({ title, kind, slides, autoAdvance }, goLiveFirst = false) => {
      if (!slides.length) return
      const item: ServiceItem = {
        id: uid(),
        title,
        kind,
        slides,
        ...broadcastDefaults(kind),
        ...(autoAdvance ? { autoAdvance: true } : {})
      }
      set((s) => ({ items: insertItems(s.items, s.insertAt, [item]), selectedItemId: item.id, insertAt: null }))
      if (goLiveFirst) get().goLive(slides[0].id)
    },

    addSong: ({ title, slides }, goLiveFirst = false) => {
      if (!slides.length) return
      const song: ServiceItem = { id: uid(), title, kind: 'song', slides }
      set((s) => {
        const at = s.insertAt
        // Bookend with Praise & Worship, reusing an adjacent bookend so songs
        // added back-to-back (or dropped next to one) don't stack duplicates.
        const pos = at == null ? s.items.length : Math.max(0, Math.min(at, s.items.length))
        const before = s.items[pos - 1]
        const after = s.items[pos]
        const block: ServiceItem[] = []
        if (!(before && before.title === WORSHIP_TITLE)) block.push(worshipBookend())
        block.push(song)
        if (!(after && after.title === WORSHIP_TITLE)) block.push(worshipBookend())
        return { items: insertItems(s.items, at, block), selectedItemId: song.id, insertAt: null }
      })
      if (goLiveFirst) get().goLive(slides[0].id)
    },

    addPsalm: ({ title, slides, reference }, goLiveFirst = false) => {
      if (!slides.length) return
      const heading = responsiveReadingHeading(reference)
      const psalm: ServiceItem = { id: uid(), title, kind: 'scripture', slides }
      set((s) => ({
        items: insertItems(s.items, s.insertAt, [heading, psalm]),
        selectedItemId: psalm.id,
        insertAt: null
      }))
      // Present starts at the Responsive-Reading heading, then Next into the verses.
      if (goLiveFirst) get().goLive(heading.slides[0].id)
    },

    removeItem: (id) => {
      set((s) => {
        const idx = s.items.findIndex((it) => it.id === id)
        const item = s.items[idx]
        const removedLive = item?.slides.some((sl) => sl.id === s.liveId)
        const items = s.items.filter((it) => it.id !== id)
        const selectedItemId =
          s.selectedItemId === id ? (items[idx] ?? items[idx - 1])?.id ?? null : s.selectedItemId
        return {
          items,
          selectedItemId,
          liveId: removedLive ? null : s.liveId
        }
      })
      push()
    },

    setItemBroadcast: (id, channel, on) => {
      const key = channel === 'users' ? 'noBroadcastUsers' : 'noBroadcastStream'
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id ? { ...normalizeBroadcast(it), [key]: !on } : it
        )
      }))
      // re-push so the relay reflects it now — whether the item is the live slide
      // or the `next` preview of the live one
      push()
    },

    setItemBroadcastAll: (id, on) => {
      set((s) => ({
        items: s.items.map((it) => {
          if (it.id !== id) return it
          const { noBroadcast, ...rest } = it
          void noBroadcast
          return { ...rest, noBroadcastUsers: !on, noBroadcastStream: !on }
        })
      }))
      push()
    },

    attachMediaToItem: async (itemId) => {
      const files = await window.lumen.pickMedia()
      if (!files.length) return
      const f = files[0]
      const bg: Background = { type: f.isVideo ? 'video' : 'image', value: f.url, fit: 'cover' }
      set((s) => ({
        items: s.items.map((it) => {
          if (it.id !== itemId) return it
          const kind: ItemKind = f.isVideo ? 'video' : 'media'
          const slides: SlideContent[] = it.slides.length
            ? it.slides.map((sl, i) =>
                i === 0 ? { ...sl, kind: 'media', background: bg, lines: [], label: f.name } : sl
              )
            : [{ id: uid(), kind: 'media', label: f.name, lines: [], background: bg }]
          return { ...it, kind, slides }
        })
      }))
      push() // the affected slide may be live
    },

    attachMediaUrlToItem: (itemId, url) => {
      const u = url.trim()
      if (!/^https?:\/\//i.test(u)) return
      // Unlike a local file, a web URL also reaches the web broadcast (the relay
      // can load it); the overlay renders http(s) image/video backgrounds.
      const isVideo = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)
      const bg: Background = { type: isVideo ? 'video' : 'image', value: u, fit: 'cover' }
      const name = u.split('/').pop()?.split(/[?#]/)[0] || 'Media link'
      set((s) => ({
        items: s.items.map((it) => {
          if (it.id !== itemId) return it
          const kind: ItemKind = isVideo ? 'video' : 'media'
          const slides: SlideContent[] = it.slides.length
            ? it.slides.map((sl, i) =>
                i === 0 ? { ...sl, kind: 'media', background: bg, lines: [], label: name } : sl
              )
            : [{ id: uid(), kind: 'media', label: name, lines: [], background: bg }]
          return { ...it, kind, slides }
        })
      }))
      push()
    },

    selectItem: (id) => set({ selectedItemId: id }),

    setComposed: (slideId, composed) => {
      set((s) => ({
        items: s.items.map((it) => ({
          ...it,
          slides: it.slides.map((sl) => (sl.id === slideId ? { ...sl, composed } : sl))
        }))
      }))
      if (get().liveId === slideId) push()
    },

    setSlideBackground: (slideId, bg) => {
      set((s) => ({
        items: s.items.map((it) => ({
          ...it,
          slides: it.slides.map((sl) => (sl.id === slideId ? { ...sl, background: bg } : sl))
        }))
      }))
      if (get().liveId === slideId) push()
    },

    openComposer: (slideId) => set({ composerSlideId: slideId }),
    closeComposer: () => set({ composerSlideId: null }),

    openTimerConfig: (slideId) => set({ timerSlideId: slideId }),
    closeTimerConfig: () => set({ timerSlideId: null }),

    setTimer: (slideId, cfg) => {
      const now = Date.now()
      set((s) => ({
        items: s.items.map((it) => ({
          ...it,
          slides: it.slides.map((sl) => {
            if (sl.id !== slideId) return sl
            const next = { ...sl }
            if (cfg.minutes != null) {
              const m = Math.max(0, Math.min(600, cfg.minutes))
              next.countdownMinutes = m
              next.countdownTo = now + m * 60_000
            }
            if (cfg.message != null) next.message = cfg.message.trim() || undefined
            return next
          })
        }))
      }))
      if (get().liveId === slideId) push()
    },

    removeSlide: (id) => {
      set((s) => ({
        items: s.items
          .map((it) => ({ ...it, slides: it.slides.filter((sl) => sl.id !== id) }))
          .filter((it) => it.slides.length > 0),
        liveId: s.liveId === id ? null : s.liveId
      }))
      push()
    },

    duplicateSlide: (id, placement = 'after') => {
      set((s) => ({
        items: s.items.map((it) => {
          const idx = it.slides.findIndex((sl) => sl.id === id)
          if (idx < 0) return it
          const copy = { ...it.slides[idx], id: uid() }
          const slides = it.slides.slice()
          if (placement === 'end') slides.push(copy)
          else slides.splice(idx + 1, 0, copy)
          return { ...it, slides }
        })
      }))
      push() // the deck changed → refresh the stage monitor's `next`
    },

    moveSlide: (id, dir) => {
      set((s) => ({
        items: s.items.map((it) => {
          const idx = it.slides.findIndex((sl) => sl.id === id)
          if (idx < 0) return it
          const j = idx + dir
          if (j < 0 || j >= it.slides.length) return it
          const slides = it.slides.slice()
          const tmp = slides[idx]
          slides[idx] = slides[j]
          slides[j] = tmp
          return { ...it, slides }
        })
      }))
      push()
    },

    reorderSlides: (itemId, from, to) => {
      set((s) => ({
        items: s.items.map((it) => {
          if (it.id !== itemId) return it
          if (from === to || from < 0 || to < 0 || from >= it.slides.length || to >= it.slides.length) return it
          const slides = it.slides.slice()
          const [moved] = slides.splice(from, 1)
          // drop highlight = "insert before this slide"; a rightward move shifts the
          // target down one after removal (mirrors reorderItems).
          const dest = from < to ? to - 1 : to
          slides.splice(dest, 0, moved)
          return { ...it, slides }
        })
      }))
      push()
    },

    moveItem: (id, dir) => {
      set((s) => {
        const i = s.items.findIndex((it) => it.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= s.items.length) return {}
        const items = s.items.slice()
        ;[items[i], items[j]] = [items[j], items[i]]
        return { items }
      })
      // reordering changes which slide is `next` (and its broadcast eligibility)
      push()
    },

    reorderItems: (from, to) => {
      set((s) => {
        if (from === to || from < 0 || to < 0 || from >= s.items.length || to >= s.items.length) return {}
        const items = s.items.slice()
        const [moved] = items.splice(from, 1)
        // The drop-target highlight means "insert before this row". After removing
        // the dragged item, a downward move shifts the target index down by one, so
        // insert at to-1 to land exactly where the highlight indicated.
        const dest = from < to ? to - 1 : to
        items.splice(dest, 0, moved)
        return { items }
      })
      push()
    },

    duplicateItem: (id) => {
      set((s) => {
        const i = s.items.findIndex((it) => it.id === id)
        if (i < 0) return {}
        const src = s.items[i]
        // Carry the per-channel broadcast suppression onto the copy — otherwise a
        // duplicate of an off-air item (e.g. Praise & Worship) would go fully on
        // air and leak its lyrics to the web relay.
        const copy: ServiceItem = {
          ...normalizeBroadcast(src),
          id: uid(),
          title: `${src.title} (copy)`,
          slides: src.slides.map((sl) => ({ ...sl, id: uid() }))
        }
        const items = s.items.slice()
        items.splice(i + 1, 0, copy)
        return { items }
      })
      push()
    },

    clearService: () => {
      set({ items: [], selectedItemId: null, liveId: null })
      push()
    },

    renameService: (name) => set({ serviceName: name }),

    // ---- song library ----
    refreshSongs: async () => {
      set({ songs: await window.lumen.listSongs() })
    },
    saveSong: async (song) => {
      set({ songs: await window.lumen.saveSong(song) })
    },
    deleteSong: async (id) => {
      set({ songs: await window.lumen.deleteSong(id) })
    },

    loadRemoteSongs: async (force = false) => {
      const s = get()
      if (!force && (s.remoteState === 'loading' || s.remoteState === 'ready')) return
      set({ remoteState: 'loading', remoteError: '' })
      try {
        // The manual Refresh (force=true) bypasses the 24h disk cache.
        const res = await window.lumen.remoteSongs(force)
        if (Array.isArray(res)) {
          set({ remoteSongs: res, remoteState: 'ready' })
        } else {
          set({ remoteState: 'error', remoteError: res?.error ?? 'Failed to load catalog' })
        }
      } catch (e) {
        set({ remoteState: 'error', remoteError: e instanceof Error ? e.message : 'Failed to load catalog' })
      }
    },

    // ---- saved services ----
    refreshServices: async () => {
      set({ savedServices: await window.lumen.listServices() })
    },

    saveService: async () => {
      const s = get()
      const id = s.serviceId ?? uid()
      set({ autoSaveStatus: 'saving' })
      const service: Service = {
        id,
        name: s.serviceName.trim() || 'Untitled Service',
        savedAt: new Date().toISOString(),
        items: s.items,
        background: s.background,
        theme: s.theme
      }
      try {
        const list = await window.lumen.saveService(service)
        set({ serviceId: id, savedServices: list, autoSaveStatus: 'saved' })
      } catch {
        set({ autoSaveStatus: 'idle' })
      }
    },

    openService: async (id) => {
      const service = await window.lumen.loadService(id)
      if (!service) return
      // Re-arm countdown slides to a fresh target so a reopened service doesn't
      // show an expired 0:00.
      const items = reArmItems(service.items ?? [], Date.now())
      set({
        serviceId: service.id,
        serviceName: service.name,
        items,
        selectedItemId: items[0]?.id ?? null,
        liveId: null,
        background: service.background ?? get().background,
        theme: service.theme ?? get().theme,
        blackout: false,
        clearText: false,
        showLogo: false
      })
      push()
    },

    exportServiceJson: async () => {
      const s = get()
      // Include the OBS lower-third style (size/position/colors/band) for a complete
      // presentation snapshot — but never the room slug / control PIN.
      const bc = await window.lumen.getBroadcast().catch(() => null)
      const env: ServiceExport = {
        format: 'cantica-service',
        version: 1,
        exportedAt: new Date().toISOString(),
        service: {
          name: s.serviceName.trim() || 'Untitled Service',
          items: s.items,
          background: s.background,
          theme: s.theme
        },
        obsStyle: bc?.obsStyle
      }
      return window.lumen.exportServiceJson(env)
    },

    importServiceJson: async () => {
      const res = await window.lumen.importServiceJson()
      if (!res.ok || !res.service) return res
      const svc = res.service
      // Restore the OBS lower-third style if the file carried it (room/PIN unchanged).
      if (res.obsStyle) await window.lumen.setBroadcast({ obsStyle: res.obsStyle }).catch(() => {})
      // Fresh serviceId (null) → saving creates a NEW entry, never overwrites a
      // saved service. Re-arm countdowns so an imported deck doesn't show 0:00.
      const items = reArmItems(svc.items ?? [], Date.now())
      set({
        serviceId: null,
        serviceName: svc.name || 'Imported Service',
        items,
        selectedItemId: items[0]?.id ?? null,
        liveId: null,
        background: svc.background ?? get().background,
        theme: svc.theme ?? get().theme,
        blackout: false,
        clearText: false,
        showLogo: false
      })
      push()
      return res
    },

    deleteService: async (id) => {
      const list = await window.lumen.deleteService(id)
      set((s) => ({
        savedServices: list,
        // if we deleted the service we're editing, detach it (keep the content)
        serviceId: s.serviceId === id ? null : s.serviceId
      }))
    },

    newService: () => {
      set({ serviceId: null, serviceName: 'Untitled Service', items: [], selectedItemId: null, liveId: null })
      push()
    },

    applyTemplate: (templateId) => {
      const tpl = SERVICE_TEMPLATES.find((t) => t.id === templateId)
      if (!tpl) return
      // Countdown slides carry an absolute target; build fresh so the outline
      // starts from "now" every time it's applied.
      const items = tpl.build()
      set({
        serviceId: null,
        // stamp date + time so each template-created session is a distinct file
        serviceName: `${tpl.name} · ${stampNow()}`,
        items,
        selectedItemId: items[0]?.id ?? null,
        liveId: null,
        blackout: false,
        clearText: false,
        showLogo: false
      })
      push()
    },

    // ---- live control (over the flattened slide list) ----
    goLive: (id) => {
      set((s) => {
        // Follow the live slide: highlight the section (item) that owns it, so the
        // schedule + center Slides panel track what's on screen as you navigate.
        const owner = id ? s.items.find((it) => it.slides.some((sl) => sl.id === id)) : undefined
        return {
          liveId: id,
          selectedItemId: owner ? owner.id : s.selectedItemId,
          clearText: false,
          blackout: false,
          showLogo: false
        }
      })
      push()
    },

    goToSermon: () => {
      const s = get()
      // Match the Sermon item by title (English or Telugu), as built by the
      // service templates and typically named by the operator.
      const sermon = s.items.find((it) => /sermon|వాక్యోపదేశం/i.test(it.title))
      const target = sermon?.slides[0]?.id
      if (!target || target === s.liveId) return false
      get().goLive(target)
      return true
    },

    armAutoAdvance: (ms) => set({ autoAdvanceAt: Date.now() + ms }),
    extendAutoAdvance: (ms) =>
      set((s) => ({ autoAdvanceAt: s.autoAdvanceAt != null ? s.autoAdvanceAt + ms : null })),
    cancelAutoAdvance: () => set((s) => (s.autoAdvanceAt == null ? {} : { autoAdvanceAt: null })),

    goNext: () => {
      const slides = selectSlides(get())
      if (slides.length === 0) return
      const i = slides.findIndex((d) => d.id === get().liveId)
      const next = slides[Math.min(i + 1, slides.length - 1)] ?? slides[0]
      // Already at the last slide: don't re-fire goLive (which would reset an
      // intentional blackout/clear/logo and flash content on the audience).
      if (next.id === get().liveId) return
      get().goLive(next.id)
    },

    goPrev: () => {
      const slides = selectSlides(get())
      if (slides.length === 0) return
      const i = slides.findIndex((d) => d.id === get().liveId)
      const prev = slides[Math.max(i - 1, 0)] ?? slides[0]
      if (prev.id === get().liveId) return
      get().goLive(prev.id)
    },

    toggleBlackout: () => {
      set((s) => ({ blackout: !s.blackout }))
      push()
    },
    toggleClear: () => {
      set((s) => ({ clearText: !s.clearText }))
      push()
    },
    toggleLogo: () => {
      set((s) => ({ showLogo: !s.showLogo }))
      push()
    },

    setBackground: (bg) => {
      set({ background: bg })
      push()
    },
    setTheme: (patch) => {
      set((s) => ({ theme: { ...s.theme, ...patch } }))
      push()
    },
    applyTheme: (patch, background) => {
      set((s) => ({
        theme: { ...s.theme, ...patch },
        ...(background ? { background } : {})
      }))
      push()
    },

    setScreen: async (displayId, role) => {
      const screens = await window.lumen.setScreen(displayId, role)
      set({ screens })
      push()
    }
  }
})

// Debounced auto-cache of the working session (setlist + look). Restored by
// init() on the next launch; see sessionCache.ts for the 2-week TTL. Only the
// control window imports this store, and cacheReady gates out startup writes,
// so an empty state never clobbers a good cache.
{
  let timer: ReturnType<typeof setTimeout> | null = null
  useStore.subscribe((s) => {
    if (!cacheReady) return
    const snap = sessionSnapshot(s)
    if (snap === cacheLast) return
    cacheLast = snap
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      saveSessionCache(JSON.parse(snap))
    }, 700)
  })
  // On close, flush only a still-pending edit (timer set) — so merely opening or
  // closing the app doesn't re-write the session and re-stamp its TTL. This keeps
  // the TTL counting from the last real edit.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (cacheReady && timer) {
        clearTimeout(timer)
        timer = null
        try {
          saveSessionCache(JSON.parse(cacheLast))
        } catch {
          /* ignore */
        }
      }
    })
  }
}

// Disk auto-save: persist the working session to the saved-services store on any
// content change (debounced), so there's no manual Save button. The first save
// assigns a serviceId; the content key excludes it to avoid a re-trigger loop.
{
  let timer: ReturnType<typeof setTimeout> | null = null
  useStore.subscribe((s) => {
    if (!cacheReady || !s.items.length) return
    const key = contentSnapshot(s)
    if (key === autoSaveLast) return
    autoSaveLast = key
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void useStore.getState().saveService()
    }, 1200)
  })
}
