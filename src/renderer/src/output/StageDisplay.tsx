import { useEffect, useState } from 'react'
import type { LiveState } from '@shared/types'
import { Stage } from '../shared/Stage'

/** Confidence monitor for the platform: current slide, next slide, and a clock.
 *  Always shows content (ignores blackout/clear so the team can follow along). */
export function StageDisplay({ state }: { state: LiveState }): JSX.Element {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })

  const current: LiveState = { ...state, blackout: false, clearText: false, showLogo: false }
  const next: LiveState = {
    ...state,
    slide: state.next ?? null,
    blackout: false,
    clearText: false,
    showLogo: false
  }

  return (
    <div className="stage-display">
      <div className="sd-top">
        <div className="sd-clock">{clock}</div>
        <div className="sd-badges">
          <span className="sd-badge live">LIVE</span>
          {state.blackout && <span className="sd-badge black">BLACK</span>}
          {state.clearText && <span className="sd-badge clear">CLEAR</span>}
        </div>
      </div>
      <div className="sd-main">
        <div className="sd-section sd-current">
          <div className="sd-label">CURRENT</div>
          <div className="sd-preview">
            {state.slide ? <Stage state={current} /> : <div className="sd-empty">—</div>}
          </div>
        </div>
        <div className="sd-section sd-next">
          <div className="sd-label">NEXT</div>
          <div className="sd-preview next">
            {state.next ? <Stage state={next} /> : <div className="sd-empty">End of service</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
