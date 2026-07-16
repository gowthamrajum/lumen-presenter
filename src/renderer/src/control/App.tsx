import { TopBar } from './components/TopBar'
import { LeftColumn } from './components/LeftColumn'
import { SlidesPanel } from './components/SlidesPanel'
import { LivePanel } from './components/LivePanel'
import { SlideComposer } from './components/SlideComposer'
import { CountdownDialog } from './components/CountdownDialog'
import { useRemoteControl } from './useRemoteControl'

export function App(): JSX.Element {
  useRemoteControl()
  return (
    <div className="app">
      <TopBar />
      <div className="app-body">
        <aside className="col-left">
          <LeftColumn />
        </aside>
        <main className="col-center">
          <SlidesPanel />
        </main>
        <aside className="col-right">
          <LivePanel />
        </aside>
      </div>
      <SlideComposer />
      <CountdownDialog />
    </div>
  )
}
