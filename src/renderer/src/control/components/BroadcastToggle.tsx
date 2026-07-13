import { useState } from 'react'
import { useStore, suppressedOn } from '../../store/useStore'
import { Icon } from '../../shared/Icon'
import type { ServiceItem } from '@shared/types'

/**
 * Per-item web-broadcast control. The trigger is colour-coded — green when the
 * item goes to all channels, yellow when partial (one channel), red when it's
 * fully off-air — and opens a little menu of toggles: Broadcast to all, to Users
 * (audience mirror), and to Stream (OBS). Local output always shows the item;
 * these only gate the web relay.
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
  const title = allOn
    ? 'Broadcasting to all — click to change'
    : noneOn
      ? 'Off the web broadcast — click to change'
      : `Broadcasting to ${usersOn ? 'Users' : 'Stream'} only — click to change`

  return (
    <div className="bcast-wrap">
      <button
        className={`bcast-toggle st-${state}`}
        title={title}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <Icon name={noneOn ? 'broadcast-off' : 'broadcast'} />
      </button>
      {open && (
        <>
          <div
            className="dropdown-backdrop"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          />
          <div className="bcast-menu" onClick={(e) => e.stopPropagation()}>
            <div className="bcast-menu-title">Web broadcast</div>
            <button
              className={`bcast-opt ${allOn ? 'on' : ''}`}
              onClick={() => setItemBroadcastAll(item.id, !allOn)}
            >
              <span className={`bcast-dot st-${state}`} />
              <span className="bcast-opt-label">Broadcast to all</span>
              <span className="bcast-switch">{allOn ? 'On' : 'Off'}</span>
            </button>
            <button
              className={`bcast-opt ${usersOn ? 'on' : ''}`}
              onClick={() => setItemBroadcast(item.id, 'users', !usersOn)}
            >
              <Icon name="tv" />
              <span className="bcast-opt-label">Broadcast to Users</span>
              <span className="bcast-switch">{usersOn ? 'On' : 'Off'}</span>
            </button>
            <button
              className={`bcast-opt ${streamOn ? 'on' : ''}`}
              onClick={() => setItemBroadcast(item.id, 'stream', !streamOn)}
            >
              <Icon name="broadcast" />
              <span className="bcast-opt-label">Broadcast to Stream</span>
              <span className="bcast-switch">{streamOn ? 'On' : 'Off'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
