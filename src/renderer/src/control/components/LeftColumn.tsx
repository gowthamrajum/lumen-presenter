import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { Icon } from '../../shared/Icon'
import { SchedulePanel } from './SchedulePanel'
import { LibraryPanel } from './LibraryPanel'

/** Presenter-style left sidebar: switch between the Schedule (this service's
 *  items) and the Library (browse songs/bibles/media/text to add). */
export function LeftColumn(): JSX.Element {
  const [mode, setMode] = useState<'schedule' | 'library'>('schedule')
  const insertAt = useStore((s) => s.insertAt)
  const setInsertAt = useStore((s) => s.setInsertAt)

  return (
    <div className="leftcol">
      <div className="seg full leftcol-switch">
        <button
          className={`seg-btn ${mode === 'schedule' ? 'active' : ''}`}
          onClick={() => {
            setMode('schedule')
            setInsertAt(null) // leaving the Library abandons a pending insert
          }}
        >
          Sessions
        </button>
        <button
          className={`seg-btn ${mode === 'library' ? 'active' : ''}`}
          onClick={() => setMode('library')}
        >
          Library
        </button>
      </div>
      <div className="leftcol-body">
        {mode === 'schedule' ? (
          <SchedulePanel onBrowse={() => setMode('library')} />
        ) : (
          <>
            {insertAt != null && (
              <div className="insert-hint">
                <Icon name="plus" /> Inserting between sections — pick an item to drop in here.
              </div>
            )}
            <LibraryPanel />
          </>
        )}
      </div>
    </div>
  )
}
