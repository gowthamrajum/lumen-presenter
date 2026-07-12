import { create } from 'zustand'
import {
  DEFAULT_BACKGROUND,
  DEFAULT_THEME,
  type Background,
  type DisplayInfo,
  type LiveState,
  type MediaFile,
  type OutputStatus,
  type PptxImport,
  type SlideContent,
  type ThemeStyle
} from '@shared/types'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

interface AppState {
  deck: SlideContent[]
  liveId: string | null
  theme: ThemeStyle
  background: Background
  blackout: boolean
  clearText: boolean
  showLogo: boolean

  media: MediaFile[]

  outputStatus: OutputStatus
  displays: DisplayInfo[]
  selectedDisplayId: number | null

  // lifecycle
  init: () => Promise<void>
  refreshDisplays: () => Promise<void>

  // media library
  importMedia: () => Promise<void>
  /** Open a file dialog and parse .pptx files into slide payloads. */
  importPptx: () => Promise<PptxImport[]>

  // deck
  addSlides: (slides: SlideContent[], goLiveFirst?: boolean) => void
  removeSlide: (id: string) => void
  clearDeck: () => void
  setSlideBackground: (id: string, bg: Background | undefined) => void

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

  // output window
  openOutput: () => Promise<void>
  closeOutput: () => Promise<void>
  setSelectedDisplay: (id: number | null) => void
}

export function selectLive(s: AppState): LiveState {
  return {
    slide: s.deck.find((d) => d.id === s.liveId) ?? null,
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

  return {
    deck: [],
    liveId: null,
    theme: DEFAULT_THEME,
    background: DEFAULT_BACKGROUND,
    blackout: false,
    clearText: false,
    showLogo: false,

    media: [],

    outputStatus: { open: false, displayId: null },
    displays: [],
    selectedDisplayId: null,

    init: async () => {
      const [displays, status] = await Promise.all([
        window.lumen.listDisplays(),
        window.lumen.outputStatus()
      ])
      const preferExternal = displays.find((d) => !d.primary) ?? displays[0]
      set({
        displays,
        outputStatus: status,
        selectedDisplayId: status.displayId ?? preferExternal?.id ?? null
      })
      window.lumen.onOutputChanged((outputStatus) => set({ outputStatus }))
      window.lumen.onDisplaysChanged((d) => set({ displays: d }))
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

    addSlides: (slides, goLiveFirst = false) => {
      set((s) => ({ deck: [...s.deck, ...slides] }))
      if (goLiveFirst && slides[0]) get().goLive(slides[0].id)
    },

    removeSlide: (id) => {
      set((s) => ({
        deck: s.deck.filter((d) => d.id !== id),
        liveId: s.liveId === id ? null : s.liveId
      }))
      if (get().liveId === null) push()
    },

    clearDeck: () => {
      set({ deck: [], liveId: null })
      push()
    },

    setSlideBackground: (id, bg) => {
      set((s) => ({
        deck: s.deck.map((d) => (d.id === id ? { ...d, background: bg } : d))
      }))
      if (get().liveId === id) push()
    },

    goLive: (id) => {
      set({ liveId: id, clearText: false, blackout: false, showLogo: false })
      push()
    },

    goNext: () => {
      const { deck, liveId } = get()
      if (deck.length === 0) return
      const i = deck.findIndex((d) => d.id === liveId)
      const next = deck[Math.min(i + 1, deck.length - 1)] ?? deck[0]
      get().goLive(next.id)
    },

    goPrev: () => {
      const { deck, liveId } = get()
      if (deck.length === 0) return
      const i = deck.findIndex((d) => d.id === liveId)
      const prev = deck[Math.max(i - 1, 0)] ?? deck[0]
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

    openOutput: async () => {
      const status = await window.lumen.openOutput(get().selectedDisplayId)
      set({ outputStatus: status })
      push()
    },
    closeOutput: async () => {
      const status = await window.lumen.closeOutput()
      set({ outputStatus: status })
    },
    setSelectedDisplay: (id) => set({ selectedDisplayId: id })
  }
})
