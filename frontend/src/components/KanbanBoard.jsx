import { useState, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { taskApi } from '../services/api'
import { useWS } from '../context/WebSocketContext'
import TaskModal from './TaskModal'
import { formatDistanceToNow } from 'date-fns'

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       emoji: '📋', color: '#6b7280' },
  { id: 'in_progress', label: 'In Progress',  emoji: '🔄', color: '#f59e0b' },
  { id: 'done',        label: 'Done',         emoji: '✅', color: '#10b981' },
]

/* ── Sortable Task Card ──────────────────────────────────────── */
function TaskCard({ task, canEdit, isDragging, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id.toString(),
    disabled: !canEdit,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...s.taskCard, ...style, cursor: canEdit ? 'grab' : 'default' }}
      {...(canEdit ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
    >
      <div style={s.taskTitle}>{task.title}</div>
      {task.description && (
        <div style={s.taskDesc}>
          {task.description.slice(0, 90)}{task.description.length > 90 ? '…' : ''}
        </div>
      )}
      <div style={s.taskFooter}>
        {task.assignee ? (
          <span style={s.assignee}>
            <span style={s.assigneeAvatar}>{task.assignee.name[0].toUpperCase()}</span>
            {task.assignee.name}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unassigned</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {formatDistanceToNow(new Date(task.updated_at || task.created_at), { addSuffix: true })}
        </span>
      </div>
      {!canEdit && (
        <div style={s.viewOnlyTag}>👁 view only</div>
      )}
    </div>
  )
}

/* ── Main Board ─────────────────────────────────────────────── */
export default function KanbanBoard({ workspaceId, workspaceMembers, canEdit }) {
  const [tasks, setTasks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeTask, setActiveTask] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTask, setEditing]   = useState(null)
  const [createStatus, setCreateStatus] = useState('todo')
  const { on } = useWS()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  /* ── load ────────────────────────────────────── */
  useEffect(() => {
    taskApi.getBoard(workspaceId)
      .then(res => setTasks(res.data.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workspaceId])

  /* ── real-time ───────────────────────────────── */
  useEffect(() => {
    const u1 = on('task:create', m => setTasks(p => p.find(t => t.id === m.task.id) ? p : [...p, m.task]))
    const u2 = on('task:update', m => setTasks(p => p.map(t => t.id === m.task.id ? m.task : t)))
    const u3 = on('task:delete', m => setTasks(p => p.filter(t => t.id !== m.task_id)))
    return () => { u1(); u2(); u3() }
  }, [on])

  const getColTasks = id =>
    tasks.filter(t => t.status === id).sort((a, b) => a.position - b.position)

  /* ── drag & drop ─────────────────────────────── */
  const handleDragStart = e => {
    setActiveTask(tasks.find(t => t.id.toString() === e.active.id) || null)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null)
    if (!over || !canEdit) return

    const taskId = parseInt(active.id)
    const task   = tasks.find(t => t.id === taskId)
    if (!task) return

    let targetStatus = task.status
    if (COLUMNS.find(c => c.id === over.id)) {
      targetStatus = over.id
    } else {
      const overTask = tasks.find(t => t.id.toString() === over.id)
      if (overTask) targetStatus = overTask.status
    }

    const col = getColTasks(targetStatus).filter(t => t.id !== taskId)
    const overTask = tasks.find(t => t.id.toString() === over.id)
    let position = 1000

    if (col.length === 0) {
      position = 1000
    } else if (overTask && overTask.status === targetStatus) {
      const idx  = col.findIndex(t => t.id === overTask.id)
      const prev = col[idx - 1]
      const next = col[idx]
      if (!prev)       position = (next?.position || 1000) / 2
      else if (!next)  position = (prev?.position || 0) + 1000
      else             position = ((prev?.position || 0) + (next?.position || 0)) / 2
    } else {
      position = (col[col.length - 1]?.position || 0) + 1000
    }

    setTasks(p => p.map(t => t.id === taskId ? { ...t, status: targetStatus, position } : t))
    try {
      await taskApi.move(taskId, { status: targetStatus, position })
    } catch {
      taskApi.getBoard(workspaceId).then(r => setTasks(r.data.tasks || []))
    }
  }

  /* ── CRUD ────────────────────────────────────── */
  const handleCreate = async data => {
    try {
      await taskApi.create(workspaceId, { ...data, status: createStatus })
      setShowCreate(false)
    } catch {}
  }

  const handleUpdate = async (taskId, data) => {
    try {
      await taskApi.update(taskId, data)
      setEditing(null)
    } catch {}
  }

  const handleDelete = async taskId => {
    if (!confirm('Delete this task permanently?')) return
    try {
      await taskApi.delete(taskId)
      setEditing(null)
    } catch {}
  }

  /* ── render ──────────────────────────────────── */
  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div className="spinner" style={{ margin: '0 auto' }} />
    </div>
  )

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={s.columns}>
          {COLUMNS.map(col => {
            const colTasks = getColTasks(col.id)
            return (
              <div key={col.id} style={s.column}>
                <div style={s.colHeader}>
                  <span style={{ ...s.colDot, background: col.color }} />
                  <span style={s.colLabel}>{col.emoji} {col.label}</span>
                  <span style={s.colCount}>{colTasks.length}</span>
                  {/* Quick-add button per column — editor/owner only */}
                  {canEdit && (
                    <button
                      style={s.addBtn}
                      onClick={() => { setCreateStatus(col.id); setShowCreate(true) }}
                      title={`Add task to ${col.label}`}
                    >
                      +
                    </button>
                  )}
                </div>

                <SortableContext
                  items={colTasks.map(t => t.id.toString())}
                  strategy={verticalListSortingStrategy}
                >
                  <div style={s.colBody} id={col.id}>
                    {colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        canEdit={canEdit}
                        isDragging={activeTask?.id === task.id}
                        onClick={() => setEditing(task)}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div style={s.emptyCol}>
                        {canEdit ? 'Drop tasks here or click +' : 'No tasks'}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div style={{ ...s.taskCard, boxShadow: 'var(--shadow-lg)', transform: 'rotate(2deg)', opacity: 0.95 }}>
              <div style={s.taskTitle}>{activeTask.title}</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Create Task Modal */}
      {showCreate && (
        <TaskModal
          mode="create"
          defaultStatus={createStatus}
          members={workspaceMembers}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit/View Task Modal */}
      {editingTask && (
        <TaskModal
          mode={canEdit ? 'edit' : 'view'}
          task={editingTask}
          members={workspaceMembers}
          canEdit={canEdit}
          onSubmit={d => handleUpdate(editingTask.id, d)}
          onDelete={() => handleDelete(editingTask.id)}
          onClose={() => setEditing(null)}
          workspaceId={workspaceId}
        />
      )}
    </div>
  )
}

const s = {
  columns: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  column: { background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 12, minHeight: 200 },
  colHeader: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 },
  colDot:    { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  colLabel:  { fontWeight: 600, fontSize: 14, flex: 1 },
  colCount:  { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '1px 7px' },
  addBtn: {
    width: 24, height: 24, border: 'none', borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700, lineHeight: 1,
    transition: 'background .15s',
  },
  colBody: { display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 },
  taskCard: {
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '10px 12px',
    boxShadow: 'var(--shadow-sm)', transition: 'box-shadow .15s',
    userSelect: 'none',
  },
  taskTitle:   { fontSize: 14, fontWeight: 500, marginBottom: 4, color: 'var(--text-primary)', lineHeight: 1.4 },
  taskDesc:    { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 },
  taskFooter:  { display: 'flex', alignItems: 'center', gap: 6 },
  assignee:    { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' },
  assigneeAvatar: {
    width: 18, height: 18, borderRadius: '50%',
    background: 'var(--accent)', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, fontWeight: 700,
  },
  viewOnlyTag: { marginTop: 6, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' },
  emptyCol:    { textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0', fontStyle: 'italic' },
}
