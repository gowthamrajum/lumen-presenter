import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { TimeZoneSelect } from './TimeZoneSelect'

/**
 * Settings for a pre-service timer (countdown or clock). Opened from a
 * countdown/clock slide's gear button — the layout composer can't configure a
 * timer, so this is where the operator sets the minutes + caption and restarts
 * the countdown. Applying re-arms the countdown from now; if the slide is live
 * the output updates immediately.
 */
export function CountdownDialog(): JSX.Element | null {
  const timerSlideId = useStore((s) => s.timerSlideId)
  const items = useStore((s) => s.items)
  const setTimer = useStore((s) => s.setTimer)
  const close = useStore((s) => s.closeTimerConfig)

  const slide = timerSlideId
    ? items.flatMap((it) => it.slides).find((sl) => sl.id === timerSlideId) ?? null
    : null
  /**
   * Which of the two this card is, held here rather than read from the slide.
   *
   * It is a choice being made in the dialog — pick Countdown, type the minutes,
   * then Save — so the fields have to follow the choice before anything is
   * written. Reading the slide would mean the minutes field appearing only
   * after saving a change nobody could see the point of yet.
   */
  const [mode, setMode] = useState<'clock' | 'countdown'>('clock')
  const isClock = mode === 'clock'

  const [minutes, setMinutes] = useState(5)
  const [message, setMessage] = useState('')
  const [seconds, setSeconds] = useState(false)
  const [timeZone, setTimeZone] = useState('')
  const minutesRef = useRef<HTMLInputElement>(null)

  // Seed the fields from the slide each time the dialog opens on a new slide.
  useEffect(() => {
    if (!slide) return
    setMode(slide.kind === 'clock' ? 'clock' : 'countdown')
    setMinutes(slide.countdownMinutes ?? 5)
    setMessage(slide.message ?? '')
    setSeconds(!!slide.clockSeconds)
    setTimeZone(slide.clockTimeZone ?? '')
    // focus the most-edited field
    setTimeout(() => minutesRef.current?.focus(), 0)
  }, [timerSlideId]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (): void => {
    if (!slide) return
    setTimer(slide.id, {
      kind: mode,
      minutes: isClock ? undefined : minutes,
      message,
      ...(isClock ? { seconds, timeZone } : {})
    })
    close()
  }

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }) // re-bind each render so `save` closes over the latest field values

  if (!slide) return null

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal confirm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isClock ? 'Clock settings' : 'Countdown settings'}</h2>
          <button className="modal-close" onClick={close} title="Close">
            ×
          </button>
        </div>
        <div className="modal-body timer-config">
          {/* The same card in two moods. Switching here rather than deleting the
              item and building the other kind, which would lose its place in the
              order and its broadcast settings with it. */}
          <div className="timer-mode" role="group" aria-label="What this card shows">
            {([
              ['clock', 'Clock'],
              ['countdown', 'Countdown']
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={mode === k ? 'is-on' : ''}
                aria-pressed={mode === k}
                onClick={() => setMode(k)}
              >
                {label}
              </button>
            ))}
          </div>
          {!isClock && (
            <label className="timer-field">
              <span>Minutes</span>
              <input
                ref={minutesRef}
                type="number"
                min={0}
                max={600}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.min(600, Number(e.target.value) || 0)))}
              />
            </label>
          )}
          {isClock && (
            <>
              <label className="timer-field row">
                <input
                  type="checkbox"
                  checked={seconds}
                  onChange={(e) => setSeconds(e.target.checked)}
                />
                <span>Show seconds</span>
              </label>
              <label className="timer-field">
                <span>Time zone</span>
                <TimeZoneSelect value={timeZone} onChange={setTimeZone} />
              </label>
            </>
          )}
          <label className="timer-field">
            <span>Heading</span>
            <input
              type="text"
              placeholder={isClock ? 'e.g. Welcome' : 'e.g. Service begins soon'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <p className="timer-hint">Shown above {isClock ? 'the time' : 'the count'}. Leave it empty for none.</p>
          {!isClock && (
            <p className="timer-hint">Saving restarts the countdown from {minutes}:00.</p>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            {isClock ? 'Save' : 'Save & restart'}
          </button>
        </div>
      </div>
    </div>
  )
}
