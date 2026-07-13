import { useState } from 'react'

/**
 * Operator-UI chrome theme (the control window's light/dark skin). This is
 * entirely separate from the audience ThemeStyle in the store — it only paints
 * the presenter's own interface. Light is the default. Persisted to localStorage
 * so it survives restarts, and applied to <html data-theme> which the CSS reads.
 */
export type AppThemeMode = 'light' | 'dark'

const KEY = 'lumen.appTheme'

export function getStoredAppTheme(): AppThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* ignore */
  }
  return 'light'
}

/** Paint the chrome and remember the choice. Safe to call before React mounts. */
export function applyAppTheme(mode: AppThemeMode): void {
  document.documentElement.dataset.theme = mode
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
}

/** Toggle hook for the top-bar button. Returns the current mode and a toggler. */
export function useAppTheme(): [AppThemeMode, () => void] {
  const [mode, setMode] = useState<AppThemeMode>(getStoredAppTheme)
  const toggle = (): void =>
    setMode((m) => {
      const next: AppThemeMode = m === 'dark' ? 'light' : 'dark'
      applyAppTheme(next)
      return next
    })
  return [mode, toggle]
}
