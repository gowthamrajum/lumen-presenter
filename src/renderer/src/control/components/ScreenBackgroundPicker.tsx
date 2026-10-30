import { useEffect, useState } from 'react'
import type { Background, LibraryBackground } from '@shared/types'
import { useStore } from '../../store/useStore'
import { BACKGROUND_PRESETS } from '../presets'

const swatchBg = (bg: Background): React.CSSProperties =>
  bg.type === 'image'
    ? { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: bg.value }

// "#t=1": a tile shows a frame from a second in — a clip's very first frame is
// often black, and a row of black tiles can't be told apart.
const same = (a: Background | undefined, b: Background): boolean => !!a && a.type === b.type && a.value === b.value

/** What the screen row's button says the screen is showing. */
export function screenBackgroundLabel(bg: Background | undefined): string {
  if (!bg) return 'Same as service'
  const preset = BACKGROUND_PRESETS.find((p) => same(bg, p.background))
  if (preset) return preset.name
  if (bg.type === 'color') return bg.value
  const file = decodeURIComponent(bg.value.split(/[/\\]/).pop() ?? '').replace(/\.[a-z0-9]+$/i, '')
  return file || (bg.type === 'video' ? 'Video' : 'Image')
}

/**
 * One screen's own background, chosen from the same places as the service's —
 * the shared library, the presets, the media imported on this computer — or
 * "Same as service" to follow the main one again.
 */
export function ScreenBackgroundPicker({
  displayId,
  current,
  onPicked
}: {
  displayId: number
  current: Background | undefined
  onPicked: () => void
}): JSX.Element {
  const setScreenBackground = useStore((s) => s.setScreenBackground)
  const media = useStore((s) => s.media)
  const [library, setLibrary] = useState<LibraryBackground[] | null>(null)

  useEffect(() => {
    let alive = true
    void window.lumen.bgLibrary().then((list) => alive && setLibrary(list ?? []))
    return () => {
      alive = false
    }
  }, [])

  const pick = (bg: Background | null): void => {
    void setScreenBackground(displayId, bg)
    onPicked()
  }

  const imported = media.filter((m) => !m.isAudio)

  return (
    <div className="screen-bg-picker">
      <button className={`motion-opt ${!current ? 'active' : ''}`} onClick={() => pick(null)}>
        <span className="motion-dot" />
        Same as service
      </button>

      {!!library?.length && (
        <>
          <div className="screen-bg-head">Library</div>
          <div className="bg-gallery">
            {library.map((b) => {
              const bg: Background = { type: b.kind, value: b.url, fit: 'cover' }
              return (
                <button
                  key={b.id}
                  className={`bg-tile ${same(current, bg) ? 'active' : ''}`}
                  title={b.name}
                  onClick={() => pick(bg)}
                >
                  {b.kind === 'video' ? (
                    <span className="bg-swatch bg-video">
                      <video src={`${b.local ?? b.url}#t=1`} muted playsInline preload="metadata" />
                    </span>
                  ) : (
                    <span className="bg-swatch" style={swatchBg({ type: 'image', value: b.local ?? b.url })} />
                  )}
                  <span className="bg-name">{b.name}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {!!imported.length && (
        <>
          <div className="screen-bg-head">Imported</div>
          <div className="bg-gallery">
            {imported.map((m) => {
              const bg: Background = { type: m.isVideo ? 'video' : 'image', value: m.url, fit: 'cover' }
              return (
                <button
                  key={m.url}
                  className={`bg-tile ${same(current, bg) ? 'active' : ''}`}
                  title={m.name}
                  onClick={() => pick(bg)}
                >
                  {m.isVideo ? (
                    <span className="bg-swatch bg-video">
                      <video src={`${m.url}#t=1`} muted playsInline preload="metadata" />
                    </span>
                  ) : (
                    <span className="bg-swatch" style={swatchBg(bg)} />
                  )}
                  <span className="bg-name">{m.name}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="screen-bg-head">Presets</div>
      <div className="bg-gallery">
        {BACKGROUND_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`bg-tile ${same(current, p.background) ? 'active' : ''}`}
            title={p.name}
            onClick={() => pick(p.background)}
          >
            <span className="bg-swatch" style={swatchBg(p.background)} />
            <span className="bg-name">{p.name}</span>
          </button>
        ))}
        <label className="bg-tile custom" title="Custom color">
          <span className="bg-swatch rainbow" />
          <span className="bg-name">Custom</span>
          <input
            type="color"
            value={current?.type === 'color' ? current.value : '#000000'}
            onChange={(e) => void setScreenBackground(displayId, { type: 'color', value: e.target.value })}
          />
        </label>
      </div>

      <div className="screens-hint">
        Replaces the background behind the words on this screen only. A video plays on songs only, and only on the
        Motion screen — elsewhere it shows the default still.
      </div>
    </div>
  )
}
