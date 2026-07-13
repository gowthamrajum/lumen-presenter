import type { ItemKind, ServiceItem, SlideContent } from '@shared/types'
import { uid, broadcastDefaults } from '../store/useStore'
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

/** A Praise & Worship section — broadcasts by default (song kind). */
function praiseWorship(): ServiceItem {
  return section('Praise & Worship', 'song', 'స్తుతి ఆరాధన', 'Praise & Worship')
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
      praiseWorship(), // opening worship
      section('Sermon', 'text', 'వాక్యోపదేశం', 'Sermon'),
      offerings(),
      section('Announcements', 'text', 'ప్రకటనలు', 'Announcements'),
      section('Benediction', 'text', 'దీవెన', 'Go in peace'),
      praiseWorship() // closing worship
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
