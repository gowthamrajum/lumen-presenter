import { useEffect, useState } from 'react'
import type { BroadcastConfig, BroadcastStatus } from '@shared/types'

const EMPTY: BroadcastConfig = { enabled: false, base: '', room: '' }

/** The public web page (also the OBS browser-source URL) for this broadcast. */
function pageUrl(c: BroadcastConfig): string {
  if (!c.base || !c.room) return ''
  return `${c.base.replace(/\/$/, '')}/broadcast/${encodeURIComponent(c.room)}/view`
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
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void window.lumen.getBroadcast().then(setCfg)
    void window.lumen.getBroadcastStatus().then(setStatus)
    return window.lumen.onBroadcastStatus(setStatus)
  }, [])

  const patch = async (p: Partial<BroadcastConfig>): Promise<void> => {
    setCfg(await window.lumen.setBroadcast(p))
  }

  const url = pageUrl(cfg)
  const live = cfg.enabled && status?.ok
  const dotClass = !cfg.enabled ? 'off' : status?.ok ? 'on' : 'warn'

  const copy = (): void => {
    if (!url) return
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  const openPage = (): void => {
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
              <span>Web page (open in a browser or add to OBS)</span>
              <div className="bc-url">
                <input readOnly value={url} placeholder="…" spellCheck={false} />
                <button className="btn tiny" onClick={copy} disabled={!url}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button className="btn tiny" onClick={openPage} disabled={!url}>
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
              Add the web page as a <b>Browser source</b> in OBS (transparent background). Anyone with the
              link can watch the lyrics live.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
