import type { ComposedLine, ItemKind, ServiceItem, SlideContent } from '@shared/types'
import { uid, broadcastDefaults, worshipBookend } from '../store/useStore'
import { blankSlide, countdownSlide } from './slides'
import { QR_DONATIONS } from './assets/qrDonations'

/**
 * A ready-made order of service. Picking a template drops a full outline into
 * the schedule — a countdown, a welcome, and one titled placeholder item per
 * section (worship, scripture, message, prayer, …) — that the operator then
 * fills in with real songs, passages and slides.
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
    singleLine: true
  }
  return { id: uid(), title, kind, slides: [slide], ...broadcastDefaults(kind) }
}

/** A pre-service countdown item. */
function countdown(minutes: number, message: string): ServiceItem {
  return {
    id: uid(),
    title: 'Pre-Service Countdown',
    kind: 'countdown',
    slides: [countdownSlide(minutes, message)],
    ...broadcastDefaults('countdown')
  }
}

/** A trailing blank so the service ends on a clean screen. */
function blank(): ServiceItem {
  return { id: uid(), title: 'Blank', kind: 'blank', slides: [blankSlide('#000000')], ...broadcastDefaults('blank') }
}

/** Welcome title card, reused across templates. */
function welcome(english: string): ServiceItem {
  return section('Welcome', 'text', 'స్వాగతం', english)
}

/** A placeholder welcome-video item. The operator attaches the real clip with
 *  the "Add media" button on the Slides panel. */
function welcomeVideo(): ServiceItem {
  // A visible placeholder word until the operator attaches the real clip with
  // "Add media" (which clears the text and sets the video background). Broadcasts
  // by default (video kind).
  return {
    id: uid(),
    title: 'Welcome Video',
    kind: 'video',
    slides: [{ id: uid(), kind: 'text', label: 'Welcome Video', lines: ['Welcome'] }],
    ...broadcastDefaults('video')
  }
}

/** A Praise & Worship bookend — broadcasts to the audience (Users) only; OBS is
 *  empty. Same card the Songs source wraps a song with. */
function praiseWorship(): ServiceItem {
  return worshipBookend()
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
function announcements(): ServiceItem {
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
    qr: QR_DONATIONS
  }
  return { id: uid(), title: 'Offerings', kind: 'text', slides: [slide], ...broadcastDefaults('text') }
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'sunday-worship',
    name: 'Sunday Worship Service',
    description: 'Welcome video, countdown, worship, the Word (Vaakyopadesam), offerings and benediction.',
    build: () => [
      welcomeVideo(),
      countdown(5, 'Service begins soon'),
      // A plain worship *slot* — no pre-baked "Praise & Worship" cards. Those are
      // added automatically (as bookends) only when the operator adds a song.
      section('Worship', 'song', 'ఆరాధన', 'Worship'),
      section('Sermon', 'text', 'వాక్యోపదేశం', 'Sermon'),
      offerings(),
      announcements(),
      section('Benediction', 'text', 'దీవెన', 'Go in peace'),
      section('Closing Worship', 'song', 'ముగింపు ఆరాధన', 'Closing Worship')
    ]
  },
  {
    id: 'wednesday-bible-study',
    name: 'Wednesday Bible Study Service',
    description: 'Midweek study — short worship, a passage, teaching and prayer requests.',
    build: () => [
      countdown(5, 'Bible study begins soon'),
      welcome('Wednesday Bible Study'),
      section('Opening Prayer', 'text', 'ప్రారంభ ప్రార్థన', 'Opening Prayer'),
      section('Worship', 'song', 'ఆరాధన', 'Worship'),
      section("Today's Passage", 'scripture', 'నేటి వాక్యభాగం', "Today's Passage"),
      section('Study & Discussion', 'text', 'అధ్యయనం & చర్చ', 'Study & Discussion'),
      section('Prayer Requests', 'text', 'ప్రార్థన అభ్యర్థనలు', 'Prayer Requests'),
      section('Closing Prayer', 'text', 'ముగింపు ప్రార్థన', 'Closing Prayer'),
      blank()
    ]
  },
  {
    id: 'saturday-prayer',
    name: 'Saturday Prayer Service',
    description: 'Prayer meeting — praise, a promise from the Word, requests and intercession.',
    build: () => [
      countdown(5, 'Prayer begins soon'),
      welcome('Saturday Prayer'),
      section('Worship', 'song', 'ఆరాధన', 'Worship'),
      section('Promise of the Day', 'scripture', 'నేటి వాగ్దానం', 'Promise of the Day'),
      section('Praise Reports', 'text', 'స్తుతి సాక్ష్యాలు', 'Praise Reports'),
      section('Prayer Requests', 'text', 'ప్రార్థన అభ్యర్థనలు', 'Prayer Requests'),
      section('Intercession', 'text', 'మధ్యవర్తిత్వ ప్రార్థన', 'Intercession'),
      section('Benediction', 'text', 'దీవెన', 'Go in peace'),
      blank()
    ]
  }
]
