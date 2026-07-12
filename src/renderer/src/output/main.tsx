import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { DEFAULT_LIVE, type LiveState } from '@shared/types'
import { Stage } from '../shared/Stage'
import '../styles/stage.css'
import '../styles/output.css'

function Output(): JSX.Element {
  const [state, setState] = useState<LiveState>(DEFAULT_LIVE)

  useEffect(() => {
    window.lumen.getLive().then(setState)
    return window.lumen.onLiveState(setState)
  }, [])

  return <Stage state={state} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Output />
  </React.StrictMode>
)
