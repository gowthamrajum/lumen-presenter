import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { BroadcastMenu } from './BroadcastMenu'
import type { ScreenRole } from '@shared/types'

export function TopBar(): JSX.Element {
  const displays = useStore((s) => s.displays)
  const screens = useStore((s) => s.screens)
  const setScreen = useStore((s) => s.setScreen)

  const blackout = useStore((s) => s.blackout)
  const clearText = useStore((s) => s.clearText)
  const showLogo = useStore((s) => s.showLogo)
  const toggleBlackout = useStore((s) => s.toggleBlackout)
  const toggleClear = useStore((s) => s.toggleClear)
  const toggleLogo = useStore((s) => s.toggleLogo)

  const [open, setOpen] = useState(false)

  const roleOf = (displayId: number): ScreenRole =>
    screens.find((s) => s.displayId === displayId)?.role ?? 'off'
  const activeCount = screens.length
  const anyAudience = screens.some((s) => s.role === 'audience')
  const preferred = displays.find((d) => !d.primary) ?? displays[0]

  const goLive = (): void => {
    if (preferred) void setScreen(preferred.id, 'audience')
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">✦</span>
        <span className="brand-name">Lumen</span>
        <span className="brand-sub">Presenter</span>
      </div>

      <div className="topbar-spacer" />

      <div className="output-controls">
        <span className={`status-dot ${activeCount ? 'on' : 'off'}`} />
        {!anyAudience && preferred && (
          <button className="btn btn-primary" onClick={goLive} title="Show the audience output on the best screen">
            Go Live
          </button>
        )}
        <div className="screens-wrap">
          <button className="btn" onClick={() => setOpen((v) => !v)}>
            Screens{activeCount ? ` · ${activeCount}` : ''} ▾
          </button>
          {open && (
            <>
              <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
              <div className="screens-menu">
                <div className="screens-title">Output screens</div>
                {displays.map((d) => {
                  const role = roleOf(d.id)
                  return (
                    <div key={d.id} className="screen-row">
                      <div className="screen-name" title={d.label}>
                        {d.primary ? '🖥 ' : '📺 '}
                        {d.label}
                        {d.primary ? ' (this screen)' : ''}
                      </div>
                      <div className="seg">
                        {(['off', 'audience', 'stage'] as ScreenRole[]).map((r) => (
                          <button
                            key={r}
                            className={`seg-btn ${role === r ? 'active' : ''}`}
                            onClick={() => void setScreen(d.id, r)}
                          >
                            {r === 'off' ? 'Off' : r === 'audience' ? 'Audience' : 'Stage'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <div className="screens-hint">
                  Audience = lyrics/scripture · Stage = confidence monitor (current + next + clock).
                  On this screen it opens as a window (press F for fullscreen, Esc to close).
                </div>
              </div>
            </>
          )}
        </div>
        <BroadcastMenu />
      </div>

      <div className="quick-controls">
        <button className={`btn toggle ${showLogo ? 'active' : ''}`} onClick={toggleLogo}>
          Logo
        </button>
        <button className={`btn toggle ${clearText ? 'active' : ''}`} onClick={toggleClear}>
          Clear
        </button>
        <button className={`btn toggle danger ${blackout ? 'active' : ''}`} onClick={toggleBlackout}>
          Black
        </button>
      </div>
    </header>
  )
}
