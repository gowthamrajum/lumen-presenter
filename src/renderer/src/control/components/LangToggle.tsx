import type { JSX } from 'react'

/** The languages that can go on a bilingual slide. Shared by Psalms + Songs
 *  (structurally the same as PsalmLang / SongLang). */
export type SlideLang = 'both' | 'telugu' | 'english'

const OPTIONS: { v: SlideLang; label: string }[] = [
  { v: 'both', label: 'Both' },
  { v: 'telugu', label: 'తెలుగు' },
  { v: 'english', label: 'English' }
]

/**
 * Segmented radio control choosing the language(s) that land on a slide: Both
 * (Telugu first, English next), Telugu only, or English only. Replaces the old
 * language dropdowns so the choice is one tap and always visible in the preview.
 */
export function LangToggle({
  value,
  onChange,
  title = 'Language on the slide'
}: {
  value: SlideLang
  onChange: (l: SlideLang) => void
  title?: string
}): JSX.Element {
  return (
    <div className="seg lang-toggle" role="radiogroup" aria-label="Slide language" title={title}>
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={`seg-btn${value === o.v ? ' active' : ''}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
