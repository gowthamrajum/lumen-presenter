// Recognize and embed YouTube links.
//
// A YouTube "watch" page is not a media file a <video> can load, so a pasted
// link plays as an <iframe> embed instead. This module is the one place that
// decides what counts as a YouTube link and how to turn it into a stage-ready
// embed — shared so the store, the control UI and the Stage all agree.

/** The 11-char video id from any common YouTube URL (watch, youtu.be, embed,
 *  shorts, live) — or a bare id pasted on its own. null if it isn't YouTube. */
export function youtubeId(input: string): string | null {
  const s = (input ?? '').trim()
  if (!s) return null
  // A bare id someone pasted without the surrounding URL.
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s

  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase()
  const isYt =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be'
  if (!isYt) return null

  let id = ''
  if (host === 'youtu.be') id = u.pathname.slice(1)
  else if (u.pathname === '/watch') id = u.searchParams.get('v') ?? ''
  else {
    const m = /^\/(?:embed|shorts|v|live)\/([^/?#]+)/.exec(u.pathname)
    if (m) id = m[1]
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
}

/** Poster still for a video id — shown on operator previews and thumbnails so
 *  those surfaces stay light (only the live audience screen runs a real player). */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/**
 * A privacy-friendly (nocookie) embed url with the player chrome stripped for
 * stage use: no controls/branding, autoplaying, muted or not, looping or not.
 * `enablejsapi` lets the audience window drive it (play/pause/seek) and read its
 * position back over postMessage — see YouTubeBackground.
 */
export function youtubeEmbedUrl(id: string, opts: { mute: boolean; loop: boolean }): string {
  const p = new URLSearchParams({
    autoplay: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    modestbranding: '1',
    rel: '0',
    iv_load_policy: '3',
    playsinline: '1',
    enablejsapi: '1',
    mute: opts.mute ? '1' : '0'
  })
  // YouTube's loop needs the video listed as its own single-item playlist.
  if (opts.loop) {
    p.set('loop', '1')
    p.set('playlist', id)
  }
  // A real http(s) origin lets the player post its state back for the transport
  // read-out. Under file:// (the packaged app) we omit it; commands still reach
  // the player (wildcard target), the position read-out just may not stream.
  const origin =
    typeof location !== 'undefined' && location.protocol.startsWith('http') ? location.origin : ''
  if (origin) p.set('origin', origin)

  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`
}
