import { useEffect, useState } from 'react'
import type { BgCacheProgress } from '@shared/types'

/**
 * How far this computer has got downloading the background library — asked on
 * mount (a download may already be under way when the window opens), then
 * followed as main reports it. null until the first answer.
 */
export function useBgCacheProgress(): BgCacheProgress | null {
  const [p, setP] = useState<BgCacheProgress | null>(null)
  useEffect(() => {
    let alive = true
    void window.lumen
      .bgCacheStatus()
      .then((s) => alive && setP(s))
      .catch(() => {})
    const off = window.lumen.onBgCacheProgress(setP)
    return () => {
      alive = false
      off()
    }
  }, [])
  return p
}

/** "3 of 12 · 42%" — the file being fetched, and the whole round by size. */
export function progressText(p: BgCacheProgress): { label: string; fraction: number } {
  const fraction = p.totalBytes ? p.bytes / p.totalBytes : p.files ? p.done / p.files : 0
  const n = Math.min(p.files, p.done + 1)
  return { label: `${n} of ${p.files} · ${Math.round(fraction * 100)}%`, fraction }
}
