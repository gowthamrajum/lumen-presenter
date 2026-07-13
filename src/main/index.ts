import { app, shell, BrowserWindow, ipcMain, screen, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc'
import {
  DEFAULT_LIVE,
  type LiveState,
  type DisplayInfo,
  type ScreenInfo,
  type ScreenRole,
  type Service,
  type ServiceMeta,
  type Song,
  type SongMeta
} from '../shared/types'
import { importPptxFiles } from './pptx'
import {
  initBroadcast,
  publishBroadcast,
  getBroadcastConfig,
  setBroadcastConfig,
  getBroadcastStatus
} from './broadcast'
import type { BroadcastConfig } from '../shared/types'

// ---- app state -------------------------------------------------------------
type OutputWindow = BrowserWindow & { _displayId?: number; _windowed?: boolean; _kind?: 'audience' | 'stage' }
let controlWindow: BrowserWindow | null = null
/** one output window per display id */
const outputs = new Map<number, OutputWindow>()
let liveState: LiveState = structuredClone(DEFAULT_LIVE)

const MEDIA_SCHEME = 'lumen-media'

// Register the media scheme as privileged BEFORE app ready so image/video
// elements can load local files without relaxing webSecurity.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

/** Build a privileged url the renderer can load directly from an absolute path. */
function mediaUrl(absPath: string): string {
  return `${MEDIA_SCHEME}://local/${encodeURIComponent(absPath)}`
}

function rendererUrl(page: 'index' | 'output'): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/${page}.html`
  }
  return pathToFileURL(join(__dirname, `../renderer/${page}.html`)).toString()
}

// ---- windows ---------------------------------------------------------------
function createControlWindow(): void {
  controlWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'Lumen Presenter',
    backgroundColor: '#0b0e17',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  controlWindow.on('ready-to-show', () => controlWindow?.show())
  controlWindow.on('closed', () => {
    controlWindow = null
    closeAllOutputs()
  })
  controlWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  controlWindow.loadURL(rendererUrl('index'))
}

/** Find a display by id, else the primary. */
function displayById(id: number): Electron.Display {
  return screen.getAllDisplays().find((d) => d.id === id) ?? screen.getPrimaryDisplay()
}

/** The display the operator's control window currently sits on. */
function controlDisplayId(): number | null {
  if (!controlWindow) return null
  const b = controlWindow.getBounds()
  const d = screen.getDisplayNearestPoint({
    x: Math.round(b.x + b.width / 2),
    y: Math.round(b.y + b.height / 2)
  })
  return d.id
}

/** A 16:9 window tucked into the corner of a display's work area. */
function windowedBounds(display: Electron.Display): Electron.Rectangle {
  const wa = display.workArea
  const width = Math.max(480, Math.min(960, Math.round(wa.width * 0.5)))
  const height = Math.round((width * 9) / 16)
  return {
    x: wa.x + wa.width - width - 40,
    y: wa.y + wa.height - height - 40,
    width,
    height
  }
}

// Keys an output window forwards to the operator so navigation works even
// when an output window happens to hold focus.
const FORWARD_KEYS = new Set([
  'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
  'PageDown', 'PageUp', ' ', 'b', 'B', 'c', 'C', 'l', 'L'
])

function outputUrl(kind: 'audience' | 'stage'): string {
  return `${rendererUrl('output')}?layout=${kind}`
}

function buildOutputWindow(
  display: Electron.Display,
  windowed: boolean,
  kind: 'audience' | 'stage'
): OutputWindow {
  const common: Electron.BrowserWindowConstructorOptions = {
    backgroundColor: '#000000',
    show: false,
    title: kind === 'stage' ? 'Lumen Stage' : 'Lumen Output',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  }

  const win = new BrowserWindow(
    windowed
      ? {
          ...common,
          ...windowedBounds(display),
          frame: true,
          resizable: true,
          fullscreenable: true,
          minWidth: 320,
          minHeight: 180
        }
      : {
          ...common,
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height,
          frame: false,
          fullscreen: true
        }
  ) as OutputWindow

  if (windowed) win.setAspectRatio(16 / 9)
  win._displayId = display.id
  win._windowed = windowed
  win._kind = kind

  // Recovery + forwarding so the operator is never trapped behind an output.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'Escape') {
      if (win.isFullScreen()) win.setFullScreen(false)
      else closeScreen(display.id)
      event.preventDefault()
    } else if (input.key === 'f' || input.key === 'F') {
      win.setFullScreen(!win.isFullScreen())
      event.preventDefault()
    } else if (FORWARD_KEYS.has(input.key)) {
      controlWindow?.webContents.send(IPC.outputKey, input.key)
      event.preventDefault()
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (outputs.get(display.id) === win) outputs.delete(display.id)
    broadcastScreens()
  })

  win.loadURL(outputUrl(kind))
  win.webContents.once('did-finish-load', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.liveState, liveState)
  })

  return win
}

function closeScreen(displayId: number): void {
  const win = outputs.get(displayId)
  if (win) {
    outputs.delete(displayId)
    win.removeAllListeners('closed')
    win.destroy()
  }
  broadcastScreens()
}

function closeAllOutputs(): void {
  for (const win of outputs.values()) {
    win.removeAllListeners('closed')
    win.destroy()
  }
  outputs.clear()
}

/** Assign an output role to a display (opening / replacing / closing its window). */
function setScreen(displayId: number, role: ScreenRole): ScreenInfo[] {
  if (role === 'off') {
    closeScreen(displayId)
    return screensStatus()
  }
  const display = displayById(displayId)
  const windowed = displayId === controlDisplayId()
  const existing = outputs.get(displayId)
  if (existing && existing._kind === role && existing._windowed === windowed) {
    existing.show()
    existing.focus()
  } else {
    if (existing) {
      outputs.delete(displayId)
      existing.removeAllListeners('closed')
      existing.destroy()
    }
    outputs.set(displayId, buildOutputWindow(display, windowed, role))
  }
  broadcastScreens()
  return screensStatus()
}

/** Close outputs whose display is no longer connected. */
function pruneOutputs(): void {
  const ids = new Set(screen.getAllDisplays().map((d) => d.id))
  for (const displayId of [...outputs.keys()]) {
    if (!ids.has(displayId)) closeScreen(displayId)
  }
}

function screensStatus(): ScreenInfo[] {
  const out: ScreenInfo[] = []
  for (const [displayId, win] of outputs) {
    out.push({ displayId, role: (win._kind ?? 'audience') as ScreenRole, windowed: !!win._windowed })
  }
  return out
}

function broadcastScreens(): void {
  controlWindow?.webContents.send(IPC.screensChanged, screensStatus())
}

function broadcastLive(): void {
  for (const win of outputs.values()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.liveState, liveState)
  }
}

function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Display ${i + 1} (${d.size.width}×${d.size.height})`,
    bounds: d.bounds,
    primary: d.id === primaryId,
    internal: (d as Electron.Display & { internal?: boolean }).internal ?? false
  }))
}

