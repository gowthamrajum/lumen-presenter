import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore, suppressedOn } from '../../store/useStore'
import { Icon } from '../../shared/Icon'
import type { ServiceItem } from '@shared/types'

/** A labelled on/off toggle row (hoisted so it isn't remounted each render). */
function SwitchRow({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }): JSX.Element {
  return (
    <button className={`bc-switch-row ${on ? 'on' : ''}`} onClick={onToggle} role="switch" aria-checked={on}>
      <span className="bc-switch-label">{label}</span>
      <span className="bc-switch-state">{on ? 'On' : 'Off'}</span>
      <span className="switch" aria-hidden="true">
        <span className="switch-knob" />
      </span>
    </button>
  )
}

/**
 * Per-item web-broadcast control. The trigger is colour-coded — green when the
 * item goes to all channels, yellow when partial (one channel), red when it's
 * fully off-air. Clicking opens a centered modal (so it's never clipped by the
 * schedule list) with a toggle switch for All, Users (audience mirror) and
 * Stream (OBS). Local output always shows the item; these only gate the relay.
 */
export function BroadcastToggle({ item }: { item: ServiceItem }): JSX.Element {
  const setItemBroadcast = useStore((s) => s.setItemBroadcast)
  const setItemBroadcastAll = useStore((s) => s.setItemBroadcastAll)
  const [open, setOpen] = useState(false)

  const usersOn = !suppressedOn(item, 'users')
  const streamOn = !suppressedOn(item, 'stream')
  const allOn = usersOn && streamOn
  const noneOn = !usersOn && !streamOn
  const state = allOn ? 'all' : noneOn ? 'none' : 'partial'
  const summary = allOn ? 'On all channels' : noneOn ? 'Off the web broadcast' : `${usersOn ? 'Users' : 'Stream'} only`

  return (
    <div className="bcast-wrap">
      <button
        className={`bcast-toggle st-${state}`}
        title={`Web broadcast: ${summary} — click to change`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Icon name={noneOn ? 'broadcast-off' : 'broadcast'} />
      </button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={(e) => { e.stopPropagation(); setOpen(false) }}>
          <div className="modal bcast-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Web broadcast</h2>
              <button className="modal-close" onClick={() => setOpen(false)} title="Close">
                <Icon name="close" />
              </button>
            </div>
            <div className="modal-body">
              <div className="bc-modal-item">
                <span className={`bcast-dot st-${state}`} />
                <span className="bc-modal-title" title={item.title}>{item.title}</span>
                <span className="bc-modal-summary">{summary}</span>
              </div>
              <SwitchRow on={allOn} onToggle={() => setItemBroadcastAll(item.id, !allOn)} label="Broadcast to all" />
              <SwitchRow on={usersOn} onToggle={() => setItemBroadcast(item.id, 'users', !usersOn)} label="Broadcast to Users (audience)" />
              <SwitchRow on={streamOn} onToggle={() => setItemBroadcast(item.id, 'stream', !streamOn)} label="Broadcast to Stream (OBS)" />
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" onClick={() => setOpen(false)}>Done</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
