import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { LiveState, DisplayInfo, OutputStatus, MediaFile } from '../shared/types'

const api = {
  // queries / commands (control window)
  listDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke(IPC.displaysList),
  outputStatus: (): Promise<OutputStatus> => ipcRenderer.invoke(IPC.outputStatus),
  openOutput: (displayId: number | null): Promise<OutputStatus> =>
    ipcRenderer.invoke(IPC.outputOpen, displayId),
  closeOutput: (): Promise<OutputStatus> => ipcRenderer.invoke(IPC.outputClose),
  pickMedia: (): Promise<MediaFile[]> => ipcRenderer.invoke(IPC.pickMedia),

  // live state
  getLive: (): Promise<LiveState> => ipcRenderer.invoke(IPC.liveGet),
  setLive: (patch: Partial<LiveState>): Promise<LiveState> =>
    ipcRenderer.invoke(IPC.liveSet, patch),

  // subscriptions
  onLiveState: (cb: (state: LiveState) => void): (() => void) => {
    const h = (_e: unknown, s: LiveState): void => cb(s)
    ipcRenderer.on(IPC.liveState, h)
    return () => ipcRenderer.removeListener(IPC.liveState, h)
  },
  onOutputChanged: (cb: (status: OutputStatus) => void): (() => void) => {
    const h = (_e: unknown, s: OutputStatus): void => cb(s)
    ipcRenderer.on(IPC.outputChanged, h)
    return () => ipcRenderer.removeListener(IPC.outputChanged, h)
  },
  onDisplaysChanged: (cb: (d: DisplayInfo[]) => void): (() => void) => {
    const h = (_e: unknown, d: DisplayInfo[]): void => cb(d)
    ipcRenderer.on(IPC.displaysChanged, h)
    return () => ipcRenderer.removeListener(IPC.displaysChanged, h)
  }
}

export type LumenApi = typeof api

contextBridge.exposeInMainWorld('lumen', api)
