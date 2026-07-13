import { useEffect, useState, type CSSProperties } from 'react'
import type { Background, LiveState, SlideContent, ThemeStyle } from '@shared/types'
import { useFitText } from './useFitText'
import { Icon } from './Icon'

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Self-ticking countdown / clock rendered locally in each window. In preview
 *  (thumbnail) mode it renders a static snapshot — no interval. */
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
  useEffect(() => {
    if (preview) return // thumbnails don't need to tick
    // clock only changes each minute; countdown needs per-second updates
    const id = setInterval(() => setNow(Date.now()), slide.kind === 'clock' ? 1000 : 250)
    return () => clearInterval(id)
  }, [preview, slide.kind])

  let text: string
  if (slide.kind === 'clock') {
    text = new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } else {
    const remain = Math.max(0, Math.round(((slide.countdownTo ?? now) - now) / 1000))
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
 */
export function Stage({ state, preview }: { state: LiveState; preview?: boolean }): JSX.Element {
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

  const textStyle: CSSProperties = {
    color: theme.textColor,
    fontFamily: theme.fontFamily,
    textAlign: theme.textAlign,
    textTransform: theme.uppercase ? 'uppercase' : 'none',
    textShadow: theme.shadow ? '0 2px 18px rgba(0,0,0,0.65)' : 'none',
    lineHeight: 1.22,
    fontWeight: 700
  }

  const { ref } = useFitText([lines.join('\n'), theme.fontScale, theme.uppercase], {
    scale: theme.fontScale
  })

  return (
    <div className={`stage${qr ? ' has-qr' : ''}`}>
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
            <Icon name="spark" />
          </span>
          <span className="logo-word">LUMEN</span>
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
                top: `${(l.y / 540) * 100}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${(l.fontSize / 540) * 100}cqh`,
                color: l.color || theme.textColor,
                fontFamily: theme.fontFamily,
                textAlign: l.align || 'center',
                textShadow: theme.shadow ? '0 2px 18px rgba(0,0,0,0.65)' : 'none',
                textTransform: theme.uppercase ? 'uppercase' : 'none'
              }}
            >
              {l.text}
            </div>
          ))}
        </div>
      )}

      {showText && (
        <div className="stage-textwrap">
          <div className="stage-fitbox">
            <div ref={ref} className="stage-text" style={textStyle}>
              {lines.map((l, i) => (
                <div key={i}>{l || ' '}</div>
              ))}
            </div>
          </div>
          {slide?.caption && (
            <div className="stage-caption" style={{ color: theme.captionColor, fontFamily: theme.fontFamily }}>
              {slide.caption}
            </div>
          )}
          {qr && (
            <div className="stage-qr">
              <img src={qr} alt="QR code" />
            </div>
          )}
        </div>
      )}

      {qr && !showText && !hasComposed && (
        <div className="stage-textwrap">
          <div className="stage-qr solo">
            <img src={qr} alt="QR code" />
          </div>
        </div>
      )}
    </div>
  )
}
