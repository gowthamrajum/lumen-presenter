import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_LINE_SPACING, GO_LIVE_LINE_SPACING, countdownRemaining, formatClock, type Background, type LiveState, type SlideContent, type ThemeStyle } from '@shared/types'
import { AUTO_SPACING_TARGET, useFitText } from './useFitText'
import { Icon } from './Icon'

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

const NBSP = String.fromCharCode(0xa0)
/** Pin a ||repeat|| marker exactly two non-breaking spaces after the lyric so it
 *  never collapses, grows a ragged gap, or wraps onto its own line — matching the
 *  composer's single-line look in the output / OBS / web views. */
function formatLyric(line: string): string {
  return line
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/(\S)\s*(\|\|[^|]+\|\|)/g, '$1' + NBSP + NBSP + '$2')
}

/** Self-ticking countdown / clock rendered locally in each window. In preview
 *  (thumbnail) mode it renders a static snapshot — no interval.
 *
 *  A countdown ticks only while it is the live slide; anywhere else it shows
 *  the time it is holding at, with no interval running. The store decides which
 *  by handing the slide a `countdownTo` (running) or a `countdownRemainMs`. */
function TimerDisplay({
  slide,
  theme,
  preview
}: {
  slide: SlideContent
  theme: ThemeStyle
  preview?: boolean
}): JSX.Element {
  const [now, setNow] = useState<number>(() => Date.now())
  const held = slide.kind === 'countdown' && slide.countdownTo == null
  // A clock without seconds only changes each minute; one with seconds is polled
  // faster than it ticks so the digit turns within a frame of the real second
  // rather than drifting up to a second behind it.
  const coarse = slide.kind === 'clock' && !slide.clockSeconds
  useEffect(() => {
    if (preview) return // thumbnails don't need to tick
    if (held) return // a countdown that isn't on air has nothing to count
    const id = setInterval(() => setNow(Date.now()), coarse ? 1000 : 250)
    return () => clearInterval(id)
  }, [preview, held, coarse, slide.kind])

  let text: string
  if (slide.kind === 'clock') {
    text = formatClock(slide, now)
  } else {
    const remain = Math.round(countdownRemaining(slide, now) / 1000)
    const h = Math.floor(remain / 3600)
    const m = Math.floor((remain % 3600) / 60)
    const s = remain % 60
    text = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
  }

  return (
    <div className="stage-timerwrap">
      {slide.message && (
        <div className="stage-timer-msg" style={{ color: theme.captionColor }}>
          {slide.message}
        </div>
      )}
      <div
        className="stage-timer"
        style={{
          color: theme.textColor,
          fontFamily: theme.fontFamily,
          textShadow: theme.shadow ? '0 2px 18px rgba(0,0,0,0.65)' : 'none'
        }}
      >
        {text}
      </div>
    </div>
  )
}

function BackgroundLayer({ bg }: { bg: Background }): JSX.Element {
  if (bg.type === 'color' || bg.type === 'gradient') {
    // `value` is a CSS color or any CSS gradient string; `anim` adds motion.
    const cls = `stage-bg${bg.anim ? ` anim-${bg.anim}` : ''}`
    return <div className={cls} style={{ background: bg.value }} />
  }
  if (bg.type === 'video') {
    return (
      <video
        className="stage-bg"
        style={{ objectFit: bg.fit ?? 'cover' }}
        src={bg.value}
        autoPlay
        loop
        muted
        playsInline
      />
    )
  }
  return (
    <img
      className="stage-bg"
      style={{ objectFit: bg.fit ?? 'cover' }}
      src={bg.value}
      alt=""
    />
  )
}

/**
 * Pure presentational render of a LiveState. Fills its parent; the parent
 * decides the size (fullscreen on the output window, small on previews).
 *
 * `live` marks the one instance that IS the Go Live audience screen. It is the
 * only render that honours `theme.lineSpacing`; every other surface (operator
 * previews, thumbnails, the stage monitor, the export host) keeps
 * DEFAULT_LINE_SPACING. See ThemeStyle.lineSpacing.
 */
