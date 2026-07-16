import { useEffect, useState } from 'react'
import { Icon } from '../../shared/Icon'
import { DEFAULT_OBS_STYLE, type BroadcastConfig, type BroadcastStatus, type ObsStyle } from '@shared/types'

const EMPTY: BroadcastConfig = { enabled: false, base: '', room: '', obsStyle: { ...DEFAULT_OBS_STYLE } }

const POSITIONS: Array<{ id: ObsStyle['position']; label: string }> = [
  { id: 'top', label: 'Top' },
  { id: 'center', label: 'Center' },
  { id: 'bottom', label: 'Bottom' }
]

// Where the phone-remote page lives (the Cantica web app — a different origin
// than the relay, which only serves the OBS/audience /view pages).
const REMOTE_BASE = 'https://live.teluguchurchdfw.org'

/** The base /view URL; `mode` picks the audience mirror or the OBS lower-third. */
function viewUrl(c: BroadcastConfig, mode: 'audience' | 'obs'): string {
  if (!c.base || !c.room) return ''
  const u = `${c.base.replace(/\/$/, '')}/broadcast/${encodeURIComponent(c.room)}/view`
  return mode === 'audience' ? `${u}?mode=audience` : u
}

/** Deep link that opens the phone remote pre-filled with this room + PIN. */
function remoteUrl(c: BroadcastConfig): string {
  if (!c.room || !c.controlPin) return ''
  return `${REMOTE_BASE.replace(/\/$/, '')}/remote?room=${encodeURIComponent(c.room)}&pin=${encodeURIComponent(c.controlPin)}`
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
  const [styleOpen, setStyleOpen] = useState(true)
  const [cfg, setCfg] = useState<BroadcastConfig>(EMPTY)
  const [status, setStatus] = useState<BroadcastStatus | null>(null)
  const [copied, setCopied] = useState<'audience' | 'obs' | 'remote' | null>(null)

  useEffect(() => {
    void window.lumen.getBroadcast().then(setCfg)
    void window.lumen.getBroadcastStatus().then(setStatus)
    return window.lumen.onBroadcastStatus(setStatus)
  }, [])

  const patch = async (p: Partial<BroadcastConfig>): Promise<void> => {
    setCfg(await window.lumen.setBroadcast(p))
  }

  const os = cfg.obsStyle ?? DEFAULT_OBS_STYLE
  const patchStyle = (p: Partial<ObsStyle>): void => void patch({ obsStyle: { ...os, ...p } })
  // Present the lower-third size as a friendly % of the default (5.2cqh = 100%).
  const sizePct = Math.round((os.size / DEFAULT_OBS_STYLE.size) * 100)

  const audienceUrl = viewUrl(cfg, 'audience')
  const obsUrl = viewUrl(cfg, 'obs')
  const phoneUrl = remoteUrl(cfg)
  const live = cfg.enabled && status?.ok
  const dotClass = !cfg.enabled ? 'off' : status?.ok ? 'on' : 'warn'

  const copy = (which: 'audience' | 'obs' | 'remote', url: string): void => {
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

            <div className="bc-obsstyle">
              <button className="bc-adv-toggle with-ico" onClick={() => setStyleOpen((v) => !v)}>
                <Icon name={styleOpen ? 'chevron-down' : 'chevron-right'} /> OBS text — size &amp; style
              </button>
              {styleOpen && (
                <div className="bc-style-body">
                  <div className="bc-field">
                    <span>
                      Text size <b className="bc-size-val">{sizePct}%</b>
                    </span>
                    <div className="bc-size-row">
                      <span className="bc-size-a sm">A</span>
                      <input
                        type="range"
                        min={60}
                        max={170}
                        step={5}
                        value={sizePct}
                        onChange={(e) =>
                          patchStyle({
                            size: +((DEFAULT_OBS_STYLE.size * Number(e.target.value)) / 100).toFixed(2)
                          })
                        }
                      />
                      <span className="bc-size-a lg">A</span>
                    </div>
                  </div>

                  <div className="bc-field">
                    <span>Position</span>
                    <div className="bc-seg">
                      {POSITIONS.map((p) => (
                        <button
                          key={p.id}
                          className={`bc-seg-btn ${os.position === p.id ? 'active' : ''}`}
                          onClick={() => patchStyle({ position: p.id })}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bc-style-colors">
                    <label className="bc-color">
                      <input
                        type="color"
                        value={os.textColor}
                        onChange={(e) => patchStyle({ textColor: e.target.value })}
                      />
                      <span>Text</span>
                    </label>
                    <label className="bc-color">
                      <input
                        type="color"
                        value={os.accentColor}
                        onChange={(e) => patchStyle({ accentColor: e.target.value })}
                      />
                      <span>Caption</span>
                    </label>
                  </div>

                  <label className="bc-toggle">
                    <input
                      type="checkbox"
                      checked={os.uppercase}
                      onChange={(e) => patchStyle({ uppercase: e.target.checked })}
                    />
                    ALL CAPS lyrics
                  </label>
                  <label className="bc-toggle">
                    <input
                      type="checkbox"
                      checked={os.scrim}
                      onChange={(e) => patchStyle({ scrim: e.target.checked })}
                    />
                    Shaded band behind text
                  </label>

                  <button
                    className="bc-adv-toggle bc-style-reset"
                    onClick={() => void patch({ obsStyle: { ...DEFAULT_OBS_STYLE } })}
                  >
                    Reset to default
                  </button>
                </div>
              )}
            </div>

            <div className="bc-field">
              <span>Phone remote — a helper can advance slides from their phone</span>
              <div className="bc-url">
                <input readOnly value={phoneUrl} placeholder="Start broadcasting to enable" spellCheck={false} />
                <button className="btn tiny" onClick={() => copy('remote', phoneUrl)} disabled={!phoneUrl}>
                  {copied === 'remote' ? 'Copied' : 'Copy'}
                </button>
                <button className="btn tiny" onClick={() => openPage(phoneUrl)} disabled={!phoneUrl}>
                  Open
                </button>
              </div>
              <div className="bc-remote-pin">
                Control PIN: <b>{cfg.controlPin || '—'}</b>
                <button
                  className="btn tiny"
                  title="Generate a new PIN — the old one stops working immediately"
                  onClick={() => void patch({ controlPin: '' })}
                >
                  New PIN
                </button>
              </div>
            </div>

            <button className="bc-adv-toggle with-ico" onClick={() => setAdv((v) => !v)}>
              <Icon name={adv ? 'chevron-down' : 'chevron-right'} /> Advanced
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
