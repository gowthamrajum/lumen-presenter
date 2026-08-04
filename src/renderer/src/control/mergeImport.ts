import type { ItemSource, ServiceItem } from '@shared/types'

/** The cards a merge files things against, by the title they are built with. */
const SUNDAY_SCHOOL = /sunday school/i
const SERMON = /sermon|వాక్యోపదేశం/i
const OFFERINGS = /offering|కానుక/i

/**
 * Merge Service-Builder items into an order that already exists, instead of
 * replacing it.
 *
 * A file exported FROM Cantica carries no slots and is a whole service — that
 * still replaces, as it always did. A file (or a pull) from the Service Builder
 * stamps every item with one, and is a pick-list meant to land inside the
 * Sunday order:
 *
 *   Welcome · Clock · **Praise & Worship · the songs** · Sunday School ·
 *   Sermon · [Communion] · Offerings · **the offering song** · Benediction …
 *
 * Worship goes early — before Sunday School, not before the Sermon — behind a
 * single Praise & Worship card. The offering song sits against the Offerings
 * card and gets no such card: it is one song under the plate, not a section.
 *
 * A song chosen for BOTH roles arrives as two items, one in each slot, and so
 * appears once in each place — which is what picking it twice meant.
 *
 * Returns null when there's nothing to merge INTO — no anchor item, or an empty
 * schedule — so the caller can build the order first rather than quietly
 * dropping songs at the end.
 */
export function mergeBySlot(
  current: ServiceItem[],
  incoming: ServiceItem[],
  /** stamped on every inserted item when the deck came from the relay */
  source?: ItemSource,
  /** the "స్తుతి ఆరాధన / Praise & Worship" card, built by the caller */
  bookend?: () => ServiceItem
): ServiceItem[] | null {
  if (!current.length) return null
  const at = (re: RegExp): number => current.findIndex((it) => re.test(it.title))
  if (at(SUNDAY_SCHOOL) < 0 && at(SERMON) < 0 && at(OFFERINGS) < 0) return null

  const worship = incoming.filter((it) => it.slot !== 'offering')
  const offering = incoming.filter((it) => it.slot === 'offering')

  /**
   * Songs and scripture go out on EVERY channel — they are the words the room
   * and the stream are both following, and a lower third with the lyrics missing
   * is the one thing a viewer at home can't work around. Anything else inserted
   * broadcasts like the item it was filed against, so a merge can't quietly put
   * something on a channel the rest of the order is off.
   */
  const like = (host: ServiceItem | undefined, it: ServiceItem): ServiceItem => {
    const { slot, ...rest } = it
    // The slot moves onto the source stamp rather than being dropped: it is half
    // of what identifies this item in the NEXT version of the same service.
    const marked = source ? { ...rest, source: { ...source, slot } } : rest
    if (it.kind === 'song' || it.kind === 'scripture') {
      return { ...marked, noBroadcastUsers: false, noBroadcastStream: false }
    }
    return host
      ? { ...marked, noBroadcastUsers: host.noBroadcastUsers, noBroadcastStream: host.noBroadcastStream }
      : marked
  }

  const out = current.slice()
  const find = (re: RegExp): number => out.findIndex((it) => re.test(it.title))

  // Offering first: inserting worship earlier would shift the Offerings index.
  if (offering.length) {
    const i = find(OFFERINGS)
    const host = i >= 0 ? out[i] : out[out.length - 1]
    const placed = offering.map((it) => like(host, it))
    if (i >= 0) out.splice(i + 1, 0, ...placed)
    else out.push(...placed)
  }

  if (worship.length) {
    // Ahead of Sunday School; failing that ahead of the Sermon, which is where
    // worship used to go and is still better than the end of the service.
    let i = find(SUNDAY_SCHOOL)
    if (i < 0) i = find(SERMON)
    const host = i >= 0 ? out[i] : undefined
    const block = worship.map((it) => like(host, it))
    // One card in front of the whole block, not one per song: it announces the
    // section. It carries the same source stamp, so re-pulling the service takes
    // it back out with the songs instead of leaving a heading over nothing — but
    // keeps its OWN channels, because it is a heading and not a song, whatever
    // kind it is filed under.
    if (bookend) {
      const card = bookend()
      block.unshift(source ? { ...card, source: { ...source, slot: 'worship' as const } } : card)
    }
    if (i >= 0) out.splice(i, 0, ...block)
    else out.push(...block)
  }
  return out
}

/** Whether an order has anywhere to file worship or an offering song — the
 *  question `mergeBySlot` answers by returning null, asked on its own so a
 *  caller can build the order first instead of merging twice to find out. */
export const canMerge = (items: ServiceItem[]): boolean =>
  items.some((it) => SUNDAY_SCHOOL.test(it.title) || SERMON.test(it.title) || OFFERINGS.test(it.title))

/** The items a given web service put into this order. */
export const itemsFrom = (items: ServiceItem[], serviceId: number): ServiceItem[] =>
  items.filter((it) => it.source?.serviceId === serviceId)

/**
 * Take out everything a web service contributed, leaving the rest of the order
 * exactly as it was — the first half of re-importing an edited service.
 *
 * Anything the operator added by hand has no `source`, so it survives; so does a
 * block imported from a DIFFERENT web service.
 */
export const withoutSource = (items: ServiceItem[], serviceId: number): ServiceItem[] =>
  items.filter((it) => it.source?.serviceId !== serviceId)
