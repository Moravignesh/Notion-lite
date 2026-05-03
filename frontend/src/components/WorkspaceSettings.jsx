import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspaceApi } from '../services/api'
import { useWorkspace } from '../context/WorkspaceContext'
import AccessDenied from './AccessDenied'

export default function WorkspaceSettings() {
  const { workspace, reload, isOwner } = useWorkspace()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: workspace?.name || '', description: workspace?.description || '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  if (!isOwner) {
    return <AccessDenied message="Only workspace owners can access settings." />
  }

  const saveSettings = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setSaveMsg('')
    try {
      await workspaceApi.update(workspace.id, form)
      await reload()
      setSaveMsg('✅ Saved successfully')
    } catch {
      setSaveMsg('❌ Failed to save')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const deleteWorkspace = async () => {
    const confirmation = prompt(
      `Type the workspace name "${workspace.name}" to confirm deletion:`
    )
    if (confirmation !== workspace.name) {
      if (confirmation !== null) alert('Name did not match. Deletion cancelled.')
      return
    }
    setDeleting(true)
    try {
      await workspaceApi.delete(workspace.id)
      navigate('/')
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete workspace')
      setDeleting(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* General */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>⚙️ General Settings</h3>
        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Workspace Name</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Workspace name"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea
              className="input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saveMsg && <span style={{ fontSize: 13 }}>{saveMsg}</span>}
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section style={styles.dangerSection}>
        <h3 style={styles.dangerTitle}>⚠️ Danger Zone</h3>
        <div style={styles.dangerRow}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Delete this workspace</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              This will permanently delete all notes, tasks, and member data. This action cannot be undone.
            </div>
          </div>
          <button
            className="btn btn-danger btn-sm"
            onClick={deleteWorkspace}
            disabled={deleting}
            style={{ flexShrink: 0 }}
          >
            {deleting ? 'Deleting…' : '🗑 Delete Workspace'}
          </button>
        </div>
      </section>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 28 },
  section: { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionTitle: { fontSize: 15, fontWeight: 600, paddingBottom: 10, borderBottom: '1px solid var(--border)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500 },
  dangerSection: {
    border: '1px solid #fca5a5',
    borderRadius: 'var(--radius-md)',
    padding: 16,
    background: '#fff5f5',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  dangerTitle: { fontSize: 14, fontWeight: 600, color: '#dc2626' },
  dangerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
}
