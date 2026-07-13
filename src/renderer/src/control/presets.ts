import type { Background, ThemeStyle } from '@shared/types'

export interface BackgroundPreset {
  id: string
  name: string
  background: Background
}

// Curated, offline (CSS-gradient) backgrounds suited to worship services and
// church gatherings. No image assets required. The first two are animated.
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'aurora', name: 'Aurora', background: { type: 'gradient', value: 'linear-gradient(120deg, #1b1040, #0a0a1e, #0d3357, #35205f, #0d3357, #0a0a1e, #1b1040)', anim: 'aurora' } },
  { id: 'flow', name: 'Worship Flow', background: { type: 'gradient', value: 'linear-gradient(120deg, #3a2b6b, #1c1440, #4b2e83, #0d3b66, #1c1440, #3a2b6b)', anim: 'flow' } },
  { id: 'worship', name: 'Worship', background: { type: 'gradient', value: 'radial-gradient(circle at 50% 28%, #3a2b6b 0%, #1c1440 55%, #0a0720 100%)' } },
  { id: 'sanctuary', name: 'Sanctuary', background: { type: 'gradient', value: 'linear-gradient(160deg, #0d3b66 0%, #0a1f3c 55%, #050d1c 100%)' } },
  { id: 'dawn', name: 'Dawn', background: { type: 'gradient', value: 'linear-gradient(180deg, #2b1e46 0%, #7d3f63 55%, #e2895b 100%)' } },
  { id: 'golden', name: 'Golden Hour', background: { type: 'gradient', value: 'radial-gradient(circle at 50% 118%, #ffcf8b 0%, #b5701f 42%, #331a06 100%)' } },
  { id: 'living-water', name: 'Living Water', background: { type: 'gradient', value: 'linear-gradient(160deg, #0b6b5e 0%, #08403c 55%, #04201f 100%)' } },
  { id: 'advent', name: 'Advent', background: { type: 'gradient', value: 'radial-gradient(circle at 50% 18%, #24306b 0%, #101636 55%, #05060f 100%)' } },
  { id: 'crimson', name: 'Crimson', background: { type: 'gradient', value: 'radial-gradient(circle at 50% 20%, #7a1327 0%, #3d0a16 60%, #150307 100%)' } },
  { id: 'grace', name: 'Grace', background: { type: 'gradient', value: 'linear-gradient(160deg, #5a2a63 0%, #33163b 55%, #140a18 100%)' } },
  { id: 'midnight', name: 'Midnight', background: { type: 'gradient', value: 'linear-gradient(180deg, #0a1024 0%, #060a17 100%)' } },
  { id: 'charcoal', name: 'Charcoal', background: { type: 'gradient', value: 'linear-gradient(180deg, #2a2f3a 0%, #14171f 100%)' } },
  { id: 'black', name: 'Black', background: { type: 'color', value: '#000000' } },
  { id: 'light', name: 'Light', background: { type: 'color', value: '#f6f3ea' } }
]

export interface ThemePreset {
  id: string
  name: string
  theme: Partial<ThemeStyle>
  /** optional background applied with the theme (e.g. Light needs a light bg) */
  background?: Background
}

// Slide "looks": text styling bundles. All keep Anek Telugu (set in the theme
// default); presets vary color, alignment, scrim, and emphasis.
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'classic', name: 'Classic', theme: { textColor: '#ffffff', captionColor: '#ffd27f', textAlign: 'center', uppercase: false, shadow: true, scrim: 0.35 } },
  { id: 'bold', name: 'Bold', theme: { textColor: '#ffffff', captionColor: '#ffd27f', textAlign: 'center', uppercase: true, shadow: true, scrim: 0.45 } },
  { id: 'contrast', name: 'High Contrast', theme: { textColor: '#ffffff', captionColor: '#bfe0ff', textAlign: 'center', uppercase: false, shadow: false, scrim: 0.62 } },
  { id: 'warm', name: 'Warm', theme: { textColor: '#fff4e2', captionColor: '#ffcf8b', textAlign: 'center', uppercase: false, shadow: true, scrim: 0.4 } },
  { id: 'light', name: 'Light', theme: { textColor: '#141414', captionColor: '#8a5a12', textAlign: 'center', uppercase: false, shadow: false, scrim: 0 }, background: { type: 'color', value: '#f6f3ea' } }
]
