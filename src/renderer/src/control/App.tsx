import { TopBar } from './components/TopBar'
import { LibraryPanel } from './components/LibraryPanel'
import { DeckGrid } from './components/DeckGrid'
import { LivePanel } from './components/LivePanel'

export function App(): JSX.Element {
  return (
    <div className="app">
      <TopBar />
      <div className="app-body">
        <aside className="col-library">
          <LibraryPanel />
        </aside>
        <main className="col-deck">
          <DeckGrid />
        </main>
        <aside className="col-live">
          <LivePanel />
        </aside>
      </div>
    </div>
  )
}
