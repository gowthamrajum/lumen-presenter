import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { Stage } from '../../shared/Stage'
import { Icon } from '../../shared/Icon'
import { DEFAULT_OBS_STYLE, type LiveState, type ObsStyle, type SlideContent } from '@shared/types'

/** Any character from the Telugu Unicode block. */
const TELUGU = /[ఀ-౿]/

/**
 * The one language the OBS lower third shows, mirroring broadcast/obs.html:
 * scripture reads in Telugu, songs and everything else in the English
 * transliteration. If the chosen language has no line on this slide the original
 * is kept, so an all-one-language slide is never blanked.
 */
export function obsLines(slide: SlideContent | null): string[] {
  const lines = (slide?.lines ?? []).filter((l) => l && l.trim())
  if (!lines.length) return []
  const pick =
    slide?.kind === 'scripture'
      ? lines.filter((l) => TELUGU.test(l))
      : lines.filter((l) => !TELUGU.test(l))
  return pick.length ? pick : lines
}

/** The OBS lower third as the browser source renders it: transparent, one
 *  language, sized and placed by the operator's ObsStyle. */
function ObsPane({ state, style }: { state: LiveState; style: ObsStyle }): JSX.Element {
  const slide = state.slide
  const hidden = state.blackout || state.clearText || state.showLogo
  const lines = hidden ? [] : obsLines(slide)
  const caption = (slide?.caption ?? '').replace(/\s*\(ESV\)\s*$/i, '')
  const justify =
    style.position === 'top' ? 'flex-start' : style.position === 'center' ? 'center' : 'flex-end'
  const scrim =
    style.position === 'top'
      ? 'linear-gradient(to bottom, rgba(0,0,0,.62), rgba(0,0,0,0) 46%)'
      : style.position === 'center'
        ? 'linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.28), rgba(0,0,0,.5))'
        : 'linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0) 46%)'

  return (
    <div className="parity-obs">
      {style.scrim && <div className="parity-obs-scrim" style={{ background: scrim }} />}
      <div className="parity-obs-stage" style={{ justifyContent: justify }}>
        {lines.length > 0 && (
          <div>
            <div
              className="parity-obs-lyrics"
              style={{
                fontSize: `${style.size}cqh`,
                color: style.textColor,
                textTransform: style.uppercase ? 'uppercase' : 'none'
              }}
            >
              {lines.map((l, i) => (
                <span key={i} className="parity-obs-line">
                  {l}
                </span>
              ))}
            </div>
            {caption && (
              <div
                className="parity-obs-caption"
                style={{ color: style.accentColor, fontSize: `${style.size * 0.42}cqh` }}
              >
                {caption}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Parity Display — the live slide as all three outputs will actually show it,
 * side by side, so the operator can check them without a projector, a phone and
 * OBS open at once.
 *
 *   Extended display — the Go Live screen. The only one that honours Spacing.
 *   Viewer (Cantica Web) — the audience mirror; its own spacing, both languages.
 *   OBS — transparent lower third, ONE language (Telugu for scripture,
 *         transliteration for songs), styled by the OBS panel.
 */
export function ParityDisplay(): JSX.Element | null {
  const open = useStore((s) => s.parityOpen)
  const setOpen = useStore((s) => s.setParityOpen)
  const items = useStore((s) => s.items)
  const liveId = useStore((s) => s.liveId)
  const theme = useStore((s) => s.theme)
  const background = useStore((s) => s.background)
  const blackout = useStore((s) => s.blackout)
  const clearText = useStore((s) => s.clearText)
  const showLogo = useStore((s) => s.showLogo)
  const goNext = useStore((s) => s.goNext)
  const goPrev = useStore((s) => s.goPrev)

  const [obsStyle, setObsStyle] = useState<ObsStyle>(DEFAULT_OBS_STYLE)
  useEffect(() => {
    if (!open) return
    // The OBS look is owned by the main process (and tunable live), so read it
    // each time the panel opens rather than caching a stale copy.
    void window.lumen
      .getBroadcast()
      .then((c) => setObsStyle({ ...DEFAULT_OBS_STYLE, ...(c?.obsStyle ?? {}) }))
      .catch(() => setObsStyle(DEFAULT_OBS_STYLE))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
      else if (e.key === 'ArrowRight' || e.key === ' ') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen, goNext, goPrev])

  const deck = useMemo(() => items.flatMap((it) => it.slides), [items])
  const slide = deck.find((d) => d.id === liveId) ?? null

  if (!open) return null

  const live: LiveState = {
    slide,
    background: slide?.background ?? background,
    blackout,
    clearText,
    showLogo,
    theme
  }

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal parity" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Parity Display</h2>
          <span className="parity-sub">{slide?.label ?? 'Nothing live'}</span>
          <button className="modal-close" onClick={() => setOpen(false)} title="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="modal-body parity-body">
          <div className="parity-pane">
            <div className="parity-label">
              Extended display <span className="parity-note">Go Live · honours Spacing</span>
            </div>
            <div className="parity-frame">
              <Stage state={live} live />
            </div>
          </div>

          <div className="parity-pane">
            <div className="parity-label">
              Viewer · Cantica Web <span className="parity-note">phones &amp; browsers · both languages</span>
            </div>
            <div className="parity-frame">
              <Stage state={live} />
            </div>
          </div>

          <div className="parity-pane">
            <div className="parity-label">
              OBS <span className="parity-note">
                transparent · {slide?.kind === 'scripture' ? 'Telugu' : 'transliteration'} only
              </span>
            </div>
            <div className="parity-frame checker">
              <ObsPane state={live} style={obsStyle} />
            </div>
          </div>
        </div>

        <div className="modal-foot parity-foot">
          <span className="parity-hint">← → to step through the deck · Esc to close</span>
          <button className="btn" onClick={goPrev} disabled={!deck.length}>
            <Icon name="chevron-left" /> Prev
          </button>
          <button className="btn btn-primary" onClick={goNext} disabled={!deck.length}>
            Next <Icon name="chevron-right" />
          </button>
        </div>
      </div>
    </div>
  )
}
