import type { Translation } from '@shared/bible'
import { SAMPLE_TRANSLATION } from '@shared/bible'

export interface TranslationMeta {
  id: string
  name: string
  language: string
  /** Loads the full verse set (bundled sample is instant; others via IPC). */
  load: () => Promise<Translation>
}

// The Bible data ships as resources/bible/<id>.json and is read by the main
// process on demand, so the large files never enter the renderer bundle:
// telugu.json (~12 MB, full Telugu) and web.json (~5.4 MB, full World English
// Bible, public domain). SAMPLE_TRANSLATION is only a last-resort fallback.
export const TRANSLATIONS: TranslationMeta[] = [
  {
    id: 'telugu',
    name: 'తెలుగు బైబిల్ (Telugu)',
    language: 'Telugu',
    load: async () => (await window.lumen.loadTranslation('telugu')) ?? SAMPLE_TRANSLATION
  },
  {
    id: 'web',
    name: 'WEB (English)',
    language: 'English',
    load: async () => (await window.lumen.loadTranslation('web')) ?? SAMPLE_TRANSLATION
  }
]

export const DEFAULT_TRANSLATION_ID = 'telugu'

export function translationMeta(id: string): TranslationMeta {
  return TRANSLATIONS.find((t) => t.id === id) ?? TRANSLATIONS[0]
}
