import type { ItemKind, ServiceItem, SlideContent } from '@shared/types'
import { uid } from '../store/useStore'
import { blankSlide, countdownSlide } from './slides'

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

/** A titled section item holding a single bilingual "title card" placeholder. */
function section(title: string, kind: ItemKind, telugu: string, english: string): ServiceItem {
  const slide: SlideContent = {
    id: uid(),
    kind: 'text',
    label: title,
    lines: [telugu, english]
  }
  return { id: uid(), title, kind, slides: [slide] }
}

/** A pre-service countdown item. */
function countdown(minutes: number, message: string): ServiceItem {
  return { id: uid(), title: 'Pre-Service Countdown', kind: 'countdown', slides: [countdownSlide(minutes, message)] }
}

/** A trailing blank so the service ends on a clean screen. */
function blank(): ServiceItem {
  return { id: uid(), title: 'Blank', kind: 'blank', slides: [blankSlide('#000000')] }
}

/** Welcome title card, reused across templates. */
function welcome(english: string): ServiceItem {
  return section('Welcome', 'text', 'స్వాగతం', english)
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'sunday-worship',
    name: 'Sunday Worship Service',
    description: 'Full worship gathering — welcome, worship, the Word, response and benediction.',
    build: () => [
      countdown(5, 'Service begins soon'),
      welcome('Welcome to Telugu Church'),
      section('Opening Prayer', 'text', 'ప్రారంభ ప్రార్థన', 'Opening Prayer'),
      section('Worship', 'song', 'ఆరాధన', 'Worship'),
      section('Scripture Reading', 'scripture', 'వాక్య పఠనం', 'Scripture Reading'),
      section('Message', 'text', 'సందేశం', 'Message'),
      section('Response Song', 'song', 'ప్రతిస్పందన గీతం', 'Response Song'),
      section('Offering', 'text', 'కానుక', 'Offering'),
      section('Announcements', 'text', 'ప్రకటనలు', 'Announcements'),
      section('Benediction', 'text', 'దీవెన', 'Go in peace'),
      blank()
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
