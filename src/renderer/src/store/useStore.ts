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

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
/** "2026-07-13 14:30" for stamping template-created session names. */
function stampNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

interface AppState {
  // the current service (working setlist)
  serviceId: string | null
  serviceName: string
  items: ServiceItem[]
  /** the item whose slides are shown in the center panel */
  selectedItemId: string | null
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

  screens: ScreenInfo[]
  displays: DisplayInfo[]

  // lifecycle
  init: () => Promise<void>
  refreshDisplays: () => Promise<void>

  // media library
  importMedia: () => Promise<void>
  importPptx: () => Promise<PptxImport[]>

  // service items
  addItem: (item: { title: string; kind: ItemKind; slides: SlideContent[] }, goLiveFirst?: boolean) => void
  removeItem: (id: string) => void
  removeSlide: (id: string) => void
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
  newService: () => void
  /** start a fresh service pre-populated from a named template outline */
  applyTemplate: (templateId: string) => void

  // live control
  goLive: (id: string | null) => void
  goNext: () => void
  goPrev: () => void
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
    theme: s.theme
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
    liveId: null,
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

    addItem: ({ title, kind, slides }, goLiveFirst = false) => {
      if (!slides.length) return
      const item: ServiceItem = { id: uid(), title, kind, slides, ...broadcastDefaults(kind) }
      set((s) => ({ items: [...s.items, item], selectedItemId: item.id }))
      if (goLiveFirst) get().goLive(slides[0].id)
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

    removeSlide: (id) => {
      set((s) => ({
        items: s.items
          .map((it) => ({ ...it, slides: it.slides.filter((sl) => sl.id !== id) }))
          .filter((it) => it.slides.length > 0),
        liveId: s.liveId === id ? null : s.liveId
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
