import { useState, useEffect } from 'react'
import Modal from './Modal'
import RoleBadge from './RoleBadge'
import { taskApi } from '../services/api'
import { formatDistanceToNow } from 'date-fns'

const STATUS_OPTIONS = [
  { value: 'todo',        label: '📋 To Do' },
  { value: 'in_progress', label: '🔄 In Progress' },
  { value: 'done',        label: '✅ Done' },
]

export default function TaskModal({
  mode,           // 'create' | 'edit' | 'view'
  task,
  defaultStatus = 'todo',
  members = [],
  canEdit = true,
  onSubmit,
  onDelete,
  onClose,
  workspaceId,
}) {
  const readOnly = mode === 'view'

  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    status:      task?.status      || defaultStatus,
    assigned_to: task?.assigned_to ?? '',
  })
  const [tab, setTab]         = useState('details')
  const [comments, setComments] = useState([])
  const [newCmt, setNewCmt]   = useState('')
  const [submitting, setSub]  = useState(false)
  const [cmtLoading, setCmtL] = useState(false)

  /* load comments */
  useEffect(() => {
    if (task?.id) {
      setCmtL(true)
      taskApi.getComments(task.id).then(r => setComments(r.data)).catch(() => {}).finally(() => setCmtL(false))
    }
  }, [task?.id])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.title.trim() || readOnly) return
    setSub(true)
    try {
      await onSubmit({
        ...form,
        assigned_to: form.assigned_to !== '' ? parseInt(form.assigned_to) : null,
      })
    } finally { setSub(false) }
  }

  const addComment = async () => {
    if (!newCmt.trim() || !task?.id) return
    try {
      const res = await taskApi.addComment(task.id, { content: newCmt })
      setComments(p => [...p, res.data])
      setNewCmt('')
    } catch {}
  }

  const titleMap = { create: '+ New Task', edit: 'Edit Task', view: 'Task Details' }

  return (
    <Modal title={titleMap[mode]} open={true} onClose={onClose} width={520}>

      {/* Tab bar */}
      <div style={styles.tabs}>
        <button className={`btn btn-sm ${tab === 'details' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('details')}>
          Details
        </button>
        {task?.id && (
          <button className={`btn btn-sm ${tab === 'comments' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('comments')}>
            💬 Comments {comments.length > 0 && `(${comments.length})`}
          </button>
        )}
        {readOnly && (
          <span style={styles.viewOnlyBadge}>👁 View Only</span>
        )}
      </div>

      {/* DETAILS TAB */}
      {tab === 'details' && (
        <form onSubmit={handleSubmit}>
          <div style={styles.form}>

            <div style={styles.field}>
              <label style={styles.label}>Title {!readOnly && <span style={styles.req}>*</span>}</label>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
                required={!readOnly}
                readOnly={readOnly}
                autoFocus={!readOnly}
                style={{ background: readOnly ? 'var(--bg-secondary)' : undefined }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Description</label>
              <textarea
                className="input"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={readOnly ? '—' : 'Optional description…'}
                rows={3}
                style={{ resize: 'vertical', background: readOnly ? 'var(--bg-secondary)' : undefined }}
                readOnly={readOnly}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ ...styles.field, flex: 1 }}>
                <label style={styles.label}>Status</label>
                {readOnly ? (
                  <div style={styles.readonlyVal}>{STATUS_OPTIONS.find(o => o.value === form.status)?.label}</div>
                ) : (
                  <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </div>

              <div style={{ ...styles.field, flex: 1 }}>
                <label style={styles.label}>Assigned To</label>
                {readOnly ? (
                  <div style={styles.readonlyVal}>
                    {task?.assignee?.name || <em style={{ color: 'var(--text-muted)' }}>Unassigned</em>}
                  </div>
                ) : (
                  <select
                    className="input"
                    value={form.assigned_to}
                    onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user.name} ({m.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Meta info for view/edit modes */}
            {task && (
              <div style={styles.meta}>
                <span>Created by <strong>{task.creator?.name}</strong></span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
              {!readOnly && mode === 'edit' && onDelete && (
                <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
                  🗑 Delete Task
                </button>
              )}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                  {readOnly ? 'Close' : 'Cancel'}
                </button>
                {!readOnly && (
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                    {submitting ? 'Saving…' : mode === 'create' ? 'Create Task' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* COMMENTS TAB */}
      {tab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* All roles can comment */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>
            💡 All workspace members can add comments regardless of role.
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cmtLoading && <div style={{ textAlign: 'center', padding: 16 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
            {!cmtLoading && comments.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No comments yet. Be the first!
              </p>
            )}
            {comments.map(c => (
              <div key={c.id} style={styles.comment}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={styles.cmtAvatar}>{c.user.name[0].toUpperCase()}</div>
                  <strong style={{ fontSize: 13 }}>{c.user.name}</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>{c.content}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={newCmt}
              onChange={e => setNewCmt(e.target.value)}
              placeholder="Write a comment…"
              onKeyDown={e => e.key === 'Enter' && addComment()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={addComment} disabled={!newCmt.trim()}>
              Post
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const styles = {
  tabs: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 },
  viewOnlyBadge: {
    marginLeft: 'auto', fontSize: 12, fontWeight: 500,
    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
    borderRadius: 999, padding: '3px 10px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' },
  req: { color: 'var(--danger)' },
  readonlyVal: {
    padding: '9px 12px', background: 'var(--bg-secondary)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    fontSize: 14, color: 'var(--text-primary)',
  },
  meta: { fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' },
  comment: {
    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
  },
  cmtAvatar: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'var(--accent)', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700,
  },
}
