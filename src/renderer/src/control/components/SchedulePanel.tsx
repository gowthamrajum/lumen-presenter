import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { SERVICE_TEMPLATES } from '../templates'
import { ConfirmDialog } from './ConfirmDialog'
import type { ItemKind } from '@shared/types'

const KIND_ICON: Record<ItemKind, string> = {
  scripture: '✝',
  song: '♪',
  text: '¶',
  media: '🖼',
  video: '▶',
  ppt: '▤',
  blank: '⬛',
  countdown: '⏱'
}

export function SchedulePanel({ onBrowse }: { onBrowse: () => void }): JSX.Element {
  const items = useStore((s) => s.items)
  const selectedItemId = useStore((s) => s.selectedItemId)
  const selectItem = useStore((s) => s.selectItem)
  const moveItem = useStore((s) => s.moveItem)
  const removeItem = useStore((s) => s.removeItem)

  const serviceName = useStore((s) => s.serviceName)
  const serviceId = useStore((s) => s.serviceId)
  const renameService = useStore((s) => s.renameService)
  const saveService = useStore((s) => s.saveService)
  const newService = useStore((s) => s.newService)
  const applyTemplate = useStore((s) => s.applyTemplate)
  const savedServices = useStore((s) => s.savedServices)
  const openService = useStore((s) => s.openService)
  const deleteService = useStore((s) => s.deleteService)

  const [menu, setMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  /** template id awaiting a replace-confirmation (null = no dialog open) */
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)

  // Replacing the current setlist with a template shouldn't silently discard
  // unsaved work — confirm first when there's something in the schedule.
  const startTemplate = (id: string): void => {
    setMenu(false)
    if (items.length) setPendingTemplate(id)
    else applyTemplate(id)
  }

  const pending = pendingTemplate ? SERVICE_TEMPLATES.find((t) => t.id === pendingTemplate) : null

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await saveService()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="schedule">
      <div className="schedule-head">
        <input
          className="service-name-input"
          value={serviceName}
          onChange={(e) => renameService(e.target.value)}
          placeholder="Service name"
          title="Service name"
        />
        <button className="btn tiny" onClick={() => void save()} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
        <div className="menu-wrap">
          <button className="btn tiny" onClick={() => setMenu((v) => !v)} title="Service menu">
            ⋯
          </button>
          {menu && (
            <>
              <div className="dropdown-backdrop" onClick={() => setMenu(false)} />
              <div className="service-menu">
                <button className="menu-item" onClick={() => { newService(); setMenu(false) }}>
                  ✦ New service
                </button>
                <div className="menu-label">Start from a template</div>
                {SERVICE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    className="menu-item template-item"
                    onClick={() => startTemplate(t.id)}
                    title={t.description}
                  >
                    <span className="template-name">{t.name}</span>
                    <span className="template-desc">{t.description}</span>
                  </button>
                ))}
                <div className="menu-label">Open a saved service</div>
                {savedServices.length === 0 && <div className="menu-empty">None saved yet</div>}
                {savedServices.map((s) => (
                  <div
                    key={s.id}
                    className={`menu-service ${s.id === serviceId ? 'active' : ''}`}
                    onClick={() => { void openService(s.id); setMenu(false) }}
                  >
                    <span className="menu-service-name">{s.name}</span>
                    <button
                      className="menu-del"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); void deleteService(s.id) }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="schedule-list">
        {items.length === 0 && (
          <div className="empty-note">Empty service. Add items from the Library.</div>
        )}
        {items.map((it, idx) => (
          <div
            key={it.id}
            className={`sched-item ${it.id === selectedItemId ? 'active' : ''}`}
            onClick={() => selectItem(it.id)}
          >
            <span className={`sched-icon kind-${it.kind}`}>{KIND_ICON[it.kind]}</span>
            <span className="sched-title" title={it.title}>
              {it.title}
            </span>
            <span className="sched-count">{it.slides.length}</span>
            <div className="sched-actions">
              <button
                className="item-btn"
                title="Move up"
                onClick={(e) => { e.stopPropagation(); moveItem(it.id, -1) }}
                disabled={idx === 0}
              >
                ↑
              </button>
              <button
                className="item-btn"
                title="Move down"
                onClick={(e) => { e.stopPropagation(); moveItem(it.id, 1) }}
                disabled={idx === items.length - 1}
              >
                ↓
              </button>
              <button
                className="item-btn"
                title="Remove"
                onClick={(e) => { e.stopPropagation(); removeItem(it.id) }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary full add-items" onClick={onBrowse}>
        + Add items
      </button>

      {pending && (
        <ConfirmDialog
          title="Replace current service?"
          message={`This will replace your current service with the “${pending.name}” template. Any unsaved changes will be lost.`}
          confirmLabel="Yes, replace"
          cancelLabel="No, keep"
          danger
          onConfirm={() => {
            applyTemplate(pending.id)
            setPendingTemplate(null)
          }}
          onCancel={() => setPendingTemplate(null)}
        />
      )}
    </div>
  )
}
