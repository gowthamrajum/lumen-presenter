import { useState } from 'react'
import { SchedulePanel } from './SchedulePanel'
import { LibraryPanel } from './LibraryPanel'

/** Presenter-style left sidebar: switch between the Schedule (this service's
 *  items) and the Library (browse songs/bibles/media/text to add). */
export function LeftColumn(): JSX.Element {
  const [mode, setMode] = useState<'schedule' | 'library'>('schedule')

  return (
    <div className="leftcol">
      <div className="seg full leftcol-switch">
        <button
          className={`seg-btn ${mode === 'schedule' ? 'active' : ''}`}
          onClick={() => setMode('schedule')}
        >
          Schedule
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
          <LibraryPanel />
        )}
      </div>
    </div>
  )
}
