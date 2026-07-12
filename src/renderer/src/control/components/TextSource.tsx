import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { textSlides } from '../slides'

export function TextSource(): JSX.Element {
  const addSlides = useStore((s) => s.addSlides)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const add = (goLive: boolean): void => {
    if (!body.trim()) return
    addSlides(textSlides(body, title.trim() || 'Text'), goLive)
    setBody('')
    setTitle('')
  }

  return (
    <div className="source text-source">
      <input
        className="search"
        placeholder="Title (e.g. song name)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="text-input"
        placeholder={
          'Type or paste lyrics / text.\n\nBlank line = new slide.\nSingle line break = new line on the same slide.'
        }
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="source-actions">
        <button className="btn btn-primary" onClick={() => add(false)} disabled={!body.trim()}>
          Add slides
        </button>
        <button className="btn" onClick={() => add(true)} disabled={!body.trim()}>
          Add &amp; Present
        </button>
      </div>
      <div className="source-hint">Each blank-line-separated block becomes its own slide.</div>
    </div>
  )
}
