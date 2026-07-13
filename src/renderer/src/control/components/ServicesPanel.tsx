import { useState } from 'react'
import { useStore } from '../../store/useStore'

export function ServicesPanel(): JSX.Element {
  const serviceName = useStore((s) => s.serviceName)
  const serviceId = useStore((s) => s.serviceId)
  const items = useStore((s) => s.items)
  const renameService = useStore((s) => s.renameService)
  const saveService = useStore((s) => s.saveService)
  const newService = useStore((s) => s.newService)
  const savedServices = useStore((s) => s.savedServices)
  const openService = useStore((s) => s.openService)
  const deleteService = useStore((s) => s.deleteService)

  const [saving, setSaving] = useState(false)

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await saveService()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="source services-source">
      <div className="section-label">Current service</div>
      <input
        className="search"
        value={serviceName}
        onChange={(e) => renameService(e.target.value)}
        placeholder="Service name (e.g. Sunday 10 AM)"
      />
      <div className="source-actions">
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : serviceId ? 'Save' : 'Save service'}
        </button>
        <button className="btn" onClick={newService} title="Start a new empty service">
          New
        </button>
      </div>
      <div className="source-hint">
        {items.length} item{items.length === 1 ? '' : 's'} in this service. Saving keeps it on this
        computer to reuse later.
      </div>

      <div className="section-label">Saved services</div>
      {savedServices.length === 0 && <div className="empty-note">No saved services yet.</div>}
      <div className="service-list">
        {savedServices.map((s) => (
          <div
            key={s.id}
            className={`service-row ${s.id === serviceId ? 'active' : ''}`}
            onClick={() => void openService(s.id)}
            title="Open this service"
          >
            <div className="service-row-main">
              <div className="service-name">{s.name}</div>
              <div className="service-meta">
                {s.itemCount} item{s.itemCount === 1 ? '' : 's'}
                {s.savedAt ? ` · ${new Date(s.savedAt).toLocaleDateString()}` : ''}
              </div>
            </div>
            <button
              className="service-del"
              title="Delete this service"
              onClick={(e) => {
                e.stopPropagation()
                void deleteService(s.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
