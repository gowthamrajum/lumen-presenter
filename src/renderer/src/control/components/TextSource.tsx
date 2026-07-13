import { useState } from 'react'
import type { SlideContent } from '@shared/types'
import { useStore, uid } from '../../store/useStore'
import { textSlides, countdownSlide, clockSlide } from '../slides'
import { SCENES, type Scene } from '../scenes'

export function TextSource(): JSX.Element {
  const addItem = useStore((s) => s.addItem)
  const applyTheme = useStore((s) => s.applyTheme)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [minutes, setMinutes] = useState(5)
  const [timerMsg, setTimerMsg] = useState('Service starts in')

  const add = (goLive: boolean): void => {
    if (!body.trim()) return
    const name = title.trim() || 'Text'
    addItem({ title: name, kind: 'text', slides: textSlides(body, name) }, goLive)
    setBody('')
    setTitle('')
  }

  // One-click starter: adds the scene as an item, sets its animated background
  // + look, and puts it live.
  const addScene = (sc: Scene): void => {
    const slide: SlideContent = { id: uid(), kind: 'text', label: sc.name, lines: sc.lines }
    addItem({ title: sc.name, kind: 'text', slides: [slide] }, true)
    applyTheme(sc.theme ?? {}, sc.background)
  }

  const addCountdown = (): void =>
    addItem(
      { title: `Countdown ${minutes}m`, kind: 'countdown', slides: [countdownSlide(minutes, timerMsg)] },
      true
    )
  const addClock = (): void =>
    addItem({ title: 'Clock', kind: 'countdown', slides: [clockSlide()] }, true)

  return (
    <div className="source text-source">
      <div className="section-label">Quick scenes</div>
      <div className="theme-row">
        {SCENES.map((sc) => (
          <button
            key={sc.id}
            className="btn tiny"
            onClick={() => addScene(sc)}
            title={`Add & present the ${sc.name} scene (animated background)`}
          >
            {sc.name}
          </button>
        ))}
      </div>

      <div className="section-label">Pre-service timers</div>
      <input
        className="search"
        placeholder="Countdown message"
        value={timerMsg}
        onChange={(e) => setTimerMsg(e.target.value)}
      />
      <div className="timer-row">
        <label className="song-lpp">
          Minutes
          <input
            type="number"
            min={0}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, Math.min(180, Number(e.target.value) || 0)))}
          />
        </label>
        <button className="btn" onClick={addCountdown}>
          + Countdown
        </button>
        <button className="btn" onClick={addClock}>
          + Clock
        </button>
      </div>

      <div className="section-label">Custom text</div>
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
