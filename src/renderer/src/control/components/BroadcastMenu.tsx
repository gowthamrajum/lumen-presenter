import { useEffect, useState } from 'react'
import type { BroadcastConfig, BroadcastStatus } from '@shared/types'

const EMPTY: BroadcastConfig = { enabled: false, base: '', room: '' }

/** The base /view URL; `mode` picks the audience mirror or the OBS lower-third. */
function viewUrl(c: BroadcastConfig, mode: 'audience' | 'obs'): string {
  if (!c.base || !c.room) return ''
  const u = `${c.base.replace(/\/$/, '')}/broadcast/${encodeURIComponent(c.room)}/view`
  return mode === 'audience' ? `${u}?mode=audience` : u
}

function ago(ts: number | null): string {
  if (!ts) return 'never'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 2) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.round(s / 60)}m ago`
}

export function BroadcastMenu(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [adv, setAdv] = useState(false)
  const [cfg, setCfg] = useState<BroadcastConfig>(EMPTY)
  const [status, setStatus] = useState<BroadcastStatus | null>(null)
  const [copied, setCopied] = useState<'audience' | 'obs' | null>(null)

  useEffect(() => {
    void window.lumen.getBroadcast().then(setCfg)
    void window.lumen.getBroadcastStatus().then(setStatus)
    return window.lumen.onBroadcastStatus(setStatus)
  }, [])

  const patch = async (p: Partial<BroadcastConfig>): Promise<void> => {
    setCfg(await window.lumen.setBroadcast(p))
  }

  const audienceUrl = viewUrl(cfg, 'audience')
  const obsUrl = viewUrl(cfg, 'obs')
  const live = cfg.enabled && status?.ok
  const dotClass = !cfg.enabled ? 'off' : status?.ok ? 'on' : 'warn'

  const copy = (which: 'audience' | 'obs', url: string): void => {
    if (!url) return
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    })
  }
  const openPage = (url: string): void => {
    if (url) window.open(url, '_blank')
  }

  return (
    <div className="broadcast-wrap screens-wrap">
      <button
        className={`btn toggle ${cfg.enabled ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Broadcast the live slide to a web page (for OBS / streaming)"
      >
        <span className={`status-dot ${dotClass}`} /> Broadcast
      </button>
      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="screens-menu broadcast-menu">
            <div className="screens-title">Web broadcast</div>

            <button
              className={`btn full ${cfg.enabled ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => void patch({ enabled: !cfg.enabled })}
            >
              {cfg.enabled ? 'Stop broadcasting' : 'Start broadcasting'}
            </button>

            <div className={`bc-status ${dotClass}`}>
              {!cfg.enabled
                ? 'Off — nothing is being published.'
                : status?.ok
                  ? `On air · sent ${ago(status.lastAt)}`
                  : status?.lastError
                    ? `Trying… (${status.lastError})`
                    : 'On air · waiting for the first slide…'}
            </div>

            <div className="bc-field">
              <span>User view — full audience screen (open in a browser)</span>
              <div className="bc-url">
                <input readOnly value={audienceUrl} placeholder="…" spellCheck={false} />
                <button className="btn tiny" onClick={() => copy('audience', audienceUrl)} disabled={!audienceUrl}>
                  {copied === 'audience' ? 'Copied' : 'Copy'}
                </button>
                <button className="btn tiny" onClick={() => openPage(audienceUrl)} disabled={!audienceUrl}>
                  Open
                </button>
              </div>
            </div>
            <div className="bc-field">
              <span>OBS view — transparent lyrics lower-third (Browser source)</span>
              <div className="bc-url">
                <input readOnly value={obsUrl} placeholder="…" spellCheck={false} />
                <button className="btn tiny" onClick={() => copy('obs', obsUrl)} disabled={!obsUrl}>
                  {copied === 'obs' ? 'Copied' : 'Copy'}
                </button>
                <button className="btn tiny" onClick={() => openPage(obsUrl)} disabled={!obsUrl}>
                  Open
                </button>
              </div>
            </div>

            <button className="bc-adv-toggle" onClick={() => setAdv((v) => !v)}>
              {adv ? '▾ Advanced' : '▸ Advanced'}
            </button>
            {adv && (
              <>
                <div className="bc-field">
                  <span>Relay server</span>
                  <input
                    value={cfg.base}
                    onChange={(e) => setCfg({ ...cfg, base: e.target.value })}
                    onBlur={() => void patch({ base: cfg.base })}
                    spellCheck={false}
                  />
                </div>
                <div className="bc-field">
                  <span>Channel</span>
                  <input
                    value={cfg.room}
                    onChange={(e) => setCfg({ ...cfg, room: e.target.value })}
                    onBlur={() => void patch({ room: cfg.room })}
                    spellCheck={false}
                  />
                </div>
              </>
            )}

            <div className="screens-hint">
              <b>User view</b> mirrors the full audience screen for anyone watching in a browser.{' '}
              <b>OBS view</b> is a transparent lyrics lower-third — add it as a <b>Browser source</b> in OBS.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
