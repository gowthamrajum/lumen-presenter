import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { Stage } from '../../shared/Stage'
import type { LiveState } from '@shared/types'
import { THEME_PRESETS } from '../presets'

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
          <button className="btn nav" onClick={goPrev} disabled={deck.length === 0}>
            ◀ Prev
          </button>
          <span className="nav-count">
            {liveIndex >= 0 ? liveIndex + 1 : '–'} / {deck.length}
          </span>
          <button className="btn nav" onClick={goNext} disabled={deck.length === 0}>
            Next ▶
          </button>
        </div>
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
                className={`seg-btn ${theme.textAlign === a ? 'active' : ''}`}
                onClick={() => setTheme({ textAlign: a })}
              >
                {a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}
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
        <b>→/Space</b> next · <b>←</b> prev · <b>B</b> black · <b>C</b> clear · <b>L</b> logo
      </div>
    </div>
  )
}
