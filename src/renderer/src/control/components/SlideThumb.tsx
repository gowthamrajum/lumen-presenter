import { useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { Stage } from '../../shared/Stage'
import { Icon } from '../../shared/Icon'
import type { LiveState, SlideContent } from '@shared/types'

export function SlideThumb({
  slide,
  index,
  live
}: {
  slide: SlideContent
  index: number
  live: boolean
}): JSX.Element {
  const theme = useStore((s) => s.theme)
  const background = useStore((s) => s.background)
  const goLive = useStore((s) => s.goLive)
  const removeSlide = useStore((s) => s.removeSlide)
  const duplicateSlide = useStore((s) => s.duplicateSlide)
  const moveSlide = useStore((s) => s.moveSlide)
  const openComposer = useStore((s) => s.openComposer)
  const openTimerConfig = useStore((s) => s.openTimerConfig)

  // Countdown/clock slides have no text layout to compose — their edit button
  // opens the timer settings dialog (minutes + message) instead of the composer.
  const isTimer = slide.kind === 'countdown' || slide.kind === 'clock'

  // Keep the live slide in view: scroll the grid the minimal amount when this
  // thumb goes live, so stepping through a many-slide section (song, psalm range)
  // follows the selection down/up instead of leaving it off-screen.
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Center the live slide in the panel so it's comfortably in view (with the
    // upcoming slides visible below), rather than jammed against an edge. No-op
    // when the section is short enough to fit without scrolling.
    if (live) ref.current?.scrollIntoView({ block: 'center', inline: 'nearest' })
  }, [live])

  const preview: LiveState = {
    slide,
    background: slide.background ?? background,
    blackout: false,
    clearText: false,
    showLogo: false,
    theme
  }

  return (
    <div
      ref={ref}
      className={`slide-thumb ${live ? 'live' : ''}`}
      onClick={() => goLive(slide.id)}
      title={slide.label ?? `Slide ${index + 1}`}
    >
      <div className="thumb-index">{index + 1}</div>
      <button
        className="thumb-compose"
        title={isTimer ? 'Timer settings' : 'Compose layout'}
        onClick={(e) => {
          e.stopPropagation()
          if (isTimer) openTimerConfig(slide.id)
          else openComposer(slide.id)
        }}
      >
        <Icon name={isTimer ? 'timer' : 'pencil'} />
      </button>
      <button
        className="thumb-remove"
        title="Remove slide"
        onClick={(e) => {
          e.stopPropagation()
          removeSlide(slide.id)
        }}
      >
        <Icon name="close" />
      </button>
      <div className="thumb-tools">
        <button
          className="thumb-tool"
          title="Move earlier"
          onClick={(e) => {
            e.stopPropagation()
            moveSlide(slide.id, -1)
          }}
        >
          <Icon name="chevron-left" />
        </button>
        <button
          className="thumb-tool"
          title="Move later"
          onClick={(e) => {
            e.stopPropagation()
            moveSlide(slide.id, 1)
          }}
        >
          <Icon name="chevron-right" />
        </button>
        <button
          className="thumb-tool"
          title="Duplicate slide"
          onClick={(e) => {
            e.stopPropagation()
            duplicateSlide(slide.id)
          }}
        >
          <Icon name="copy" />
        </button>
      </div>
      <div className="thumb-stage">
        <Stage state={preview} preview />
      </div>
      <div className="thumb-label">
        {live && <span className="live-tag">LIVE</span>}
        <span className="thumb-label-text">{slide.label ?? `Slide ${index + 1}`}</span>
      </div>
    </div>
  )
}
