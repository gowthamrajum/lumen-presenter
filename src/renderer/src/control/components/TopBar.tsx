import { useStore } from '../../store/useStore'

export function TopBar(): JSX.Element {
  const displays = useStore((s) => s.displays)
  const selectedDisplayId = useStore((s) => s.selectedDisplayId)
  const setSelectedDisplay = useStore((s) => s.setSelectedDisplay)
  const outputStatus = useStore((s) => s.outputStatus)
  const openOutput = useStore((s) => s.openOutput)
  const closeOutput = useStore((s) => s.closeOutput)

  const blackout = useStore((s) => s.blackout)
  const clearText = useStore((s) => s.clearText)
  const showLogo = useStore((s) => s.showLogo)
  const toggleBlackout = useStore((s) => s.toggleBlackout)
  const toggleClear = useStore((s) => s.toggleClear)
  const toggleLogo = useStore((s) => s.toggleLogo)

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">✦</span>
        <span className="brand-name">Lumen</span>
        <span className="brand-sub">Presenter</span>
      </div>

      <div className="topbar-spacer" />

      <div className="output-controls">
        <span className={`status-dot ${outputStatus.open ? 'on' : 'off'}`} />
        <select
          className="display-select"
          value={selectedDisplayId ?? ''}
          onChange={(e) => setSelectedDisplay(e.target.value ? Number(e.target.value) : null)}
          title="Audience display"
        >
          {displays.map((d) => (
            <option key={d.id} value={d.id}>
              {d.primary ? '🖥 ' : '📺 '}
              {d.label}
              {d.primary ? ' (primary)' : ''}
            </option>
          ))}
        </select>
        {outputStatus.open ? (
          <button className="btn btn-danger" onClick={() => void closeOutput()}>
            Close Output
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => void openOutput()}>
            Go Live
          </button>
        )}
      </div>

      <div className="quick-controls">
        <button className={`btn toggle ${showLogo ? 'active' : ''}`} onClick={toggleLogo}>
          Logo
        </button>
        <button className={`btn toggle ${clearText ? 'active' : ''}`} onClick={toggleClear}>
          Clear
        </button>
        <button className={`btn toggle danger ${blackout ? 'active' : ''}`} onClick={toggleBlackout}>
          Black
        </button>
      </div>
    </header>
  )
}
