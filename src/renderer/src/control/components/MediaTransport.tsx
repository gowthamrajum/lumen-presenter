import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { Icon } from '../../shared/Icon'
import type { MediaState, ServiceItem } from '@shared/types'

/** m:ss, and h:mm:ss once a file is long enough to need it. */
function clock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec % 60)
  const m = Math.floor((sec / 60) % 60)
  const h = Math.floor(sec / 3600)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/**
 * Play, pause, scrub and mute the clip on the audience screen.
 *
 * The file plays in the output window, so this drives it across the process
 * boundary rather than holding a player of its own — what moves here is what the
 * congregation sees, not a second copy running beside it. Which is the point:
 * the welcome video can be held on its first frame until the room settles, or
 * taken back thirty seconds because somebody walked in.
 *
 * A clip that is not on screen has nothing to drive, so Play shows it first.
 */
export function MediaTransport({ item }: { item: ServiceItem }): JSX.Element {
  const liveId = useStore((s) => s.liveId)
  const goLive = useStore((s) => s.goLive)
  const setItemSound = useStore((s) => s.setItemSound)
  const [st, setSt] = useState<MediaState>({ t: 0, duration: 0, paused: true })
  /** while the operator is dragging, the bar follows the finger, not the clip */
  const [scrub, setScrub] = useState<number | null>(null)
  /** the same, for the volume slider — the player's report lags the drag */
  const [volDrag, setVolDrag] = useState<number | null>(null)

  const slide = item.slides.find(
    (sl) =>
      sl.background?.type === 'video' ||
      sl.background?.type === 'audio' ||
      sl.background?.type === 'youtube'
  )
  const isLive = !!slide && slide.id === liveId

  useEffect(() => {
    if (!isLive) {
      setSt({ t: 0, duration: 0, paused: true })
      return
    }
    return window.lumen.onMediaState(setSt)
  }, [isLive])

  const send = window.lumen.mediaControl
  const at = scrub ?? st.t
  const dur = st.duration
  const kind = slide?.background?.type === 'audio' ? 'track' : 'clip'
  // Full until the player says otherwise: a slider that starts at zero reads as
  // "there is no sound" on a clip that is in fact about to play at full volume.
  const vol = volDrag ?? (st.muted ? 0 : st.volume ?? 100)

  const playPause = (): void => {
    if (!slide) return
    // Not on screen yet: showing it IS starting it — the element autoplays.
    if (!isLive) {
      goLive(slide.id)
      return
    }
    send({ cmd: st.paused ? 'play' : 'pause' })
  }

  return (
    <div className="transport">
      <button
        className="transport-btn"
        onClick={playPause}
        title={!isLive ? `Show this ${kind} and play it` : st.paused ? 'Play' : 'Pause'}
      >
        <Icon name={isLive && !st.paused ? 'pause' : 'play'} />
      </button>

      <span className="transport-time">{clock(at)}</span>
      <input
        className="transport-seek"
        type="range"
        min={0}
        max={dur > 0 ? dur : 1}
        step={0.1}
        value={Math.min(at, dur > 0 ? dur : 1)}
        disabled={!isLive || dur <= 0}
        onChange={(e) => setScrub(Number(e.target.value))}
        onMouseUp={() => {
          if (scrub != null) send({ cmd: 'seek', value: scrub })
          setScrub(null)
        }}
        onKeyUp={() => {
          if (scrub != null) send({ cmd: 'seek', value: scrub })
          setScrub(null)
        }}
        aria-label={`Seek the ${kind}`}
      />
      <span className="transport-time">{dur > 0 ? clock(dur) : '—:—'}</span>

      <button
        className={`transport-btn ${item.sound ? 'on' : ''}`}
        onClick={() => setItemSound(item.id, !item.sound)}
        title={item.sound ? 'Sound on — click to mute' : 'Muted — click to play the sound'}
        aria-pressed={!!item.sound}
      >
        <Icon name={item.sound ? 'sound' : 'sound-off'} />
      </button>

      {/* How loud, not merely whether. The button above decides what this item
          IS — a silent backdrop or a clip with sound — and that is a property of
          the service. This is the level in the room right now, which is a thing
          you adjust while it plays, so it applies as it moves rather than on
          release. Only offered on a clip that is actually making sound. */}
      {item.sound && (
        <input
          className="transport-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          value={vol}
          disabled={!isLive}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVolDrag(v)
            send({ cmd: 'volume', value: v })
          }}
          onMouseUp={() => setVolDrag(null)}
          onKeyUp={() => setVolDrag(null)}
          title={`Volume ${vol}%`}
          aria-label={`Volume for this ${kind}`}
        />
      )}

      {!isLive && <span className="transport-note">Not on screen</span>}
    </div>
  )
}
