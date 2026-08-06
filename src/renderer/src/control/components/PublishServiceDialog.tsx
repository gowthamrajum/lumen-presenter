import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { serviceSunday } from '../firstSunday'
import type { RemoteService } from '@shared/types'

/**
 * Put this session on the relay, where cantica-web can see it.
 *
 * Services have only ever travelled the other way — built on a phone, pulled in
 * here. This is the return leg: the order assembled on the projection machine
 * becomes the copy the church can open, read and share from a phone.
 *
 * A service is filed under one calendar date, and the relay treats
 * (date, weekday) as its identity — so the date is the only thing to choose and
 * the weekday follows from it. Picking a date that already holds a service is
 * not an error and not something to resolve quietly: it is asked, naming what
 * would be replaced, because the thing on that slot may well be the service
 * somebody built on their phone this afternoon.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** 'YYYY-MM-DD' in LOCAL time. toISOString() would report the previous day for
 *  any evening west of Greenwich, which is most of a Saturday-night setup. */
function isoDate(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** The weekday a 'YYYY-MM-DD' falls on, read locally for the same reason. */
function weekdayOf(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  return DAYS[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()] ?? ''
}

function pretty(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

type Phase =
  | { k: 'idle' }
  | { k: 'busy' }
  | { k: 'taken'; existing: RemoteService }
  | { k: 'done'; created: boolean }
  | { k: 'error'; message: string }

export function PublishServiceDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const items = useStore((s) => s.items)
  const serviceName = useStore((s) => s.serviceName)
  const publishedTo = useStore((s) => s.publishedTo)
  const publishService = useStore((s) => s.publishService)

  // Reopening on a published service offers its own slot, so the common case —
  // "I changed the order, send it again" — is one button and no decisions.
  const [date, setDate] = useState(() => publishedTo?.date ?? isoDate(serviceSunday()))
  const [phase, setPhase] = useState<Phase>({ k: 'idle' })

  const day = weekdayOf(date)
  const slides = useMemo(() => items.reduce((n, it) => n + it.slides.length, 0), [items])
  /** Sending to the slot we already own is an update, and needs no permission. */
  const updating = publishedTo?.date === date && publishedTo?.day === day

  const send = async (replaceId?: number): Promise<void> => {
    if (!day) return
    setPhase({ k: 'busy' })
    const res = await publishService({ day, date }, replaceId ?? (updating ? publishedTo?.id : undefined))
    if (res.status === 'ok') setPhase({ k: 'done', created: res.created })
    else if (res.status === 'taken') setPhase({ k: 'taken', existing: res.existing })
    else if (res.status === 'unreachable')
      setPhase({ k: 'error', message: 'Could not reach the service store — check the connection.' })
    else setPhase({ k: 'error', message: res.message })
  }

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase.k !== 'busy') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, phase.k])

  const busy = phase.k === 'busy'

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal confirm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Publish to the web</h2>
          <button className="modal-close" onClick={onClose} disabled={busy} title="Close">
            ×
          </button>
        </div>

        <div className="modal-body timer-config">
          {phase.k === 'done' ? (
            <p className="timer-hint">
              {phase.created ? 'Published' : 'Updated'} — <b>{serviceName}</b> is on the web under {day} ·{' '}
              {pretty(date)}. It appears in the Service Builder on the phone, where it can be read, shared as a
              PDF and broadcast.
            </p>
          ) : (
            <>
              <label className="timer-field">
                <span>Which date is this service for?</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
              </label>
              <p className="timer-hint">
                {day ? (
                  <>
                    Filed as <b>{day}</b> · {pretty(date)} — {items.length} item
                    {items.length === 1 ? '' : 's'}, {slides} slide{slides === 1 ? '' : 's'}.
                    {updating && ' Replaces the copy you published earlier.'}
                  </>
                ) : (
                  'Pick the date the service is for.'
                )}
              </p>

              {phase.k === 'taken' && (
                <p className="timer-hint warn">
                  {day} · {pretty(date)} already has a service on the web, last edited{' '}
                  {new Date(phase.existing.updatedDateTime).toLocaleString()}. Publishing replaces it — if
                  someone built that one on a phone, their work goes.
                </p>
              )}
              {phase.k === 'error' && <p className="timer-hint warn">{phase.message}</p>}
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose} disabled={busy}>
            {phase.k === 'done' ? 'Close' : 'Cancel'}
          </button>
          {phase.k !== 'done' && (
            <button
              className="btn btn-primary"
              onClick={() => void send(phase.k === 'taken' ? phase.existing.id : undefined)}
              disabled={busy || !day || !items.length}
            >
              {busy
                ? 'Sending…'
                : phase.k === 'taken'
                  ? 'Replace it'
                  : updating
                    ? 'Update the web copy'
                    : 'Publish'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
