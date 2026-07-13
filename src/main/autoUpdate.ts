import { app, dialog, net, shell } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

const REPO = 'gowthamrajum/lumen-presenter'
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`

/** a.b.c newer-than compare (missing parts = 0). */
function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}

/**
 * $0 auto-update. Windows (NSIS) self-updates from GitHub Releases via
 * electron-updater — works unsigned. macOS/Linux builds are unsigned and can't
 * self-apply, so we just check the Releases API and offer to open the download
 * page. No paid certs, no update server.
 */
export function initAutoUpdate(): void {
  if (!app.isPackaged) return // never in dev

  if (process.platform === 'win32') {
    autoUpdater.autoDownload = true
    autoUpdater.on('error', (err) => console.error('auto-update:', err?.message ?? err))
    // Download in the background; install on next quit, and notify when ready.
    autoUpdater.checkForUpdatesAndNotify().catch((e) => console.error('auto-update:', e))
    return
  }

  // macOS / Linux: lightweight version check against the Releases API.
  void checkAndNotify()
}

async function checkAndNotify(): Promise<void> {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = String(data.tag_name ?? '').replace(/^v/, '')
    if (!latest || !isNewer(latest, app.getVersion())) return
    const r = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update available',
      message: `Cantica ${latest} is available.`,
      detail: 'Open the download page to get the latest version.'
    })
    if (r.response === 0) void shell.openExternal(data.html_url ?? RELEASES_URL)
  } catch (e) {
    console.error('update check:', e)
  }
}
