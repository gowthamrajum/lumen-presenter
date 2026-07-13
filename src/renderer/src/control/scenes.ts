import type { Background, ThemeStyle } from '@shared/types'

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
  {
    id: 'blessing',
    name: 'Blessing',
    lines: ['Thank you for coming', 'God bless you!'],
    background: AURORA,
    theme: { textColor: '#fff4e2', captionColor: '#ffcf8b', scrim: 0.32, uppercase: false, shadow: true }
  }
]
