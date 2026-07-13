import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { DEFAULT_LIVE, type LiveState } from '@shared/types'
import { Stage } from '../shared/Stage'
import { StageDisplay } from './StageDisplay'
import { ExportHost } from './ExportHost'
import '../styles/fonts.css'
import '../styles/stage.css'
import '../styles/output.css'

const params = new URLSearchParams(window.location.search)
const layout = params.get('layout')
/** Hidden render surface driven by the main process to build a .pptx export. */
const isExport = params.has('export')

function Output(): JSX.Element {
  const [state, setState] = useState<LiveState>(DEFAULT_LIVE)

  useEffect(() => {
    window.lumen.getLive().then(setState)
    return window.lumen.onLiveState(setState)
  }, [])

  return layout === 'stage' ? <StageDisplay state={state} /> : <Stage state={state} />
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
// The export host manages its own imperative lifecycle (no StrictMode double-mount).
root.render(
  isExport ? (
    <ExportHost />
  ) : (
    <React.StrictMode>
      <Output />
    </React.StrictMode>
  )
)
