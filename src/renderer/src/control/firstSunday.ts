/**
 * The Sunday an order of service is being built for: today when it is already
 * Sunday, otherwise the coming one — so putting the order together midweek
 * still lands on the right date.
 */
export function serviceSunday(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return d
}

/**
 * Whether that Sunday is the month's first — which is, by definition, the
 * Sunday falling on the 1st–7th. The Sunday template serves Communion on it.
 */
export function isFirstSunday(now: Date = new Date()): boolean {
  return serviceSunday(now).getDate() <= 7
}