// ---- IPC -------------------------------------------------------------------
function registerIpc(): void {
  ipcMain.handle(IPC.displaysList, () => listDisplays())
  ipcMain.handle(IPC.screensStatus, () => screensStatus())
  ipcMain.handle(IPC.screenSet, (_e, displayId: number, role: ScreenRole) => setScreen(displayId, role))

  ipcMain.handle(IPC.liveGet, () => liveState)
  ipcMain.handle(IPC.liveSet, (_e, patch: Partial<LiveState>) => {
    liveState = { ...liveState, ...patch }
    broadcastLive()
    publishBroadcast(liveState)
    return liveState
  })

  ipcMain.handle(IPC.broadcastGet, () => getBroadcastConfig())
  ipcMain.handle(IPC.broadcastStatusGet, () => getBroadcastStatus())
  ipcMain.handle(IPC.broadcastSet, (_e, patch: Partial<BroadcastConfig>) => setBroadcastConfig(patch))

  ipcMain.handle(IPC.pickMedia, async () => {
    const res = await dialog.showOpenDialog(controlWindow!, {
      title: 'Add media',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'm4v'] }
      ]
    })
    if (res.canceled) return []
    return res.filePaths.map((p) => ({
      path: p,
      name: p.split(/[\\/]/).pop() ?? p,
      url: mediaUrl(p),
      isVideo: /\.(mp4|webm|mov|m4v)$/i.test(p)
    }))
  })

  ipcMain.handle(IPC.pickPptx, async () => {
    const res = await dialog.showOpenDialog(controlWindow!, {
      title: 'Import PowerPoint',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }]
    })
    if (res.canceled) return []
    const cacheDir = join(app.getPath('userData'), 'pptx-cache')
    return importPptxFiles(res.filePaths, cacheDir, mediaUrl)
  })

  // Read a bundled full Bible translation (resources/bible/<id>.json). Ids are
  // whitelisted so this can never read an arbitrary path; parsed results are
  // cached so re-selecting a translation doesn't re-read the (large) file.
  ipcMain.handle(IPC.bibleLoad, async (_e, id: string) => {
    if (!BUNDLED_TRANSLATIONS.has(id)) return null
    if (translationCache.has(id)) return translationCache.get(id)
    try {
      const file = join(app.getAppPath(), 'resources', 'bible', `${id}.json`)
      const data = JSON.parse(await readFile(file, 'utf8'))
      translationCache.set(id, data)
      return data
    } catch (err) {
      console.error(`Failed to load translation "${id}":`, err)
      return null
    }
  })

  // ---- services (saved setlists) persistence ----
  ipcMain.handle(IPC.servicesList, () => listServices())
  ipcMain.handle(IPC.serviceSave, async (_e, service: Service) => {
    if (!isSafeId(service?.id)) throw new Error('invalid service id')
    await ensureServicesDir()
    await writeFile(serviceFile(service.id), JSON.stringify(service), 'utf8')
    return listServices()
  })
  ipcMain.handle(IPC.serviceLoad, async (_e, id: string): Promise<Service | null> => {
    if (!isSafeId(id)) return null
    try {
      return JSON.parse(await readFile(serviceFile(id), 'utf8'))
    } catch {
      return null
    }
  })
  ipcMain.handle(IPC.serviceDelete, async (_e, id: string) => {
    if (isSafeId(id)) await unlink(serviceFile(id)).catch(() => {})
    return listServices()
  })

  // ---- songs (library) persistence ----
  ipcMain.handle(IPC.songsList, () => listSongs())
  ipcMain.handle(IPC.songSave, async (_e, song: Song) => {
    if (!isSafeId(song?.id)) throw new Error('invalid song id')
    await mkdir(songsDir(), { recursive: true })
    await writeFile(songFile(song.id), JSON.stringify(song), 'utf8')
    return listSongs()
  })
  ipcMain.handle(IPC.songLoad, async (_e, id: string): Promise<Song | null> => {
    if (!isSafeId(id)) return null
    try {
      return JSON.parse(await readFile(songFile(id), 'utf8'))
    } catch {
      return null
    }
  })
  ipcMain.handle(IPC.songDelete, async (_e, id: string) => {
    if (isSafeId(id)) await unlink(songFile(id)).catch(() => {})
    return listSongs()
  })

  // Remote song catalog (Telugu backend). Fetched in main to avoid renderer
  // CSP/CORS; cached for the session. Render free tiers cold-start, so allow time.
  ipcMain.handle(IPC.songsRemote, async () => {
    if (remoteSongsCache) return remoteSongsCache
    const base = process.env.LUMEN_SONGS_API || 'https://grey-gratis-ice.onrender.com'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 70_000)
    try {
      const res = await fetch(`${base}/songs`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) return { error: 'Unexpected response from songs backend' }
      remoteSongsCache = data
      return remoteSongsCache
    } catch (err) {
      console.error('Remote songs fetch failed:', err)
      return { error: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(timer)
    }
  })
}
let remoteSongsCache: unknown[] | null = null

