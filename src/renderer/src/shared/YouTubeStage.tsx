import { useEffect, useRef, type JSX } from 'react'
import type { MediaCommand } from '@shared/types'
import { youtubeEmbedUrl, youtubeThumb } from '@shared/youtube'

/**
 * A YouTube video as a stage background.
 *
 * Only the live audience screen runs a real player; every other surface
 * (operator previews, thumbnails, the stage monitor, the export host) shows the
 * poster still, so we never spin up a dozen autoplaying iframes for one link.
 *
 * The audience screen that owns the sound is also the one wired to the
 * operator's transport: it takes play/pause/seek commands and streams its
 * position back — over the YouTube IFrame API's postMessage protocol, the same
 * MediaCommand / mediaState channel a local <video> uses, so MediaTransport
 * drives a YouTube clip exactly as it drives a file. Commands post with a
 * wildcard target so they land even under the packaged app's file:// origin;
 * the position read-out relies on the player posting back, which needs a real
 * origin (see youtubeEmbedUrl).
 *
 * `sound`/`audio` mirror the <video> rules: a backdrop (no sound) loops muted;
 * a clip (sound on) plays once, unmuted only on the audio-owner screen, and
 * hands the service on when it ends.
 */
export function YouTubeBackground({
  id,
  live,
  sound,
  audio,
  onEnded
}: {
  id: string
  live?: boolean
  sound?: boolean
  audio?: boolean
  onEnded?: () => void
}): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const heard = !!sound && !!audio // this is the one screen that may make noise
  const controls = !!live && !!audio // …and the one wired to the transport
  const mute = !heard
  const loop = !sound // a backdrop loops; a clip plays once

  // Transport bridge — active only on the live audio-owner audience screen.
  useEffect(() => {
    if (!controls) return
    const post = (msg: object): void =>
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*')

    // Handshake: ask the player to start streaming state, retrying until it does.
    let ready = false
    const hello = (): void => post({ event: 'listening', id: 1, channel: 'widget' })
    hello()
    const hs = window.setInterval(() => {
      if (!ready) hello()
    }, 400)

    const onMsg = (e: MessageEvent): void => {
      if (!/\byoutube(-nocookie)?\.com$/.test(e.origin.replace(/^https?:\/\//, ''))) return
      let d: { event?: string; info?: { currentTime?: number; duration?: number; playerState?: number } | number }
      try {
        d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      } catch {
        return
      }
      if (!d || typeof d !== 'object') return
      ready = true
      if (d.event === 'infoDelivery' && d.info && typeof d.info === 'object') {
        const info = d.info
        const ps = info.playerState
        window.lumen.mediaState({
          t: info.currentTime ?? 0,
          duration: info.duration ?? 0,
          paused: ps !== 1 // 1 = playing
        })
        if (ps === 0) onEndedRef.current?.() // 0 = ended
      } else if (d.event === 'onStateChange' && d.info === 0) {
        onEndedRef.current?.()
      }
    }
    window.addEventListener('message', onMsg)

    const offCtl = window.lumen.onMediaControl((c: MediaCommand) => {
      if (c.cmd === 'play') post({ event: 'command', func: 'playVideo', args: [] })
      else if (c.cmd === 'pause') post({ event: 'command', func: 'pauseVideo', args: [] })
      else if (c.cmd === 'seek' && typeof c.value === 'number')
        post({ event: 'command', func: 'seekTo', args: [Math.max(0, c.value), true] })
    })

    return () => {
      window.clearInterval(hs)
      window.removeEventListener('message', onMsg)
      offCtl()
    }
    // `id`, `mute` and `loop` change the src, which reloads the player, so the
    // bridge must re-handshake with the fresh document.
  }, [controls, id, mute, loop])

  if (!live) {
    return <img className="stage-bg" style={{ objectFit: 'cover' }} src={youtubeThumb(id)} alt="" />
  }

  return (
    <iframe
      ref={iframeRef}
      className="stage-bg"
      style={{ border: 0, pointerEvents: 'none' }}
      src={youtubeEmbedUrl(id, { mute, loop })}
      title="YouTube video"
      allow="autoplay; encrypted-media; picture-in-picture"
    />
  )
}
