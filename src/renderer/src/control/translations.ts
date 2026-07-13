import type { Translation } from '@shared/bible'
import { SAMPLE_TRANSLATION } from '@shared/bible'

export interface TranslationMeta {
  id: string
  name: string
  language: string
  /** Loads the full verse set (bundled sample is instant; others via IPC). */
  load: () => Promise<Translation>
}

// The Telugu data ships as resources/bible/telugu.json and is read by the main
// process on demand, so the ~12 MB file never enters the renderer bundle.
export const TRANSLATIONS: TranslationMeta[] = [
  {
    id: 'telugu',
    name: 'తెలుగు బైబిల్ (Telugu)',
    language: 'Telugu',
    load: async () => (await window.lumen.loadTranslation('telugu')) ?? SAMPLE_TRANSLATION
  },
  {
    id: 'web',
    name: 'WEB (English sample)',
    language: 'English',
    load: async () => SAMPLE_TRANSLATION
  }
]

export const DEFAULT_TRANSLATION_ID = 'telugu'

export function translationMeta(id: string): TranslationMeta {
  return TRANSLATIONS.find((t) => t.id === id) ?? TRANSLATIONS[0]
}
