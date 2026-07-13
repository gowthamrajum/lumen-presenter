import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { useStore } from '../store/useStore'
import '../styles/fonts.css'
import '../styles/stage.css'
import '../styles/control.css'

function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

/** Apply a presenter shortcut. Returns true if the key was handled. */
function dispatchKey(key: string): boolean {
  const s = useStore.getState()
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
      s.goNext()
      return true
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      s.goPrev()
      return true
    case 'b':
    case 'B':
      s.toggleBlackout()
      return true
    case 'c':
    case 'C':
      s.toggleClear()
      return true
    case 'l':
    case 'L':
      s.toggleLogo()
      return true
    default:
      return false
  }
}

function Root(): JSX.Element {
  const init = useStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping()) return
      if (dispatchKey(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    // Keys pressed while the audience/output window has focus are forwarded here.
    const offOutputKey = window.lumen.onOutputKey((key) => dispatchKey(key))
    return () => {
      window.removeEventListener('keydown', onKey)
      offOutputKey()
    }
  }, [])

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
