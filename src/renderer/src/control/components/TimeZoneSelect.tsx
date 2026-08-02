import { useMemo } from 'react'

/** The zone this machine is set to — what a clock shows when none is chosen. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * The handful of zones a service here actually reaches for, listed first so they
 * don't have to be hunted out of four hundred. Named the modern way: ICU's
 * supportedValuesOf still reports some legacy aliases (Asia/Calcutta for
 * Asia/Kolkata), so India is unfindable by name in the full list — but the
 * formatter accepts both spellings, so these ids are safe to store.
 */
const COMMON: { id: string; label: string }[] = [
  { id: 'America/Chicago', label: 'Chicago — US Central' },
  { id: 'America/New_York', label: 'New York — US Eastern' },
  { id: 'America/Denver', label: 'Denver — US Mountain' },
  { id: 'America/Los_Angeles', label: 'Los Angeles — US Pacific' },
  { id: 'Asia/Kolkata', label: 'Kolkata — India' },
  { id: 'Europe/London', label: 'London — UK' }
]

/** Keep only the zones this engine can actually format, so no option is a trap. */
function usable(ids: { id: string; label: string }[]): { id: string; label: string }[] {
  return ids.filter((z) => {
    try {
      new Date().toLocaleTimeString([], { timeZone: z.id })
      return true
    } catch {
      return false
    }
  })
}

/**
 * Picks the zone a clock slide reads its time in. `value` is '' for "this
 * computer", which is what most services want — the zone list is for the case
 * where a clock is showing somewhere else (a joint service with India, say).
 */
export function TimeZoneSelect({
  value,
  onChange,
  title
}: {
  value: string
  onChange: (tz: string) => void
  title?: string
}): JSX.Element {
  // Every zone the platform knows. Older engines lack supportedValuesOf, so fall
  // back to this machine's own zone rather than an empty list.
  const { common, zones } = useMemo(() => {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf
    const all = supported ? supported.call(Intl, 'timeZone') : []
    return { common: usable(COMMON), zones: all.length ? all : [localTimeZone()] }
  }, [])

  return (
    <select
      className="tz-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title ?? 'Time zone the clock reads its time in'}
    >
      <option value="">This computer ({localTimeZone().replace(/_/g, ' ')})</option>
      {common.length > 0 && (
        <optgroup label="Common">
          {common.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="All time zones">
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, ' ')}
          </option>
        ))}
      </optgroup>
    </select>
  )
}
