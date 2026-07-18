import { Fragment, useEffect, useState } from 'react'
import { useStore, suppressedOn } from '../../store/useStore'
import { SERVICE_TEMPLATES } from '../templates'
import { ConfirmDialog } from './ConfirmDialog'
import { BroadcastToggle } from './BroadcastToggle'
import { Icon, type IconName } from '../../shared/Icon'
import type { ItemKind } from '@shared/types'

const KIND_ICON: Record<ItemKind, IconName> = {
  scripture: 'cross',
  song: 'music',
  text: 'type',
  media: 'image',
  video: 'play',
  ppt: 'slides',
  blank: 'square',
  countdown: 'timer'
}

export function SchedulePanel({ onBrowse }: { onBrowse: () => void }): JSX.Element {
  const items = useStore((s) => s.items)
  const selectedItemId = useStore((s) => s.selectedItemId)
  const selectItem = useStore((s) => s.selectItem)
  const moveItem = useStore((s) => s.moveItem)
  const reorderItems = useStore((s) => s.reorderItems)
  const removeItem = useStore((s) => s.removeItem)
  const setInsertAt = useStore((s) => s.setInsertAt)

  /** Arm the insertion point and jump to the Library to pick what goes there. */
  const insertHere = (index: number | null): void => {
    setInsertAt(index)
    onBrowse()
  }

  const serviceName = useStore((s) => s.serviceName)
  const serviceId = useStore((s) => s.serviceId)
  const background = useStore((s) => s.background)
  const theme = useStore((s) => s.theme)
  const renameService = useStore((s) => s.renameService)
  const autoSaveStatus = useStore((s) => s.autoSaveStatus)
  const newService = useStore((s) => s.newService)
  const applyTemplate = useStore((s) => s.applyTemplate)
  const savedServices = useStore((s) => s.savedServices)
  const openService = useStore((s) => s.openService)
  const deleteService = useStore((s) => s.deleteService)
  const exportServiceJson = useStore((s) => s.exportServiceJson)
  const importServiceJson = useStore((s) => s.importServiceJson)

  const [menu, setMenu] = useState(false)
  /** PowerPoint export status shown inline in the header */
  const [exp, setExp] = useState<{
    phase: 'idle' | 'running' | 'done' | 'error'
    done: number
    total: number
    msg?: string
  }>({ phase: 'idle', done: 0, total: 0 })
  /** template id awaiting a replace-confirmation (null = no dialog open) */
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)

  // Live progress from the main-process exporter.
  useEffect(
    () =>
      window.lumen.onPptxProgress(({ done, total }) =>
        setExp((e) => (e.phase === 'running' ? { ...e, done, total } : e))
      ),
    []
  )
  // Auto-clear a finished/failed message after a few seconds.
  useEffect(() => {
    if (exp.phase !== 'done' && exp.phase !== 'error') return
    const t = setTimeout(() => setExp({ phase: 'idle', done: 0, total: 0 }), 4500)
    return () => clearTimeout(t)
  }, [exp.phase])

  // Export/import the whole deck as portable JSON (reuse the header status line).
  const doExportJson = async (): Promise<void> => {
    setMenu(false)
    if (!items.length) return
    const res = await exportServiceJson()
    if (res.ok) setExp({ phase: 'done', done: 0, total: 0, msg: 'Service exported' })
    else if (!res.canceled) setExp({ phase: 'error', done: 0, total: 0, msg: res.error || 'Export failed' })
  }
  const doImportJson = async (): Promise<void> => {
    setMenu(false)
    const res = await importServiceJson()
    if (res.ok) setExp({ phase: 'done', done: 0, total: 0, msg: 'Service imported' })
    else if (!res.canceled) setExp({ phase: 'error', done: 0, total: 0, msg: res.error || 'Import failed' })
  }

  const exportPptx = async (): Promise<void> => {
    if (!items.length || exp.phase === 'running') return
    setExp({ phase: 'running', done: 0, total: 0 })
    try {
      const res = await window.lumen.exportPptx({ name: serviceName, items, background, theme })
      if (res.ok) {
        setExp({ phase: 'done', done: res.count ?? 0, total: res.count ?? 0, msg: `Exported ${res.count} slides` })
      } else if (res.canceled) {
        setExp({ phase: 'idle', done: 0, total: 0 })
      } else {
        setExp({ phase: 'error', done: 0, total: 0, msg: res.error || 'Export failed' })
      }
    } catch (e) {
      setExp({ phase: 'error', done: 0, total: 0, msg: e instanceof Error ? e.message : 'Export failed' })
    }
  }
  /** drag-and-drop reorder state (indices into `items`) */
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const endDrag = (): void => {
    setDragIndex(null)
    setOverIndex(null)
  }
  const dropOn = (idx: number): void => {
    if (dragIndex !== null && dragIndex !== idx) reorderItems(dragIndex, idx)
    endDrag()
  }

  // Replacing the current setlist with a template shouldn't silently discard
  // unsaved work — confirm first when there's something in the schedule.
  const startTemplate = (id: string): void => {
    setMenu(false)
    if (items.length) setPendingTemplate(id)
    else applyTemplate(id)
  }

  const pending = pendingTemplate ? SERVICE_TEMPLATES.find((t) => t.id === pendingTemplate) : null

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
        {exp.phase === 'idle' ? (
          <span className={`autosave-status ${autoSaveStatus}`} title="Changes save automatically">
            {autoSaveStatus === 'saving' ? 'Saving…' : autoSaveStatus === 'saved' ? 'Saved' : 'Auto-save'}
          </span>
        ) : (
          <span className={`export-status ${exp.phase}`} title={exp.msg}>
            {exp.phase === 'running'
              ? `Exporting ${exp.done}/${exp.total || '…'}`
              : exp.msg}
          </span>
        )}
        <button
          className="btn tiny icon-btn"
          onClick={exportPptx}
          disabled={!items.length || exp.phase === 'running'}
          title="Export session to PowerPoint (.pptx)"
        >
          <Icon name="download" />
        </button>
        <div className="menu-wrap">
          <button className="btn tiny icon-btn" onClick={() => setMenu((v) => !v)} title="Service menu">
            <Icon name="dots" />
          </button>
          {menu && (
            <>
              <div className="dropdown-backdrop" onClick={() => setMenu(false)} />
              <div className="service-menu">
                <button className="menu-item" onClick={() => { newService(); setMenu(false) }}>
                  <span className="mi-row"><Icon name="spark" /> New service</span>
                </button>
                <button className="menu-item" onClick={() => void doImportJson()}>
                  <span className="mi-row"><Icon name="upload" /> Import service (JSON)…</span>
                </button>
                <button className="menu-item" onClick={() => void doExportJson()} disabled={!items.length}>
                  <span className="mi-row"><Icon name="download" /> Export service (JSON)…</span>
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
                      <Icon name="close" />
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
        {items.map((it, idx) => {
          const offAir = suppressedOn(it, 'users') && suppressedOn(it, 'stream')
          return (
          <Fragment key={it.id}>
          <button className="sched-insert" onClick={() => insertHere(idx)} title="Insert an item here">
            <span className="sched-insert-plus"><Icon name="plus" /></span>
          </button>
          <div
            className={`sched-item ${it.id === selectedItemId ? 'active' : ''} ${offAir ? 'no-broadcast' : ''} ${dragIndex === idx ? 'dragging' : ''} ${overIndex === idx && dragIndex !== null && dragIndex !== idx ? 'drop-target' : ''}`}
            onClick={() => selectItem(it.id)}
            draggable
            onDragStart={(e) => { setDragIndex(idx); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIndex !== idx) setOverIndex(idx) }}
            onDrop={(e) => { e.preventDefault(); dropOn(idx) }}
            onDragEnd={endDrag}
          >
            <span className="sched-grip" title="Drag to reorder">
              <Icon name="grip" />
            </span>
            <span className={`sched-icon kind-${it.kind}`}>
              <Icon name={KIND_ICON[it.kind]} />
            </span>
            <span className="sched-title" title={it.title}>
              {it.title}
            </span>
            <BroadcastToggle item={it} />
            <span className="sched-count">{it.slides.length}</span>
            <div className="sched-actions">
              <button
                className="item-btn"
                title="Move up"
                onClick={(e) => { e.stopPropagation(); moveItem(it.id, -1) }}
                disabled={idx === 0}
              >
                <Icon name="chevron-up" />
              </button>
              <button
                className="item-btn"
                title="Move down"
                onClick={(e) => { e.stopPropagation(); moveItem(it.id, 1) }}
                disabled={idx === items.length - 1}
              >
                <Icon name="chevron-down" />
              </button>
              <button
                className="item-btn"
                title="Remove"
                onClick={(e) => { e.stopPropagation(); removeItem(it.id) }}
              >
                <Icon name="close" />
              </button>
            </div>
          </div>
          </Fragment>
          )
        })}
        {items.length > 0 && (
          <button className="sched-insert" onClick={() => insertHere(items.length)} title="Insert an item at the end">
            <span className="sched-insert-plus"><Icon name="plus" /></span>
          </button>
        )}
      </div>

      <button className="btn btn-primary full add-items" onClick={() => insertHere(null)}>
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
