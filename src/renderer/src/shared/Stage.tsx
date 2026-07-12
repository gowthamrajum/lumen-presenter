import { type CSSProperties } from 'react'
import type { Background, LiveState } from '@shared/types'
import { useFitText } from './useFitText'

function BackgroundLayer({ bg }: { bg: Background }): JSX.Element {
  if (bg.type === 'color') {
    return <div className="stage-bg" style={{ background: bg.value }} />
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
export function Stage({ state }: { state: LiveState }): JSX.Element {
  const { slide, theme } = state
  const bg = slide?.background ?? state.background
  const lines = slide?.lines ?? []
  const showText = !state.blackout && !state.clearText && !state.showLogo && lines.length > 0

  const textStyle: CSSProperties = {
    color: theme.textColor,
    fontFamily: theme.fontFamily,
    textAlign: theme.textAlign,
    textTransform: theme.uppercase ? 'uppercase' : 'none',
    textShadow: theme.shadow ? '0 2px 18px rgba(0,0,0,0.65)' : 'none',
    lineHeight: 1.15,
    fontWeight: 700
  }

  const { ref } = useFitText([lines.join('\n'), theme.fontScale, theme.uppercase], {
    scale: theme.fontScale
  })

  return (
    <div className="stage">
      <BackgroundLayer bg={bg} />
      {!state.blackout && theme.scrim > 0 && (
        <div className="stage-scrim" style={{ opacity: theme.scrim }} />
      )}

      {state.blackout && <div className="stage-black" />}

      {state.showLogo && !state.blackout && (
        <div className="stage-logo">
          <span className="logo-mark">✦</span>
          <span className="logo-word">LUMEN</span>
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
            <div className="stage-caption" style={{ color: theme.captionColor }}>
              {slide.caption}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
