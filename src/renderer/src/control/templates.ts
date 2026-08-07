import { SECTION_TEXT_SCALE, type Background, type ComposedLine, type ItemKind, type ServiceItem, type SlideContent } from '@shared/types'
import { uid, broadcastDefaults } from '../store/useStore'
import { clockSlide } from './slides'
import { COMMUNION } from './scenes'
import { isFirstSunday } from './firstSunday'
import { QR_DONATIONS } from './assets/qrDonations'

/**
 * The ready-made order of service. Starting from it drops the whole Sunday
 * outline into the schedule — the clips, the clock, and one titled card per
 * section — which the operator then fills in with the real songs and passages.
 * There is one, so the menu names it rather than offering a choice.
 */
export interface ServiceTemplate {
  id: string
  name: string
  /** one-line summary shown in the picker */
  description: string
  build: () => ServiceItem[]
}

/** A titled section item holding a single bilingual "title card" placeholder.
 *  Both languages sit on one line and the audience Stage auto-fits (resizes) it. */
function section(title: string, kind: ItemKind, telugu: string, english: string): ServiceItem {
  const slide: SlideContent = {
    id: uid(),
    kind: 'text',
    label: title,
    // Telugu on its own line, English on its own line (house format). Each line
    // is kept to one line and the whole card is auto-sized to fit.
    lines: [telugu, english].filter((s) => s.trim()),
    singleLine: true,
    // A heading, not a verse: two short lines would otherwise be sized until
    // they filled the screen. Held below the ceiling so the words sit in the
    // middle of the slide with air around them.
    textScale: SECTION_TEXT_SCALE
  }
  return { id: uid(), title, kind, slides: [slide], ...broadcastDefaults(kind) }
}

/** The church site serves the service clips; they need a direct URL because the
 *  projector, the phones and OBS each load them into a plain <video>. */
const MEDIA_BASE = 'https://cantica-web.onrender.com/media'

/**
 * Sunday's broadcast rule: every item reaches the projector and the
 * congregation's phones, and only the clock also goes out on the stream. Set
 * explicitly rather than via broadcastDefaults, which keys off item kind and
 * can't say "on for Users, off for OBS".
 */
const ON_AIR = { noBroadcastUsers: false, noBroadcastStream: true }
const ON_AIR_WITH_OBS = { noBroadcastUsers: false, noBroadcastStream: false }
/**
 * In the room and nowhere else.
 *
 * A clip is for the people sitting in front of the screen. On a phone it is a
 * video competing with the one they could already be watching, and on the
 * stream it covers the camera with something the stream is not carrying the
 * sound of. Neither is a smaller version of being there; both are worse than
 * showing nothing.
 */
const ROOM_ONLY = { noBroadcastUsers: true, noBroadcastStream: true }

/** A hosted clip, attached exactly as "Add media by URL" would build it — so it
 *  reaches the web broadcast and not only the local output. */
function clip(title: string, file: string): ServiceItem {
  const background: Background = { type: 'video', value: `${MEDIA_BASE}/${file}`, fit: 'cover' }
  return {
    id: uid(),
    title,
    kind: 'video',
    slides: [{ id: uid(), kind: 'media', label: title, lines: [], background }],
    ...ON_AIR
  }
}

/** The pre-service clock — the one item the stream carries. */
function clock(): ServiceItem {
  return { id: uid(), title: 'Clock', kind: 'countdown', slides: [clockSlide()], ...ON_AIR_WITH_OBS }
}

/** The Lord's Table card, same wording and background as the quick scene. */
function communion(): ServiceItem {
  const slide: SlideContent = {
    id: uid(),
    kind: 'text',
    label: COMMUNION.name,
    lines: COMMUNION.lines,
    singleLine: true,
    textScale: SECTION_TEXT_SCALE,
    // carried on the slide, so the wine background belongs to this card alone
    // and doesn't repaint the rest of the service
    background: COMMUNION.background
  }
  return { id: uid(), title: COMMUNION.name, kind: 'text', slides: [slide], ...ON_AIR }
}

/** A composed (freely-positioned) line on the 960×540 reference canvas — the same
 *  coordinate space the Slide Composer and the audience Stage use. */
function cl(text: string, x: number, y: number, fontSize: number, stanza: string): ComposedLine {
  return { id: uid(), text, x, y, fontSize, align: 'center', stanzaId: stanza }
}

/** A slide built from composed lines. `lines` is the reading-order fallback used
 *  by contexts that don't draw the composed layout (OBS lower-third, thumbnails). */
function composedSlide(label: string, lines: ComposedLine[]): SlideContent {
  return { id: uid(), kind: 'text', label, lines: lines.map((l) => l.text), composed: lines }
}

