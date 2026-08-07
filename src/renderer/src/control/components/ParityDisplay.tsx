import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore, suppressedOn } from '../../store/useStore'
import { Stage } from '../../shared/Stage'
import { Icon } from '../../shared/Icon'
import { DEFAULT_OBS_STYLE, type LiveState, type ObsStyle, type SlideContent } from '@shared/types'
import { stripSingingMarks } from '@shared/lyrics'

/** Any character from the Telugu Unicode block. */
const TELUGU = /[ఀ-౿]/

/**
 * The one language the OBS lower third shows, mirroring broadcast/obs.html:
 * scripture reads in Telugu, songs and everything else in the English
 * transliteration. If the chosen language has no line on this slide the original
 * is kept, so an all-one-language slide is never blanked.
 */
export function obsLines(slide: SlideContent | null): string[] {
  // Stripped BEFORE the language is picked: a line that was nothing but a
  // marker has no words left, and an empty line is not one of the two
  // languages — it would otherwise be counted and shown as a blank.
  const lines = (slide?.lines ?? [])
    .map(stripSingingMarks)
    .filter((l) => l && l.trim())
  if (!lines.length) return []
  const pick =
    slide?.kind === 'scripture'
      ? lines.filter((l) => TELUGU.test(l))
      : lines.filter((l) => !TELUGU.test(l))
  return pick.length ? pick : lines
}

/**
 * The two-line rule, mirroring broadcast/obs.html.
 *
 * Duplicated rather than shared because the overlay is a standalone HTML file
 * served from the repo, with nothing to import from. Kept here anyway: a parity
 * pane that renders the lower third differently from the lower third is worse
 * than no parity pane, because it is believed.
 */
const OBS_MAX_LINES = 2
const OBS_MIN_SCALE = 0.6

/**
 * Shrink the block until it fits two lines, as the browser source does.
 *
 * Measures the LINES rather than the box: the box is pinned to two lines and
 * its height never moves, so measuring it would shrink every slide to the floor
 * chasing a number that cannot change — the same trap the overlay fell into.
 */
