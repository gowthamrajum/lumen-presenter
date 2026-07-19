import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { Stage } from '../../shared/Stage'
import { Icon, type IconName } from '../../shared/Icon'
import type { LiveState } from '@shared/types'
import { THEME_PRESETS } from '../presets'
import { VERSE_EXTEND_MS } from '../useVerseAutoAdvance'

const ALIGN_ICON: Record<'left' | 'center' | 'right', IconName> = {
  left: 'align-left',
  center: 'align-center',
  right: 'align-right'
}

/** Live countdown shown while a Bible verse is set to auto-advance to the Sermon.
 *  Lets the operator add time or hold it. Renders nothing when nothing is pending. */
function SermonCountdown(): JSX.Element | null {
  const autoAdvanceAt = useStore((s) => s.autoAdvanceAt)
  const extend = useStore((s) => s.extendAutoAdvance)
  const cancel = useStore((s) => s.cancelAutoAdvance)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (autoAdvanceAt == null) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [autoAdvanceAt])

  if (autoAdvanceAt == null) return null
  const remain = Math.max(0, Math.ceil((autoAdvanceAt - now) / 1000))
  return (
    <div className="auto-advance">
      <Icon name="timer" />
      <span className="auto-advance-text">
        Sermon in <b>{remain}s</b>
      </span>
      <button
        className="btn tiny"
        onClick={() => extend(VERSE_EXTEND_MS)}
        title={`Hold the verse ${VERSE_EXTEND_MS / 1000}s longer`}
      >
        +{VERSE_EXTEND_MS / 1000}s
      </button>
      <button className="btn tiny" onClick={cancel} title="Stop the auto-advance and stay on the verse">
        Hold
      </button>
    </div>
  )
}

export function LivePanel(): JSX.Element {
  const items = useStore((s) => s.items)
  const deck = useMemo(() => items.flatMap((it) => it.slides), [items])
  const liveId = useStore((s) => s.liveId)
  const theme = useStore((s) => s.theme)
  const background = useStore((s) => s.background)
  const blackout = useStore((s) => s.blackout)
  const clearText = useStore((s) => s.clearText)
  const showLogo = useStore((s) => s.showLogo)
  const setTheme = useStore((s) => s.setTheme)
  const applyTheme = useStore((s) => s.applyTheme)
  const goNext = useStore((s) => s.goNext)
  const goPrev = useStore((s) => s.goPrev)

  const liveSlide = deck.find((d) => d.id === liveId) ?? null
  const liveIndex = deck.findIndex((d) => d.id === liveId)
  const nextSlide = liveIndex >= 0 ? deck[liveIndex + 1] ?? null : null

  const live: LiveState = {
    slide: liveSlide,
    background: liveSlide?.background ?? background,
    blackout,
    clearText,
    showLogo,
    theme
  }

  const nextPreview: LiveState = {
    slide: nextSlide,
    background: nextSlide?.background ?? background,
    blackout: false,
    clearText: false,
    showLogo: false,
    theme
  }

  return (
    <div className="live-panel">
      <div className="live-section">
        <div className="section-head">
          <span className="live-badge">LIVE</span>
          <span className="section-sub">{liveSlide?.label ?? '—'}</span>
        </div>
        <div className="preview big">
          <Stage state={live} />
        </div>
        <div className="nav-row">
          <button className="btn nav with-ico" onClick={goPrev} disabled={deck.length === 0}>
            <Icon name="chevron-left" /> Prev
          </button>
          <span className="nav-count">
            {liveIndex >= 0 ? liveIndex + 1 : '–'} / {deck.length}
          </span>
          <button className="btn nav with-ico" onClick={goNext} disabled={deck.length === 0}>
            Next <Icon name="chevron-right" />
          </button>
        </div>
        <SermonCountdown />
      </div>

      <div className="live-section">
        <div className="section-head">
          <span className="next-badge">NEXT</span>
          <span className="section-sub">{nextSlide?.label ?? '—'}</span>
        </div>
        <div className="preview small">
          <Stage state={nextPreview} />
        </div>
      </div>

      <div className="look">
        <div className="section-label">Theme</div>
        <div className="theme-row">
          {THEME_PRESETS.map((t) => (
            <button
              key={t.id}
              className="btn tiny theme-btn"
              onClick={() => applyTheme(t.theme, t.background)}
              title={`Apply the ${t.name} look`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="section-label">Look</div>

        <label className="look-row">
          <span>Size</span>
          <input
            type="range"
            min={0.5}
            max={1.8}
            step={0.05}
            value={theme.fontScale}
            onChange={(e) => setTheme({ fontScale: Number(e.target.value) })}
          />
        </label>

        <label className="look-row">
          <span>Scrim</span>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.05}
            value={theme.scrim}
            onChange={(e) => setTheme({ scrim: Number(e.target.value) })}
          />
        </label>

        <div className="look-row">
          <span>Align</span>
          <div className="seg">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                className={`seg-btn icon-btn ${theme.textAlign === a ? 'active' : ''}`}
                onClick={() => setTheme({ textAlign: a })}
                title={`Align ${a}`}
              >
                <Icon name={ALIGN_ICON[a]} />
              </button>
            ))}
          </div>
        </div>

        <div className="look-row">
          <span>Text</span>
          <input
            type="color"
            value={theme.textColor}
            onChange={(e) => setTheme({ textColor: e.target.value })}
          />
          <label className="chk">
            <input
              type="checkbox"
              checked={theme.uppercase}
              onChange={(e) => setTheme({ uppercase: e.target.checked })}
            />
            CAPS
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={theme.shadow}
              onChange={(e) => setTheme({ shadow: e.target.checked })}
            />
            Shadow
          </label>
        </div>
      </div>

      <div className="shortcut-hint">
        <b>Right/Space</b> next · <b>Left</b> prev · <b>B</b> black · <b>C</b> clear · <b>L</b> logo
      </div>
    </div>
  )
}