/**
 * The weekly Announcements — ported verbatim from Worship Ready's
 * "Add Announcements slides": a title card plus three bilingual, two-column
 * notices (English on the left, Telugu on the right). Off-air by default (text
 * kind); the operator edits the specifics each week in the Slide Composer.
 */
export function announcements(): ServiceItem {
  const L = 240 // left column centre (English)
  const R = 720 // right column centre (Telugu)

  // Slide 1 — title card (stacked, centred)
  const s1 = `stanza-${uid()}`
  const slide1 = composedSlide('Announcements', [
    cl('Announcements', 480, 210, 52, s1),
    cl('ప్రకటనలు', 480, 310, 52, s1)
  ])

  // Slide 2 — Bible Study
  const s2 = `stanza-${uid()}`
  const slide2 = composedSlide('Bible Study', [
    cl('Bible Study', L, 175, 44, s2),
    cl('on Zoom', L, 255, 36, s2),
    cl('Every Wednesday', L, 325, 30, s2),
    cl('at 8 PM', L, 380, 30, s2),
    cl('జూమ్ లో బైబిల్ స్టడీ', R, 175, 38, s2),
    cl('ప్రతి బుధవారం', R, 275, 32, s2),
    cl('రాత్రి 8 గంటలకు', R, 345, 32, s2)
  ])

  // Slide 3 — Saturday Prayer Meeting
  const s3 = `stanza-${uid()}`
  const slide3 = composedSlide('Saturday Prayer', [
    cl('Saturday Prayer', L, 175, 42, s3),
    cl('Meeting on Zoom', L, 245, 36, s3),
    cl('Every Saturday', L, 315, 30, s3),
    cl('at 8 PM', L, 370, 30, s3),
    cl('శనివారం ప్రార్థన సభ', R, 175, 38, s3),
    cl('జూమ్ లో', R, 260, 32, s3),
    cl('ప్రతి శనివారం', R, 320, 30, s3),
    cl('రాత్రి 8 గంటలకు', R, 375, 30, s3)
  ])

  // Slide 4 — Worship Service (with the church address)
  const s4 = `stanza-${uid()}`
  const slide4 = composedSlide('Worship Service', [
    cl('Worship Service', L, 155, 42, s4),
    cl('Every Sunday at 11 AM', L, 228, 30, s4),
    cl('8001 Mustang Drive', L, 290, 26, s4),
    cl('Irving, Texas 75038', L, 345, 26, s4),
    cl('ఆరాధన సేవ', R, 155, 42, s4),
    cl('ప్రతి ఆదివారం ఉ. 11 గంటలకు', R, 228, 27, s4),
    cl('8001 Mustang Drive', R, 290, 26, s4),
    cl('Irving, Texas 75038', R, 345, 26, s4)
  ])

  return {
    id: uid(),
    title: 'Announcements',
    kind: 'text',
    slides: [slide1, slide2, slide3, slide4],
    ...broadcastDefaults('text')
  }
}

/** Offerings slide with the giving QR (from the worshipReady donations layout).
 *  Off-air by default (text kind). */
function offerings(): ServiceItem {
  const slide: SlideContent = {
    id: uid(),
    kind: 'text',
    label: 'Offerings',
    lines: ['కానుకలు', 'Offerings'], // Telugu line, then English line
    singleLine: true,
    textScale: SECTION_TEXT_SCALE,
    qr: QR_DONATIONS,
    qrLabel: 'Know ways to contribute'
  }
  return { id: uid(), title: 'Offerings', kind: 'text', slides: [slide], ...broadcastDefaults('text') }
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'sunday-worship',
    name: 'Sunday Worship Service',
    description:
      'Welcome, clock, Sunday School, the Word, offerings, the blessing, media, announcements and a closing thank-you. Communion is added on the first Sunday of the month.',
    build: () => [
      clip('Welcome', 'welcome.mp4'),
      clock(),
      clip('Sunday School', 'sunday-school.mp4'),
      { ...section('Sermon', 'text', 'వాక్యోపదేశం', 'Sermon'), ...ON_AIR },
      // The Table is served on the first Sunday, immediately before the offering.
      ...(isFirstSunday() ? [communion()] : []),
      { ...offerings(), ...ON_AIR },
      { ...section('Benediction', 'text', 'దీవెన', 'Go in peace'), ...ON_AIR },
      // Where the clips go: after the blessing, before the notices, and off
      // both broadcasts. Everything the Service Builder files under "media"
      // lands beneath this card.
      { ...section('Media', 'text', 'వీడియోలు', 'Media'), ...ROOM_ONLY },
      { ...announcements(), ...ON_AIR },
      clip('Thank You', 'thank-you.mp4')
    ]
  }
]
