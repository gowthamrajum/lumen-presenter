import type { ServiceItem } from '@shared/types'

/**
 * Merge Service-Builder items into an order that already exists, instead of
 * replacing it.
 *
 * A file exported FROM Cantica carries no slots and is a whole service — that
 * still replaces, as it always did. A file from the Service Builder stamps every
 * item with one, and is a pick-list meant to land inside the Sunday order:
 * worship goes in ahead of the Sermon (so, after Sunday School), and the
 * offering song sits with the Offerings card.
 *
 * Returns null when there's nothing to merge INTO — no anchor item, or an empty
 * schedule — so the caller falls back to loading the file as the service rather
 * than quietly dropping songs at the end.
 */
export function mergeBySlot(current: ServiceItem[], incoming: ServiceItem[]): ServiceItem[] | null {
  if (!current.length) return null
  const find = (re: RegExp): number => current.findIndex((it) => re.test(it.title))
  const sermonAt = find(/sermon|వాక్యోపదేశం/i)
  const offeringAt = find(/offering|కానుక/i)
  if (sermonAt < 0 && offeringAt < 0) return null

  const worship = incoming.filter((it) => it.slot !== 'offering')
  const offering = incoming.filter((it) => it.slot === 'offering')

  // An inserted item broadcasts like the item it was filed against, so a merge
  // can't silently put a song on a channel the rest of the order is off.
  const like = (host: ServiceItem | undefined, it: ServiceItem): ServiceItem => {
    const { slot: _slot, ...rest } = it
    return host
      ? { ...rest, noBroadcastUsers: host.noBroadcastUsers, noBroadcastStream: host.noBroadcastStream }
      : rest
  }

  const out = current.slice()
  // Offering first: inserting worship earlier would shift the Offerings index.
  if (offering.length) {
    const at = out.findIndex((it) => /offering|కానుక/i.test(it.title))
    const host = at >= 0 ? out[at] : out[out.length - 1]
    const placed = offering.map((it) => like(host, it))
    if (at >= 0) out.splice(at + 1, 0, ...placed)
    else out.push(...placed)
  }
  if (worship.length) {
    const at = out.findIndex((it) => /sermon|వాక్యోపదేశం/i.test(it.title))
    const host = at >= 0 ? out[at] : undefined
    const placed = worship.map((it) => like(host, it))
    if (at >= 0) out.splice(at, 0, ...placed)
    else out.push(...placed)
  }
  return out
}

