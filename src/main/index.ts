import { app, shell, BrowserWindow, ipcMain, screen, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc'
import { DEFAULT_LIVE, type LiveState, type DisplayInfo, type OutputStatus } from '../shared/types'

// ---- app state -------------------------------------------------------------
let controlWindow: BrowserWindow | null = null
let outputWindow: BrowserWindow | null = null
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
    closeOutput()
  })
  controlWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  controlWindow.loadURL(rendererUrl('index'))
}

function targetDisplay(displayId: number | null): Electron.Display {
  const all = screen.getAllDisplays()
  const chosen = displayId != null ? all.find((d) => d.id === displayId) : undefined
  if (chosen) return chosen
  // Prefer a non-primary (external) display for the audience output.
  const external = all.find((d) => d.id !== screen.getPrimaryDisplay().id)
  return external ?? screen.getPrimaryDisplay()
}

function openOutput(displayId: number | null): OutputStatus {
  const display = targetDisplay(displayId)

  if (outputWindow) {
    const { x, y, width, height } = display.bounds
    outputWindow.setBounds({ x, y, width, height })
    outputWindow.setFullScreen(true)
    outputWindow.focus()
    return getOutputStatus()
  }

  outputWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    backgroundColor: '#000000',
    fullscreen: true,
    show: false,
    title: 'Lumen Output',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })

  ;(outputWindow as BrowserWindow & { _displayId?: number })._displayId = display.id

  outputWindow.on('ready-to-show', () => outputWindow?.show())
  outputWindow.on('closed', () => {
    outputWindow = null
    broadcastOutputStatus()
  })

  outputWindow.loadURL(rendererUrl('output'))
  outputWindow.webContents.once('did-finish-load', () => {
    outputWindow?.webContents.send(IPC.liveState, liveState)
    broadcastOutputStatus()
  })

  return getOutputStatus()
}

function closeOutput(): void {
  if (outputWindow) {
    outputWindow.destroy()
    outputWindow = null
  }
  broadcastOutputStatus()
}

function getOutputStatus(): OutputStatus {
  return {
    open: !!outputWindow,
    displayId: outputWindow
      ? (outputWindow as BrowserWindow & { _displayId?: number })._displayId ?? null
      : null
  }
}

function broadcastOutputStatus(): void {
  controlWindow?.webContents.send(IPC.outputChanged, getOutputStatus())
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
  ipcMain.handle(IPC.outputStatus, () => getOutputStatus())
  ipcMain.handle(IPC.outputOpen, (_e, displayId: number | null) => openOutput(displayId))
  ipcMain.handle(IPC.outputClose, () => {
    closeOutput()
    return getOutputStatus()
  })

  ipcMain.handle(IPC.liveGet, () => liveState)
  ipcMain.handle(IPC.liveSet, (_e, patch: Partial<LiveState>) => {
    liveState = { ...liveState, ...patch }
    outputWindow?.webContents.send(IPC.liveState, liveState)
    return liveState
  })

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
      url: `${MEDIA_SCHEME}://local/${encodeURIComponent(p)}`,
      isVideo: /\.(mp4|webm|mov|m4v)$/i.test(p)
    }))
  })
}

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
  createControlWindow()

  screen.on('display-added', () => controlWindow?.webContents.send(IPC.displaysChanged, listDisplays()))
  screen.on('display-removed', () => controlWindow?.webContents.send(IPC.displaysChanged, listDisplays()))
  screen.on('display-metrics-changed', () =>
    controlWindow?.webContents.send(IPC.displaysChanged, listDisplays())
  )

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