export function Stage({
  state,
  preview,
  live
}: {
  state: LiveState
  preview?: boolean
  live?: boolean
}): JSX.Element {
  const { slide, theme } = state
  const bg = slide?.background ?? state.background
  const lines = slide?.lines ?? []
  // Extra full-bleed image layers (e.g. a transparent lyrics PNG from an
  // imported PowerPoint) drawn over the background; hidden by blackout.
  const overlays = state.blackout ? [] : slide?.overlays ?? []
  const isTimer = slide?.kind === 'countdown' || slide?.kind === 'clock'
  const composed = slide?.composed
  const visible = !state.blackout && !state.clearText && !state.showLogo
  const hasComposed = visible && !isTimer && !!composed && composed.length > 0
  const showText = visible && !isTimer && !hasComposed && lines.length > 0
  const showTimer = visible && isTimer && !!slide
  const qr = visible && !isTimer ? slide?.qr : undefined
  const qrLabel = qr ? slide?.qrLabel : undefined
  // Drop a trailing "(ESV)" version tag from the caption — the footer no longer
  // carries the version marker (covers decks built before this change).
  const caption = (slide?.caption ?? '').replace(/\s*\(ESV\)\s*$/i, '')

  // The Go Live screen spaces itself: with the text auto-fitted, a fixed line
  // spacing just trades font size for air and leaves whatever room is spare
  // unused. `lineSpacing` undefined = auto (the default); a value means the
  // operator deliberately overrode it. Every other surface stays fixed.
  const autoSpacing = !!live && theme.lineSpacing == null
  const fixedLineHeight = live ? theme.lineSpacing ?? GO_LIVE_LINE_SPACING : DEFAULT_LINE_SPACING

  /**
   * The same Spacing setting, as a factor, for composed (Canvas) slides. Those
   * lines are absolutely positioned at their own y with line-height:1, so the
   * text path above cannot reach them — a song added via Canvas ignored Spacing
   * entirely. Here the gaps are stretched about the block's centre instead, which
   * is the positional equivalent, and clamped so a wide setting can never push a
   * line off the slide.
   */
  const composedSpread = (): number => {
    // Canvas slides carry absolute positions, so auto spacing reaches them as a
    // stretch about the block's centre — using the same target the fitted text
    // aims for, otherwise a Canvas song would sit tight beside an airy one.
    const want = (autoSpacing ? AUTO_SPACING_TARGET : fixedLineHeight) / DEFAULT_LINE_SPACING
    if (want === 1 || !composed || composed.length < 2) return 1
    const ys = composed.map((l) => l.y)
    const half = (Math.max(...ys) - Math.min(...ys)) / 2
    if (half <= 0) return 1
    const tallest = Math.max(...composed.map((l) => l.fontSize))
    // keep the whole block inside 92% of the 540-tall reference canvas
    const room = (540 * 0.92) / 2 - tallest / 2
    return Math.max(1, Math.min(want, room / half))
  }
  const spread = composedSpread()
  const composedMid = composed?.length
    ? (Math.min(...composed.map((l) => l.y)) + Math.max(...composed.map((l) => l.y))) / 2
    : 0

  const textStyle: CSSProperties = {
    color: theme.textColor,
    fontFamily: theme.fontFamily,
    textAlign: theme.textAlign,
    textTransform: theme.uppercase ? 'uppercase' : 'none',
    textShadow: theme.shadow ? '0 2px 18px rgba(0,0,0,0.65)' : 'none',
    lineHeight: fixedLineHeight,
    fontWeight: 700
  }

  // lineHeight and `live` are deps: each changes the space the text has to fit
  // into, so the auto-fit has to re-solve or the text overflows its box.
  //
  // Each slide is sized to its OWN text. Matching every slide in a run to its
  // busiest sibling was tried and removed: it left slides filling only ~64% of
  // the screen, and one 142-character verse dragged a whole psalm down with it.
  // Pressing through a song now varies in size, which is the accepted trade for
  // each slide actually using the screen.
  const { ref, fontSize, lineHeight } = useFitText(
    [
      lines.join('\n'),
      theme.fontScale,
      theme.uppercase,
      slide?.singleLine,
      !!qr,
      fixedLineHeight,
      autoSpacing,
      live
    ],
    { scale: theme.fontScale, autoSpacing, lineHeight: fixedLineHeight }
  )

  return (
    <div className={`stage${qr ? ' has-qr' : ''}${live ? ' is-live' : ''}`}>
      <BackgroundLayer bg={bg} />
      {!state.blackout && theme.scrim > 0 && (
        <div className="stage-scrim" style={{ opacity: theme.scrim }} />
      )}

      {overlays.map((src, i) => (
        <img key={i} className="stage-bg stage-overlay" style={{ objectFit: 'cover' }} src={src} alt="" />
      ))}

      {state.blackout && <div className="stage-black" />}

      {state.showLogo && !state.blackout && (
        <div className="stage-logo">
          <span className="logo-mark">
            <Icon name="flame" />
          </span>
          <span className="logo-word">CANTICA</span>
        </div>
      )}

      {showTimer && slide && <TimerDisplay slide={slide} theme={theme} preview={preview} />}

      {hasComposed && composed && (
        <div className="stage-composed">
          {composed.map((l) => (
            <div
              key={l.id}
              className="stage-cline"
              style={{
                left: `${(l.x / 960) * 100}%`,
                // Spacing stretches the gaps about the block's centre (spread is
                // 1 everywhere but the Go Live screen, so this is a no-op there).
                top: `${((composedMid + (l.y - composedMid) * spread) / 540) * 100}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${(l.fontSize / 540) * 100}cqh`,
                color: l.color || theme.textColor,
                fontFamily: theme.fontFamily,
                textAlign: l.align || 'center',
                textShadow: theme.shadow ? '0 2px 18px rgba(0,0,0,0.65)' : 'none',
                textTransform: theme.uppercase ? 'uppercase' : 'none'
              }}
            >
              {formatLyric(l.text)}
            </div>
          ))}
        </div>
      )}

      {showText && (
        <div className="stage-textwrap">
          <div className="stage-fitbox">
            <div
              ref={ref}
              className={`stage-text${slide?.singleLine ? ' oneline' : ''}`}
              style={{ ...textStyle, fontSize, lineHeight }}
            >
              {lines.map((l, i) => (
                <div key={i}>{formatLyric(l) || ' '}</div>
              ))}
            </div>
          </div>
          {caption && (
            <div className="stage-caption" style={{ color: theme.captionColor, fontFamily: theme.fontFamily }}>
              {caption}
            </div>
          )}
          {qr && (
            <div className="stage-qr">
              {qrLabel && (
                <div className="stage-qr-label" style={{ color: theme.captionColor, fontFamily: theme.fontFamily }}>
                  {qrLabel}
                </div>
              )}
              <img src={qr} alt="QR code" />
            </div>
          )}
        </div>
      )}

      {qr && !showText && !hasComposed && (
        <div className="stage-textwrap">
          <div className="stage-qr solo">
            {qrLabel && (
              <div className="stage-qr-label" style={{ color: theme.captionColor, fontFamily: theme.fontFamily }}>
                {qrLabel}
              </div>
            )}
            <img src={qr} alt="QR code" />
          </div>
        </div>
      )}
    </div>
  )
}
