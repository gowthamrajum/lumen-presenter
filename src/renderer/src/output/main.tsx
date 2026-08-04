import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { DEFAULT_LIVE, type LiveState } from '@shared/types'
import { Stage } from '../shared/Stage'
import { useMediaTransport } from './useMediaTransport'
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
  // Sound belongs to ONE window. The main process picks it (the first audience
  // output) and tells each window whether it is the one; a stage monitor and any
  // second audience screen are told no, so a clip is never heard twice.
  const [audio, setAudio] = useState(false)
  // The window that owns the sound is the one the transport drives — the same
  // one the operator is actually watching the clip on.
  const attachMedia = useMediaTransport(audio)

  useEffect(() => {
    window.lumen.getLive().then(setState)
    const offLive = window.lumen.onLiveState(setState)
    const offAudio = window.lumen.onAudioOwner(setAudio)
    return () => {
      offLive()
      offAudio()
    }
  }, [])

  // The audience layout IS the Go Live screen — the only surface that honours
  // theme.lineSpacing. The stage monitor keeps the default spacing.
  return layout === 'stage' ? (
    <StageDisplay state={state} />
  ) : (
    <Stage state={state} live audio={audio} onMediaEl={attachMedia} />
  )
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