function useTwoLineFit(deps: unknown[]): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.fontSize = ''
    const base = parseFloat(getComputedStyle(el).fontSize) || 0
    if (!base) return
    const floor = base * OBS_MIN_SCALE
    for (let i = 0; i < 12; i++) {
      const cur = parseFloat(getComputedStyle(el).fontSize) || base
      const lh = parseFloat(getComputedStyle(el).lineHeight) || cur * 1.22
      let text = 0
      el.querySelectorAll('.parity-obs-line').forEach((l) => (text += l.getBoundingClientRect().height))
      if (text <= lh * OBS_MAX_LINES + lh * 0.5) break
      const next = cur * 0.94
      if (next <= floor) {
        el.style.fontSize = `${floor.toFixed(2)}px`
        break
      }
      el.style.fontSize = `${next.toFixed(2)}px`
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

/**
 * A pane that shows the REAL served page, not a drawing of it.
 *
 * The OBS lower third and the Viewer page are one HTML file, served by the
 * relay straight from this repo's main on a five-minute cache — so they change
 * without an app release, and only the Go Live screen is actually shipped.
 *
 * Which is why Parity must not draw them itself. A hand-built copy of the
 * overlay has to be updated in step with the overlay, in the app, through a
 * release — and every release it misses, this pane quietly lies about what is
 * on the stream. Pointing an iframe at the same URL OBS is pointed at makes
 * that impossible: whatever the relay is serving is what shows here.
 *
 * It follows the broadcast rather than the deck, because that is what these two
 * outputs do. Off air, they have nothing on them, and this says so instead of
 * inventing a preview.
 */
function ServedPane({
  base,
  room,
  mode,
  style
}: {
  base: string
  room: string
  mode: 'obs' | 'audience'
  style: ObsStyle
}): JSX.Element {
  const url =
    `${base.replace(/\/$/, '')}/broadcast/${encodeURIComponent(room)}/view` +
    `?mode=${mode}` +
    (mode === 'obs' ? `&size=${style.size}&pos=${style.position}` : '') +
    // The relay caches the overlay for five minutes; this only stops the
    // EMBED being reused from the Electron cache across a panel open.
    `&t=${Math.floor(Date.now() / 60000)}`
  return <iframe className="parity-served" src={url} title={mode === 'obs' ? 'OBS overlay' : 'Viewer page'} />
}

/** The OBS lower third as the browser source renders it: transparent, one
 *  language, sized and placed by the operator's ObsStyle, two lines tall. */
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

  const lyricsRef = useTwoLineFit([lines.join('\u0000'), style.size, style.uppercase])

  return (
    <div className="parity-obs">
      {style.scrim && <div className="parity-obs-scrim" style={{ background: scrim }} />}
      <div className="parity-obs-stage" style={{ justifyContent: justify }}>
        {lines.length > 0 && (
          <div>
            <div
              ref={lyricsRef}
              className="parity-obs-lyrics"
              style={{
                fontSize: `${style.size}cqh`,
                // Two lines at the OPERATOR's size, not the fitted one — the
                // band keeps its height even when the words inside it shrink.
                minHeight: `${style.size * 1.22 * OBS_MAX_LINES}cqh`,
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
  /** Where the served pages live, when this install is broadcasting at all. */
  const [feed, setFeed] = useState<{ base: string; room: string } | null>(null)
  useEffect(() => {
    if (!open) return
    // The OBS look is owned by the main process (and tunable live), so read it
    // each time the panel opens rather than caching a stale copy.
    void window.lumen
      .getBroadcast()
      .then((c) => {
        setObsStyle({ ...DEFAULT_OBS_STYLE, ...(c?.obsStyle ?? {}) })
        setFeed(c?.base && c?.room ? { base: c.base, room: c.room } : null)
      })
      .catch(() => {
        setObsStyle(DEFAULT_OBS_STYLE)
        setFeed(null)
      })
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

  // An item turned off for a channel sends that channel no slide at all, so the
  // panes have to show that too — otherwise Parity claims the congregation's
  // phones are showing lyrics that the relay is deliberately withholding.
  // `suppressedOn` is the same check the broadcast payload is built from.
  const liveItem = items.find((it) => it.slides.some((sl) => sl.id === liveId))
  const offUsers = suppressedOn(liveItem, 'users')
  const offStream = suppressedOn(liveItem, 'stream')

  if (!open) return null

  const live: LiveState = {
    slide,
    background: slide?.background ?? background,
    blackout,
    clearText,
    showLogo,
    theme
  }
  // What each channel actually receives: the relay sends `slide: null` for a
  // suppressed item, so mirror that rather than inventing a placeholder.
  const usersLive: LiveState = offUsers ? { ...live, slide: null } : live
  const streamLive: LiveState = offStream ? { ...live, slide: null } : live

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
              Viewer · Cantica Web{' '}
              {offUsers ? (
                <span className="parity-off">Off air for this item</span>
              ) : (
                <span className="parity-note">
                  phones &amp; browsers · both languages{feed ? ' · live page' : ' · preview'}
                </span>
              )}
            </div>
            <div className="parity-frame">
              {feed ? (
                <ServedPane base={feed.base} room={feed.room} mode="audience" style={obsStyle} />
              ) : (
                <Stage state={usersLive} />
              )}
            </div>
          </div>

          <div className="parity-pane">
            <div className="parity-label">
              OBS{' '}
              {offStream ? (
                <span className="parity-off">Off air for this item</span>
              ) : (
                <span className="parity-note">
                  transparent · {slide?.kind === 'scripture' ? 'Telugu' : 'transliteration'} only
                  {feed ? ' · live page' : ' · preview'}
                </span>
              )}
            </div>
            <div className="parity-frame checker">
              {feed ? (
                <ServedPane base={feed.base} room={feed.room} mode="obs" style={obsStyle} />
              ) : (
                <ObsPane state={streamLive} style={obsStyle} />
              )}
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
