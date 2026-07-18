import { app, shell, BrowserWindow, ipcMain, screen, dialog, protocol } from 'electron'
import { initAutoUpdate } from './autoUpdate'
import { join } from 'path'
import { readFile, writeFile, readdir, unlink, mkdir, stat } from 'fs/promises'
import { readFileSync, createReadStream } from 'fs'
import { Readable } from 'stream'
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
  type ServiceExport,
  type Song,
  type SongMeta,
  type PsalmVerse,
  type PsalmEnglish,
  type PsalmsResult,
  type PsalmsError
} from '../shared/types'
import { importPptxFiles } from './pptx'
import { exportSessionToPptx, exportUrlFrom, preloadPathFrom } from './pptxExport'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { DEFAULT_BACKGROUND, DEFAULT_THEME } from '../shared/types'
import { cachedFetchJson } from './httpCache'
import { esvKeyStatus, esvSetKey, esvPassage } from './esv'
import type { PptxExportRequest } from '../shared/types'
import {
  initBroadcast,
  publishBroadcast,
  getBroadcastConfig,
  setBroadcastConfig,
  getBroadcastStatus,
  initControlListener
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

const MEDIA_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
}
function mediaMime(p: string): string {
  const ext = p.slice(p.lastIndexOf('.') + 1).toLowerCase()
  return MEDIA_MIME[ext] ?? 'application/octet-stream'
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
    title: 'Cantica',
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
    title: kind === 'stage' ? 'Cantica Stage' : 'Cantica Output',
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

  // Export the whole session to a .pptx (one image slide per slide, captured from
  // the live Stage). LUMEN_EXPORT_TEST=<path> skips the save dialog (test hook).
  ipcMain.handle(IPC.pptxExport, async (_e, req: PptxExportRequest) => {
    if (!req?.items?.length) return { ok: false, error: 'The session has no slides to export.' }
    const safeName = (req.name || 'Cantica Session').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Cantica Session'

    let filePath = process.env.LUMEN_EXPORT_TEST
    if (!filePath) {
      const res = await dialog.showSaveDialog(controlWindow!, {
        title: 'Export to PowerPoint',
        defaultPath: `${safeName}.pptx`,
        filters: [{ name: 'PowerPoint', extensions: ['pptx'] }]
      })
      if (res.canceled || !res.filePath) return { ok: false, canceled: true }
      filePath = res.filePath
    }

    try {
      const { count } = await exportSessionToPptx(req, filePath, {
        preloadPath: preloadPathFrom(__dirname),
        exportUrl: exportUrlFrom(rendererUrl('output')),
        onProgress: (done, total) =>
          controlWindow?.webContents.send(IPC.pptxExportProgress, { done, total })
      })
      return { ok: true, path: filePath, count }
    } catch (err) {
      console.error('PowerPoint export failed:', err)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Read a bundled full Bible translation (resources/bible/<id>.json). Ids are
  // whitelisted so this can never read an arbitrary path; parsed results are
  // cached so re-selecting a translation doesn't re-read the (large) file.
  ipcMain.handle(IPC.bibleLoad, async (_e, id: string) => loadBundledTranslation(id))

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

  // Export the whole service as a .zip containing BOTH a rendered PowerPoint
  // (pixel-faithful, one image slide per slide) and the portable JSON envelope.
  ipcMain.handle(IPC.serviceExport, async (_e, env: ServiceExport) => {
    const svc = env?.service
    if (!svc?.items?.length) return { ok: false, error: 'Nothing to export — the service has no slides.' }
    const name = (svc.name || 'Cantica Service').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Cantica Service'
    const res = await dialog.showSaveDialog(controlWindow!, {
      title: 'Export service (PowerPoint + JSON, zipped)',
      defaultPath: `${name}.zip`,
      filters: [{ name: 'Zip archive', extensions: ['zip'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, canceled: true }
    try {
      const { bytes: pptxBytes, count } = await exportSessionToPptx(
        { name, items: svc.items, background: svc.background ?? DEFAULT_BACKGROUND, theme: svc.theme ?? DEFAULT_THEME },
        null,
        {
          preloadPath: preloadPathFrom(__dirname),
          exportUrl: exportUrlFrom(rendererUrl('output')),
          onProgress: (done, total) => controlWindow?.webContents.send(IPC.pptxExportProgress, { done, total })
        }
      )
      const zip = zipSync(
        { [`${name}.pptx`]: pptxBytes, [`${name}.cantica.json`]: strToU8(JSON.stringify(env, null, 2)) },
        { level: 4 }
      )
      await writeFile(res.filePath, Buffer.from(zip))
      return { ok: true, path: res.filePath, count }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Import a service from a .json OR a .zip (reads the .json inside). Accepts our
  // envelope (`{service:…}`) or a bare service object (`{items:…}`) so an external
  // tool's export still loads.
  ipcMain.handle(IPC.serviceImport, async () => {
    const res = await dialog.showOpenDialog(controlWindow!, {
      title: 'Import service (JSON or ZIP)',
      properties: ['openFile'],
      filters: [{ name: 'Cantica service', extensions: ['json', 'zip'] }]
    })
    if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true }
    const filePath = res.filePaths[0]
    try {
      let text: string
      if (/\.zip$/i.test(filePath)) {
        const entries = unzipSync(new Uint8Array(await readFile(filePath)))
        const jsonName = Object.keys(entries).find((n) => /\.json$/i.test(n))
        if (!jsonName) return { ok: false, error: 'That zip has no service JSON inside it.' }
        text = strFromU8(entries[jsonName])
      } else {
        text = await readFile(filePath, 'utf8')
      }
      const raw = JSON.parse(text)
      const svc = raw?.service ?? raw
      if (!svc || !Array.isArray(svc.items)) {
        return { ok: false, error: 'That file isn’t a Cantica service (no slides found).' }
      }
      const service: Service = {
        id: '',
        name: String(svc.name || 'Imported Service'),
        items: svc.items,
        background: svc.background,
        theme: svc.theme
      }
      const obsStyle = raw?.obsStyle ?? svc?.obsStyle
      return { ok: true, service, obsStyle }
    } catch {
      return { ok: false, error: 'Could not read that file — it isn’t a valid JSON/ZIP.' }
    }
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
  // CSP/CORS, then served from the on-disk 24h cache so a browse doesn't re-hit
  // the backend. `force` (the manual Refresh) bypasses the cache.
  ipcMain.handle(IPC.songsRemote, async (_e, force?: boolean) => {
    const base = process.env.LUMEN_SONGS_API || 'https://grey-gratis-ice.onrender.com'
    return cachedFetchJson('songs', `${base}/songs`, {
      force: !!force,
      validate: (d): d is unknown[] => Array.isArray(d)
    })
  })

  // Psalms (bilingual): Telugu OV (bundled) + English. The English is either the
  // bundled WEBBE (offline, public domain) or the ESV fetched on demand from the
  // Crossway API; an ESV request with no key / a failure falls back to WEBBE.
  ipcMain.handle(
    IPC.psalmsGet,
    async (_e, chapter: number, start?: number, end?: number, english?: PsalmEnglish) => {
      const ch = Math.max(1, Math.min(150, Math.floor(chapter) || 1))
      return psalmsResult(ch, start, end, english === 'esv' ? 'esv' : 'webbe')
    }
  )

  // ESV API key management (stored in userData, never returned to the renderer).
  ipcMain.handle(IPC.esvKeyStatus, () => esvKeyStatus())
  ipcMain.handle(IPC.esvKeySet, (_e, key: string) => esvSetKey(key))
}

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

const BUNDLED_TRANSLATIONS = new Set(['telugu', 'web'])
const translationCache = new Map<string, unknown>()

interface BundledTranslation {
  verses: { book: string; chapter: number; verse: number; text: string }[]
  [k: string]: unknown
}

/** Read + cache a bundled translation JSON (resources/bible/<id>.json). Ids are
 *  whitelisted so this can never read an arbitrary path; the (large) file is read
 *  once and the parsed result kept in memory. */
async function loadBundledTranslation(id: string): Promise<BundledTranslation | null> {
  if (!BUNDLED_TRANSLATIONS.has(id)) return null
  if (translationCache.has(id)) return translationCache.get(id) as BundledTranslation
  try {
    const file = join(app.getAppPath(), 'resources', 'bible', `${id}.json`)
    const data = JSON.parse(await readFile(file, 'utf8')) as BundledTranslation
    translationCache.set(id, data)
    return data
  } catch (err) {
    console.error(`Failed to load translation "${id}":`, err)
    return null
  }
}

/** Psalms verse numbers of a chapter from a bundled translation. */
function psalmMap(t: BundledTranslation | null, chapter: number): Map<number, string> {
  const m = new Map<number, string>()
  for (const v of t?.verses ?? []) if (v.book === 'Psalms' && v.chapter === chapter) m.set(v.verse, v.text)
  return m
}

/** Bilingual Psalms: Telugu OV (bundled) + English (bundled WEBBE, or ESV via the
 *  Crossway API). Paired by verse number — both English texts use English
 *  versification, so the numbers line up with the Telugu. */
async function psalmsResult(
  chapter: number,
  start: number | undefined,
  end: number | undefined,
  english: PsalmEnglish
): Promise<PsalmsResult | PsalmsError> {
  const [teDoc, webbeDoc] = await Promise.all([
    loadBundledTranslation('telugu'),
    loadBundledTranslation('web')
  ])
  const teMap = psalmMap(teDoc, chapter)
  const webbeMap = psalmMap(webbeDoc, chapter)

  const s = start != null && end != null ? Math.max(1, Math.floor(Number(start)) || 1) : undefined
  const e = s != null && end != null ? Math.max(s, Math.floor(Number(end)) || s) : undefined

  const pair = (enMap: Map<number, string>, used: PsalmEnglish, notice?: string): PsalmsResult => {
    let nums = [...new Set([...teMap.keys(), ...enMap.keys()])].sort((a, b) => a - b)
    if (s != null && e != null) nums = nums.filter((n) => n >= s && n <= e)
    return {
      english: used,
      notice,
      verses: nums.map((verse) => ({
        id: chapter * 1000 + verse,
        chapter,
        verse,
        telugu: teMap.get(verse) ?? '',
        english: enMap.get(verse) ?? ''
      }))
    }
  }

  if (english === 'esv') {
    const q = s != null && e != null ? `Psalm ${chapter}:${s}-${e}` : `Psalm ${chapter}`
    const esv = await esvPassage(q)
    if ('error' in esv) {
      // The key lives on the server now — nothing for the operator to fix in-app,
      // so always fall back to WEBBE with a note; a live service never breaks.
      const why = esv.needKey ? 'not configured on the server' : esv.error
      return pair(webbeMap, 'webbe', `ESV unavailable (${why}) — showing WEBBE.`)
    }
    return pair(new Map(esv.verses.map((v) => [v.verse, v.text])), 'esv')
  }
  return pair(webbeMap, 'webbe')
}

// ---- lifecycle -------------------------------------------------------------
/**
 * Load a local `.env` into process.env at runtime (dev / running from source),
 * without a dependency and WITHOUT baking anything into the build. Existing env
 * vars win. Used to pick up ESV_API_KEY from a gitignored .env — the key is
 * never committed or shipped. In a packaged app there is no .env here, so this is
 * a harmless no-op and the key comes from the env var or the app data dir.
 */
function loadDotEnv(): void {
  for (const dir of [process.cwd(), app.getAppPath()]) {
    let text: string
    try {
      text = readFileSync(join(dir, '.env'), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!m || m[1] in process.env) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      process.env[m[1]] = v
    }
    return
  }
}

app.whenReady().then(() => {
  loadDotEnv()

  // Serve local media files over the privileged scheme.
  protocol.handle(MEDIA_SCHEME, async (request) => {
    // url shape: lumen-media://local/<encodeURIComponent(absolutePath)>
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    try {
      const size = (await stat(filePath)).size
      const type = mediaMime(filePath)
      // <video>/<audio> stream via HTTP Range requests and expect 206 + a range
      // header; without this a video background loads the whole file at once (or
      // fails to seek/loop). Images send no Range and get a plain 200.
      const range = request.headers.get('range')
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range)
        let start = m && m[1] ? parseInt(m[1], 10) : 0
        let end = m && m[2] ? parseInt(m[2], 10) : size - 1
        if (!Number.isFinite(start) || start < 0) start = 0
        if (!Number.isFinite(end) || end >= size) end = size - 1
        if (start > end) {
          start = 0
          end = size - 1
        }
        const body = Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream
        return new Response(body, {
          status: 206,
          headers: {
            'Content-Type': type,
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes'
          }
        })
      }
      const body = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  registerIpc()
  // Forward phone-remote commands to the control window (which runs them against
  // the live deck). Wire the callback before initBroadcast so a listener that
  // starts as soon as config loads has somewhere to deliver.
  initControlListener((cmd, arg) => controlWindow?.webContents.send(IPC.remoteCommand, { cmd, arg }))
  void initBroadcast((s) => controlWindow?.webContents.send(IPC.broadcastStatus, s))
  createControlWindow()
  initAutoUpdate()

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
