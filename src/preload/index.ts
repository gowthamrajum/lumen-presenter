import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  LiveState,
  DisplayInfo,
  ScreenInfo,
  ScreenRole,
  MediaFile,
  PptxImport,
  Service,
  ServiceMeta,
  Song,
  SongMeta,
  RemoteSong,
  BroadcastConfig,
  BroadcastStatus
} from '../shared/types'
import type { Translation } from '../shared/bible/types'

const api = {
  // queries / commands (control window)
  listDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke(IPC.displaysList),
  screensStatus: (): Promise<ScreenInfo[]> => ipcRenderer.invoke(IPC.screensStatus),
  setScreen: (displayId: number, role: ScreenRole): Promise<ScreenInfo[]> =>
    ipcRenderer.invoke(IPC.screenSet, displayId, role),
  pickMedia: (): Promise<MediaFile[]> => ipcRenderer.invoke(IPC.pickMedia),
  importPptx: (): Promise<PptxImport[]> => ipcRenderer.invoke(IPC.pickPptx),
  loadTranslation: (id: string): Promise<Translation | null> =>
    ipcRenderer.invoke(IPC.bibleLoad, id),

  // services (saved setlists)
  listServices: (): Promise<ServiceMeta[]> => ipcRenderer.invoke(IPC.servicesList),
  saveService: (service: Service): Promise<ServiceMeta[]> =>
    ipcRenderer.invoke(IPC.serviceSave, service),
  loadService: (id: string): Promise<Service | null> => ipcRenderer.invoke(IPC.serviceLoad, id),
  deleteService: (id: string): Promise<ServiceMeta[]> => ipcRenderer.invoke(IPC.serviceDelete, id),

  // songs (library)
  listSongs: (): Promise<SongMeta[]> => ipcRenderer.invoke(IPC.songsList),
  saveSong: (song: Song): Promise<SongMeta[]> => ipcRenderer.invoke(IPC.songSave, song),
  loadSong: (id: string): Promise<Song | null> => ipcRenderer.invoke(IPC.songLoad, id),
  deleteSong: (id: string): Promise<SongMeta[]> => ipcRenderer.invoke(IPC.songDelete, id),
  remoteSongs: (): Promise<RemoteSong[] | { error: string }> =>
    ipcRenderer.invoke(IPC.songsRemote),

  // live state
  getLive: (): Promise<LiveState> => ipcRenderer.invoke(IPC.liveGet),
  setLive: (patch: Partial<LiveState>): Promise<LiveState> =>
    ipcRenderer.invoke(IPC.liveSet, patch),

  // web broadcast (OBS)
  getBroadcast: (): Promise<BroadcastConfig> => ipcRenderer.invoke(IPC.broadcastGet),
  setBroadcast: (patch: Partial<BroadcastConfig>): Promise<BroadcastConfig> =>
    ipcRenderer.invoke(IPC.broadcastSet, patch),
  getBroadcastStatus: (): Promise<BroadcastStatus> => ipcRenderer.invoke(IPC.broadcastStatusGet),
  onBroadcastStatus: (cb: (s: BroadcastStatus) => void): (() => void) => {
    const h = (_e: unknown, s: BroadcastStatus): void => cb(s)
    ipcRenderer.on(IPC.broadcastStatus, h)
    return () => ipcRenderer.removeListener(IPC.broadcastStatus, h)
  },

  // subscriptions
  onLiveState: (cb: (state: LiveState) => void): (() => void) => {
    const h = (_e: unknown, s: LiveState): void => cb(s)
    ipcRenderer.on(IPC.liveState, h)
    return () => ipcRenderer.removeListener(IPC.liveState, h)
  },
  onScreensChanged: (cb: (screens: ScreenInfo[]) => void): (() => void) => {
    const h = (_e: unknown, s: ScreenInfo[]): void => cb(s)
    ipcRenderer.on(IPC.screensChanged, h)
    return () => ipcRenderer.removeListener(IPC.screensChanged, h)
  },
  onDisplaysChanged: (cb: (d: DisplayInfo[]) => void): (() => void) => {
    const h = (_e: unknown, d: DisplayInfo[]): void => cb(d)
    ipcRenderer.on(IPC.displaysChanged, h)
    return () => ipcRenderer.removeListener(IPC.displaysChanged, h)
  },
  onOutputKey: (cb: (key: string) => void): (() => void) => {
    const h = (_e: unknown, key: string): void => cb(key)
    ipcRenderer.on(IPC.outputKey, h)
    return () => ipcRenderer.removeListener(IPC.outputKey, h)
  }
}

export type LumenApi = typeof api

contextBridge.exposeInMainWorld('lumen', api)
