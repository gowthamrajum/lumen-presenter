import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { progressText, useBgCacheProgress } from '../useBgCacheProgress'
import { BroadcastMenu } from './BroadcastMenu'
import { ScreenBackgroundPicker, screenBackgroundLabel } from './ScreenBackgroundPicker'
import { Icon } from '../../shared/Icon'
import { useAppTheme } from '../appTheme'
import type { ScreenRole } from '@shared/types'

export function TopBar(): JSX.Element {
  const displays = useStore((s) => s.displays)
  const screens = useStore((s) => s.screens)
  const setScreen = useStore((s) => s.setScreen)
  const setMotionScreen = useStore((s) => s.setMotionScreen)
  const bgDl = useBgCacheProgress()
  const [motionOpen, setMotionOpen] = useState(false)
  const audienceScreens = screens.filter((sc) => sc.role === 'audience')
  const motionOn = audienceScreens.find((sc) => sc.motion)
  const labelOf = (id: number): string => displays.find((d) => d.id === id)?.label ?? 'Screen'

  const blackout = useStore((s) => s.blackout)
  const clearText = useStore((s) => s.clearText)
  const showLogo = useStore((s) => s.showLogo)
  const toggleBlackout = useStore((s) => s.toggleBlackout)
  const toggleClear = useStore((s) => s.toggleClear)
  const toggleLogo = useStore((s) => s.toggleLogo)

  const [open, setOpen] = useState(false)
  /** The screen whose background picker is open in the Screens menu, if any. */
  const [bgFor, setBgFor] = useState<number | null>(null)
  const setParityOpen = useStore((s) => s.setParityOpen)
  const [themeMode, toggleTheme] = useAppTheme()

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
        <span className="brand-mark">
          <Icon name="flame" />
        </span>
        <span className="brand-name">Cantica</span>
        <span className="brand-sub">Presenter</span>
      </div>

      <div className="topbar-spacer" />

      {/* A first launch brings the whole background library down, and until a
          video is here the projector can't play it from disk. Say so, where it
          is seen from any tab, for exactly as long as it is happening. */}
      {bgDl?.active && (() => {
        const { label, fraction } = progressText(bgDl)
        return (
          <div className="bg-dl" title={bgDl.name ? `Downloading ${bgDl.name}` : 'Downloading backgrounds'}>
            <span className="bg-dl-label">Downloading backgrounds {label}</span>
            <span className="bg-dl-bar">
              <span style={{ width: `${fraction * 100}%` }} />
            </span>
          </div>
        )
      })()}

      <div className="output-controls">
        <span className={`status-dot ${activeCount ? 'on' : 'off'}`} />
        {!anyAudience && preferred && (
          <button className="btn btn-primary" onClick={goLive} title="Show the audience output on the best screen">
            Go Live
          </button>
        )}
        <div className="screens-wrap">
          <button className="btn with-ico" onClick={() => setOpen((v) => !v)}>
            Screens{activeCount ? ` · ${activeCount}` : ''} <Icon name="chevron-down" />
          </button>
          {open && (
            <>
              <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
              <div className="screens-menu">
                <div className="screens-title">Output screens</div>
                {displays.map((d) => {
                  const role = roleOf(d.id)
                  const own = screens.find((s) => s.displayId === d.id)?.background
                  return (
                    <div key={d.id} className="screen-row">
                      <div className="screen-name" title={d.label}>
                        <Icon name={d.primary ? 'monitor' : 'tv'} className="screen-ico" />
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
                      {role === 'audience' && (
                        <>
                          <button
                            className={`screen-bg-btn ${own ? 'custom' : ''}`}
                            onClick={() => setBgFor((v) => (v === d.id ? null : d.id))}
                            title="Give this screen its own background"
                          >
                            <span className="screen-bg-label">Background</span>
                            <span className="screen-bg-value">{screenBackgroundLabel(own)}</span>
                            <Icon name={bgFor === d.id ? 'chevron-down' : 'chevron-right'} />
                          </button>
                          {bgFor === d.id && (
                            <ScreenBackgroundPicker displayId={d.id} current={own} onPicked={() => setBgFor(null)} />
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
                <div className="screens-hint">
                  Audience = lyrics/scripture · Stage = confidence monitor (current + next + clock).
                  Motion backgrounds play on songs only, on the one screen chosen under Motion.
                  Each audience screen can have its own background.
                  On this screen it opens as a window (press F for fullscreen, Esc to close).
                </div>
              </div>
            </>
          )}
        </div>
        {/* Which screen plays a motion background — its own button, there as
            soon as one screen is showing the service, so the choice is never
            hidden behind needing two. One screen at a time, or none. */}
        {audienceScreens.length > 0 && (
          <div className="screens-wrap">
            <button
              className={`btn with-ico motion-pick ${motionOn ? 'on' : ''}`}
              onClick={() => setMotionOpen((v) => !v)}
              title="Choose the screen that plays motion backgrounds (songs only)"
            >
              Motion: {motionOn ? labelOf(motionOn.displayId) : 'Off'} <Icon name="chevron-down" />
            </button>
            {motionOpen && (
              <>
                <div className="dropdown-backdrop" onClick={() => setMotionOpen(false)} />
                <div className="screens-menu motion-menu">
                  <div className="screens-title">Motion background plays on</div>
                  {audienceScreens.map((sc) => (
                    <button
                      key={sc.displayId}
                      className={`motion-opt ${sc.motion ? 'active' : ''}`}
                      onClick={() => {
                        void setMotionScreen(sc.displayId)
                        setMotionOpen(false)
                      }}
                    >
                      <span className="motion-dot" />
                      {labelOf(sc.displayId)}
                      {sc.windowed ? ' (this screen)' : ''}
                    </button>
                  ))}
                  <button
                    className={`motion-opt ${!motionOn ? 'active' : ''}`}
                    onClick={() => {
                      void setMotionScreen(-1)
                      setMotionOpen(false)
                    }}
                  >
                    <span className="motion-dot" />
                    Off — every screen still
                  </button>
                  <div className="screens-hint">
                    Songs only. The other screens, and the phones, show the default background.
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        <button
          className="btn with-ico"
          onClick={() => setParityOpen(true)}
          title="See the live slide as all three outputs will show it"
        >
          <Icon name="tv" /> Parity
        </button>
        <BroadcastMenu />
      </div>

      <div className="quick-controls">
        <button
          className="btn icon-btn theme-toggle"
          onClick={toggleTheme}
          title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} />
        </button>
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