// ---- songs storage helpers ----
function songsDir(): string {
  return join(app.getPath('userData'), 'songs')
}
function songFile(id: string): string {
  return join(songsDir(), `${id}.json`)
}
async function listSongs(): Promise<SongMeta[]> {
  try {
    const files = (await readdir(songsDir())).filter((f) => f.endsWith('.json'))
    const metas = await Promise.all(
      files.map(async (f): Promise<SongMeta | null> => {
        try {
          const s: Song = JSON.parse(await readFile(join(songsDir(), f), 'utf8'))
          return { id: s.id, title: String(s.title ?? 'Untitled'), author: s.author, savedAt: s.savedAt }
        } catch {
          return null
        }
      })
    )
    return metas
      .filter((m): m is SongMeta => m !== null)
      .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  } catch {
    return []
  }
}

// ---- services storage helpers ----
function servicesDir(): string {
  return join(app.getPath('userData'), 'services')
}
function serviceFile(id: string): string {
  return join(servicesDir(), `${id}.json`)
}
function isSafeId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]+$/i.test(id)
}
async function ensureServicesDir(): Promise<void> {
  await mkdir(servicesDir(), { recursive: true })
}
async function listServices(): Promise<ServiceMeta[]> {
  try {
    const files = (await readdir(servicesDir())).filter((f) => f.endsWith('.json'))
    const metas = await Promise.all(
      files.map(async (f): Promise<ServiceMeta | null> => {
        try {
          const s: Service = JSON.parse(await readFile(join(servicesDir(), f), 'utf8'))
          return { id: s.id, name: s.name, savedAt: s.savedAt, itemCount: s.items?.length ?? 0 }
        } catch {
          return null
        }
      })
    )
    return metas
      .filter((m): m is ServiceMeta => m !== null)
      .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
  } catch {
    return []
  }
}

const BUNDLED_TRANSLATIONS = new Set(['telugu'])
const translationCache = new Map<string, unknown>()

// ---- lifecycle -------------------------------------------------------------
app.whenReady().then(() => {
  // Serve local media files over the privileged scheme.
  protocol.handle(MEDIA_SCHEME, (request) => {
    // url shape: lumen-media://local/<encodeURIComponent(absolutePath)>
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return net.fetch(pathToFileURL(filePath).toString())
  })

  registerIpc()
  void initBroadcast((s) => controlWindow?.webContents.send(IPC.broadcastStatus, s))
  createControlWindow()

  const onDisplaysChanged = (): void => {
    pruneOutputs()
    controlWindow?.webContents.send(IPC.displaysChanged, listDisplays())
    broadcastScreens()
  }
  screen.on('display-added', onDisplaysChanged)
  screen.on('display-removed', onDisplaysChanged)
  screen.on('display-metrics-changed', onDisplaysChanged)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
