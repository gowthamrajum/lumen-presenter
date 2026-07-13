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
  const openComposer = useStore((s) => s.openComposer)

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
      className={`slide-thumb ${live ? 'live' : ''}`}
      onClick={() => goLive(slide.id)}
      title={slide.label ?? `Slide ${index + 1}`}
    >
      <div className="thumb-index">{index + 1}</div>
      <button
        className="thumb-compose"
        title="Compose layout"
        onClick={(e) => {
          e.stopPropagation()
          openComposer(slide.id)
        }}
      >
        <Icon name="pencil" />
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
