import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'

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
  const isClock = slide?.kind === 'clock'

  const [minutes, setMinutes] = useState(5)
  const [message, setMessage] = useState('')
  const minutesRef = useRef<HTMLInputElement>(null)

  // Seed the fields from the slide each time the dialog opens on a new slide.
  useEffect(() => {
    if (!slide) return
    setMinutes(slide.countdownMinutes ?? 5)
    setMessage(slide.message ?? '')
    // focus the most-edited field
    setTimeout(() => minutesRef.current?.focus(), 0)
  }, [timerSlideId]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (): void => {
    if (!slide) return
    setTimer(slide.id, { minutes: isClock ? undefined : minutes, message })
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
          <h2>{isClock ? 'Clock settings' : 'Pre-service countdown'}</h2>
          <button className="modal-close" onClick={close} title="Close">
            ×
          </button>
        </div>
        <div className="modal-body timer-config">
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
          <label className="timer-field">
            <span>Message {isClock ? '' : '(shown above the count)'}</span>
            <input
              type="text"
              placeholder={isClock ? 'Optional caption' : 'e.g. Service begins soon'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
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
