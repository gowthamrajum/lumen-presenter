import { useState } from 'react'
import { SongsPanel } from './SongsPanel'
import { BibleSource } from './BibleSource'
import { PsalmsSource } from './PsalmsSource'
import { MediaSource } from './MediaSource'
import { TextSource } from './TextSource'

type Tab = 'songs' | 'bible' | 'psalms' | 'media' | 'text'

export function LibraryPanel(): JSX.Element {
  const [tab, setTab] = useState<Tab>('songs')

  return (
    <div className="library">
      <div className="tabs">
        <button className={`tab ${tab === 'songs' ? 'active' : ''}`} onClick={() => setTab('songs')}>
          Songs
        </button>
        <button className={`tab ${tab === 'bible' ? 'active' : ''}`} onClick={() => setTab('bible')}>
          Bible
        </button>
        <button className={`tab ${tab === 'psalms' ? 'active' : ''}`} onClick={() => setTab('psalms')}>
          Psalms
        </button>
        <button className={`tab ${tab === 'media' ? 'active' : ''}`} onClick={() => setTab('media')}>
          Media
        </button>
        <button className={`tab ${tab === 'text' ? 'active' : ''}`} onClick={() => setTab('text')}>
          Text
        </button>
      </div>
      <div className="tab-body">
        {tab === 'songs' && <SongsPanel />}
        {tab === 'bible' && <BibleSource />}
        {tab === 'psalms' && <PsalmsSource />}
        {tab === 'media' && <MediaSource />}
        {tab === 'text' && <TextSource />}
      </div>
    </div>
  )
}
