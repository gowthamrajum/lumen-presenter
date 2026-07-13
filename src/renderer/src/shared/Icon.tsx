import type { CSSProperties, JSX } from 'react'

/**
 * A tiny inline-SVG icon set. Self-sizing (1em) so an icon inherits the font
 * size and color of whatever it sits in — drop it anywhere a glyph used to be.
 * Kept dependency-free (no icon library) and living in `shared/` so both the
 * operator and the audience/output windows can use it.
 */
export type IconName =
  | 'spark'
  | 'monitor'
  | 'tv'
  | 'cross'
  | 'music'
  | 'type'
  | 'image'
  | 'play'
  | 'slides'
  | 'square'
  | 'timer'
  | 'broadcast'
  | 'broadcast-off'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'dots'
  | 'pencil'
  | 'refresh'
  | 'repeat'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'grip'
  | 'sun'
  | 'moon'
  | 'download'
  | 'flame'

// Each entry draws inside a 24x24 viewBox. Stroked by default (inherits color);
// icons that read better solid set their own fill/stroke on the element.
const PATHS: Record<IconName, JSX.Element> = {
  spark: <path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z" fill="currentColor" stroke="none" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  tv: (
    <>
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M7 7l5-4 5 4" />
    </>
  ),
  cross: <path d="M10 3h4v5h5v4h-5v9h-4v-9H5V8h5z" fill="currentColor" stroke="none" />,
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="16" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  type: <path d="M4 6V4h16v2M12 4v16M9 20h6" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M21 15l-5-5-9 9" />
    </>
  ),
  play: <path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none" />,
  slides: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 13v-3M12 13V8M16 13v-5M12 17v3M9 20h6" />
    </>
  ),
  square: <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" fill="currentColor" stroke="none" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V9M9 2h6M18.5 5.5L20 4" />
    </>
  ),
  broadcast: (
    <>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M8 8a5.5 5.5 0 000 8M16 8a5.5 5.5 0 010 8M5 5a10 10 0 000 14M19 5a10 10 0 010 14" />
    </>
  ),
  'broadcast-off': (
    <>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M8 8a5.5 5.5 0 000 8M16 8a5.5 5.5 0 010 8" />
      <path d="M4 20L20 4" />
    </>
  ),
  'chevron-up': <path d="M6 15l6-6 6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-left': <path d="M15 6l-6 6 6 6" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 00-3-3L5 17z" />
      <path d="M13.5 6.5l3 3" />
    </>
  ),
  refresh: <path d="M21 12a9 9 0 11-2.6-6.4M21 3v6h-6" />,
  repeat: (
    <>
      <path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14" />
      <path d="M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
    </>
  ),
  'align-left': <path d="M4 6h16M4 12h10M4 18h13" />,
  'align-center': <path d="M4 6h16M7 12h10M6 18h12" />,
  'align-right': <path d="M4 6h16M10 12h10M7 18h13" />,
  grip: (
    <g fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </g>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
  )
}

export function Icon({
  name,
  className,
  style
}: {
  name: IconName
  className?: string
  style?: CSSProperties
}): JSX.Element {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ verticalAlign: '-0.125em', flex: '0 0 auto', ...style }}
    >
      {PATHS[name]}
    </svg>
  )
}
