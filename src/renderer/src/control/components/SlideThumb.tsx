import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { Stage } from '../../shared/Stage'
import { Icon } from '../../shared/Icon'
import type { ItemKind, LiveState, SlideContent } from '@shared/types'
import { stillUnlessSong } from '@shared/motion'
import { withSongCap } from '../../shared/songSizing'

export function SlideThumb({
  slide,
  itemKind,
  siblings,
  index,
  live,
  dragging = false,
  dropTarget = false,
  onDragStartSlide,
  onDragOverSlide,
  onDropSlide,
  onDragEndSlide
}: {
  slide: SlideContent
  /** The item's kind — a thumbnail shows motion only where a song would. */
  itemKind?: ItemKind
  /** the item's slides — a thumbnail sizes its text in step with the song, as the projector will */
  siblings?: SlideContent[]
  index: number
  live: boolean
  dragging?: boolean
  dropTarget?: boolean
  onDragStartSlide?: () => void
  onDragOverSlide?: () => void
  onDropSlide?: () => void
  onDragEndSlide?: () => void
}): JSX.Element {
  const theme = useStore((s) => s.theme)
  const background = useStore((s) => s.background)
  // The preview shows it as the projector will — outside a song, a video
  // background is still. Only the preview: edits and moves act on the slide
  // itself, so the still is never saved into it.
  const shown = withSongCap(stillUnlessSong(slide, itemKind, background), siblings, theme)
  const goLive = useStore((s) => s.goLive)
  const removeSlide = useStore((s) => s.removeSlide)
  const duplicateSlide = useStore((s) => s.duplicateSlide)
  const moveSlide = useStore((s) => s.moveSlide)
  const openComposer = useStore((s) => s.openComposer)
  const openTimerConfig = useStore((s) => s.openTimerConfig)

  // Countdown/clock slides have no text layout to compose — their edit button
  // opens the timer settings dialog (minutes + message) instead of the composer.
  const isTimer = slide.kind === 'countdown' || slide.kind === 'clock'

  // Duplicate: a small popup asks where to drop the copy (after this slide, or at
  // the very end) — so you don't have to drag a copy across the whole song.
  const [dupOpen, setDupOpen] = useState(false)
  const duplicate = (placement: 'after' | 'end'): void => {
    duplicateSlide(slide.id, placement)
    setDupOpen(false)
  }

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
    slide: shown,
    background: shown.background ?? background,
    blackout: false,
    clearText: false,
    showLogo: false,
    theme
  }

  return (
    <div
      ref={ref}
      className={`slide-thumb ${live ? 'live' : ''} ${dragging ? 'dragging' : ''} ${dropTarget ? 'drop-target' : ''} ${dupOpen ? 'dup-open' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStartSlide?.()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOverSlide?.()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDropSlide?.()
      }}
      onDragEnd={onDragEndSlide}
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
        <div className="thumb-dup-wrap">
          <button
            className={`thumb-tool ${dupOpen ? 'active' : ''}`}
            title="Duplicate slide…"
            onClick={(e) => {
              e.stopPropagation()
              setDupOpen((v) => !v)
            }}
          >
            <Icon name="copy" />
          </button>
          {dupOpen && (
            <>
              <div
                className="thumb-dup-backdrop"
                onClick={(e) => {
                  e.stopPropagation()
                  setDupOpen(false)
                }}
              />
              <div className="thumb-dup-menu" onClick={(e) => e.stopPropagation()}>
                <div className="thumb-dup-title">Duplicate to…</div>
                <button className="thumb-dup-opt" onClick={() => duplicate('after')}>
                  After this slide
                </button>
                <button className="thumb-dup-opt" onClick={() => duplicate('end')}>
                  End of song
                </button>
              </div>
            </>
          )}
        </div>
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
