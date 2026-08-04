import { useEffect } from 'react'
import { useStore } from '../store/useStore'

/**
 * How often Cantica asks the relay whether Sunday's service has moved on.
 *
 * The relay has no event stream for services, so this is the whole mechanism —
 * a save on the phone shows up here within one tick. Fifteen seconds is short
 * enough that a change made while the operator is watching looks immediate, and
 * the request is a small JSON list either way.
 */
export const REMOTE_POLL_MS = 15_000

/**
 * Keep the order in step with the service it was built from.
 *
 * Sunday's songs are assembled on a phone (cantica-web) and kept on the relay,
 * and they keep being assembled — a song swapped on Saturday night, a psalm
 * added on the way to church. Rather than re-exporting a file and carrying it
 * over, the projection machine keeps asking whether the service it pulled
 * has changed, and takes the new one.
 *
 * It only ever replaces the items that service put there: the rest of the
 * Sunday order, and anything added by hand, is untouched. And it only does it
 * silently while nothing is on screen — see syncRemoteServices.
 */
export function useRemoteServices(): void {
  const sync = useStore((s) => s.syncRemoteServices)
  const liveId = useStore((s) => s.liveId)
  const holding = useStore((s) => s.remoteUpdate?.serviceId ?? null)

  // A song held back because it was on screen is stale the moment it isn't, and
  // waiting out the rest of the minute would leave the operator looking at a
  // version nobody is expecting. Moving on is the cue to take it.
  useEffect(() => {
    if (holding != null) void sync()
  }, [liveId, holding, sync])

  useEffect(() => {
    void sync()
    const id = setInterval(() => void sync(), REMOTE_POLL_MS)
    // A machine that was asleep through the last few ticks is exactly the one
    // most likely to be behind, so ask again the moment it comes back.
    const wake = (): void => {
      if (!document.hidden) void sync()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
    }
  }, [sync])
}
