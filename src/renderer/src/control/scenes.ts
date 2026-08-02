import type { Background, ThemeStyle } from '@shared/types'
import { COMMUNION_BG } from './presets'

/**
 * A "scene" is a one-click starter: a titled text slide plus a matching
 * (often animated) background and look. Great for standing worship moments
 * like a welcome loop, announcements, or a closing blessing.
 */
export interface Scene {
  id: string
  name: string
  lines: string[]
  background: Background
  theme?: Partial<ThemeStyle>
}

const AURORA: Background = {
  type: 'gradient',
  value: 'linear-gradient(120deg, #1b1040, #0a0a1e, #0d3357, #35205f, #0d3357, #0a0a1e, #1b1040)',
  anim: 'aurora'
}
const FLOW: Background = {
  type: 'gradient',
  value: 'linear-gradient(120deg, #3a2b6b, #1c1440, #4b2e83, #0d3b66, #1c1440, #3a2b6b)',
  anim: 'flow'
}
/**
 * The Lord's Table card. Named and exported because the Sunday template drops
 * the same card in on a first Sunday — the wording and the background have to
 * match however it reached the schedule.
 */
export const COMMUNION: Scene = {
  id: 'communion',
  name: 'Communion',
  // Telugu above the English, as everywhere else in the service. The
  // transliteration belongs on song slides, not here — beside the script it
  // says nothing to either reader.
  lines: ['బల్లారాధన', 'Communion'],
  // The church's own Communion artwork, the Easter set's bread-and-cup plate.
  background: COMMUNION_BG,
  // That plate is a pale watercolour, so the words go dark over it — white text
  // would need a scrim heavy enough to bury the artwork it was chosen for. No
  // shadow either: a dark glow under dark type on a light ground just smudges.
  // Not uppercase: it does nothing to Telugu and shouts the English, which is
  // the wrong voice for the table.
  theme: { textColor: '#4a1220', captionColor: '#7a1a2c', scrim: 0, uppercase: false, shadow: false }
}

export const SCENES: Scene[] = [
  {
    id: 'welcome',
    name: 'Welcome',
    lines: ['Welcome to Telugu Church', 'Glad you are with us today!', 'Lets worship together'],
    background: AURORA,
    theme: { textColor: '#ffffff', captionColor: '#ffd27f', scrim: 0.3, uppercase: false, shadow: true }
  },
  {
    id: 'announcements',
    name: 'Announcements',
    lines: ['Announcements'],
    background: FLOW,
    theme: { textColor: '#ffffff', captionColor: '#ffd27f', scrim: 0.35, uppercase: true, shadow: true }
  },
  COMMUNION,
  {
    id: 'blessing',
    name: 'Blessing',
    lines: ['Thank you for coming', 'God bless you!'],
    background: AURORA,
    theme: { textColor: '#fff4e2', captionColor: '#ffcf8b', scrim: 0.32, uppercase: false, shadow: true }
  }
]
