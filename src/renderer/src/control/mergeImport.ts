import type { ItemSource, ServiceItem } from '@shared/types'

/** The cards a merge files things against, by the title they are built with. */
const SUNDAY_SCHOOL = /sunday school/i
const SERMON = /sermon|వాక్యోపదేశం/i
const OFFERINGS = /offering|కానుక/i
const ANNOUNCEMENTS = /announcement|ప్రకటన/i
/** The card clips are filed under — off both broadcasts, so they inherit it. */
const MEDIA = /^media$|వీడియో/i

/**
 * Merge Service-Builder items into an order that already exists, instead of
 * replacing it.
 *
 * A file exported FROM Cantica carries no slots and is a whole service — that
 * still replaces, as it always did. A file (or a pull) from the Service Builder
 * stamps every item with one, and is a pick-list meant to land inside the
 * Sunday order:
 *
 *   Welcome · Clock · **Praise & Worship · song · Praise & Worship · song** ·
 *   Sunday School · Sermon · **the communion song** · Offerings ·
 *   **the offering song** · Benediction · Media · **the clips** · Announcements …
 *
 * Worship goes early — between the clock and Sunday School, not before the
 * Sermon — and each song gets its own Praise & Worship card in front of it,
 * rather than one card over the block. A reading in the worship slot does not:
 * the card announces a song being sung, and a psalm is read.
 *
 * The communion song lands after the Sermon and before the Offerings card,
 * which is where the Table is served. The offering song sits against the
 * Offerings card. Neither gets a Praise & Worship card: each is one song in its
 * moment, not a section of the service.
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

  const offering = incoming.filter((it) => it.slot === 'offering')
  const communion = incoming.filter((it) => it.slot === 'communion')
  // Anything not claimed by a named slot is worship — which is what an older
  // Service Builder's items, carrying no slot at all, have always meant.
  const media = incoming.filter((it) => it.slot === 'media')
  const worship = incoming.filter(
    (it) => it.slot !== 'offering' && it.slot !== 'communion' && it.slot !== 'media'
  )

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

  // Media first of the three, being the latest in the order: a clip belongs
  // just before the announcements, where the service is over and the room is
  // being told things. Failing that it goes at the end, which is where an
  // unslotted item has always gone.
  if (media.length) {
    // Under the Media card when the order has one: it is off both broadcasts,
    // and `like` gives an inserted item its host's channels — so a clip filed
    // there is in the room and nowhere else without anything being set on it.
    // Failing that, ahead of the announcements, which is where it used to go.
    const m = find(MEDIA)
    const i = m >= 0 ? m + 1 : find(ANNOUNCEMENTS)
    const host = m >= 0 ? out[m] : i >= 0 ? out[i] : undefined
    const placed = media.map((it) => like(host, it))
    if (i >= 0) out.splice(i, 0, ...placed)
    else out.push(...placed)
  }

  // Then communion, between the Sermon and the Offerings card. Anchored on
  // Offerings rather than on the Sermon so it lands after the Table's own card
  // when the month's first Sunday put one there, and still after the Sermon
  // when it did not.
  if (communion.length) {
    const i = find(OFFERINGS)
    const host = i >= 0 ? out[i] : undefined
    const placed = communion.map((it) => like(host, it))
    if (i >= 0) out.splice(i, 0, ...placed)
    else {
      const j = find(SERMON)
      if (j >= 0) out.splice(j + 1, 0, ...placed)
      else out.push(...placed)
    }
  }

  if (worship.length) {
    // Ahead of Sunday School; failing that ahead of the Sermon, which is where
    // worship used to go and is still better than the end of the service.
    let i = find(SUNDAY_SCHOOL)
    if (i < 0) i = find(SERMON)
    const host = i >= 0 ? out[i] : undefined
    // A card in front of EACH song, not one over the block. Every card carries
    // the same source stamp, so re-pulling the service takes them back out with
    // the songs instead of leaving headings over nothing — but each keeps its
    // OWN channels, because a heading is not a song whatever it is filed under.
    //
    // Only in front of songs: a psalm arrives in this slot too, and announcing
    // a reading as praise and worship is simply wrong.
    const block: ServiceItem[] = []
    for (const it of worship) {
      if (bookend && it.kind === 'song') {
        const card = bookend()
        block.push(source ? { ...card, source: { ...source, slot: 'worship' as const } } : card)
      }
      block.push(like(host, it))
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
