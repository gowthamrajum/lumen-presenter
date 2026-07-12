import { useStore } from '../../store/useStore'
import { SlideThumb } from './SlideThumb'
import { blankSlide } from '../slides'

export function DeckGrid(): JSX.Element {
  const deck = useStore((s) => s.deck)
  const liveId = useStore((s) => s.liveId)
  const clearDeck = useStore((s) => s.clearDeck)
  const addSlides = useStore((s) => s.addSlides)

  return (
    <div className="deck">
      <div className="deck-header">
        <div className="deck-title">
          Deck <span className="deck-count">{deck.length}</span>
        </div>
        <div className="deck-header-actions">
          <button className="btn tiny" onClick={() => addSlides([blankSlide('#000000')])}>
            + Blank
          </button>
          <button className="btn tiny" onClick={clearDeck} disabled={deck.length === 0}>
            Clear deck
          </button>
        </div>
      </div>

      {deck.length === 0 ? (
        <div className="deck-empty">
          <div className="deck-empty-icon">✦</div>
          <h2>Your deck is empty</h2>
          <p>
            Add scripture, media, or text from the left panel. Click a slide to send it to the live
            output. Use arrow keys to advance.
          </p>
        </div>
      ) : (
        <div className="deck-grid">
          {deck.map((slide, i) => (
            <SlideThumb key={slide.id} slide={slide} index={i} live={slide.id === liveId} />
          ))}
        </div>
      )}
    </div>
  )
}
