import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspaceApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import RoleBadge from '../components/RoleBadge'

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAccept, setShowAccept] = useState(false)
  const [form, setForm]             = useState({ name: '', description: '' })
  const [inviteToken, setToken]     = useState('')
  const [creating, setCreating]     = useState(false)
  const [acceptErr, setAcceptErr]   = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    workspaceApi.list().then(res => setWorkspaces(res.data)).finally(() => setLoading(false))
  }, [])

  const createWorkspace = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const res = await workspaceApi.create(form)
      setWorkspaces(prev => [...prev, res.data])
      setShowCreate(false)
      setForm({ name: '', description: '' })
    } catch { } finally { setCreating(false) }
  }

  const acceptInvite = async () => {
    if (!inviteToken.trim()) return
    setAcceptErr('')
    try {
      const res = await workspaceApi.acceptInvite(inviteToken.trim())
      setWorkspaces(prev => prev.find(w => w.id === res.data.id) ? prev : [...prev, res.data])
      setShowAccept(false)
      setToken('')
    } catch (err) {
      setAcceptErr(err.response?.data?.detail || 'Invalid or expired token')
    }
  }

  const getRoleInWorkspace = (ws) =>
    ws.members?.find(m => m.user_id === user?.id)?.role

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      <Navbar />
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.heading}>My Workspaces</h1>
            <p style={s.subheading}>Collaborate in real time across all your spaces</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowAccept(true); setAcceptErr('') }}>
              🔗 Accept Invite
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + New Workspace
            </button>
          </div>
        </div>

        {/* Role legend */}
        <div style={s.legend}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>Your roles:</span>
          <RoleBadge role="owner"  /> <span style={s.legendText}>Full control</span>
          <RoleBadge role="editor" /> <span style={s.legendText}>Can create & edit</span>
          <RoleBadge role="viewer" /> <span style={s.legendText}>Read-only</span>
        </div>

        {/* Workspace grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : workspaces.length === 0 ? (
          <div style={s.empty}>
            <span style={{ fontSize: 52 }}>🗂️</span>
            <h3 style={{ fontWeight: 600 }}>No workspaces yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Create one or accept an invitation to join an existing workspace.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Workspace</button>
              <button className="btn btn-secondary" onClick={() => setShowAccept(true)}>Accept Invite</button>
            </div>
          </div>
        ) : (
          <div style={s.grid}>
            {workspaces.map(ws => {
              const role = getRoleInWorkspace(ws)
              return (
                <div
                  key={ws.id}
                  className="card"
                  style={s.wsCard}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                >
                  <div style={s.wsTop}>
                    <div style={s.wsIcon}>{ws.name[0]?.toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.wsName}>{ws.name}</div>
                      {ws.description && <div style={s.wsDesc}>{ws.description}</div>}
                    </div>
                  </div>

                  <div style={s.wsMeta}>
                    {role && <RoleBadge role={role} />}
                    <span style={s.wsMembers}>
                      👥 {ws.members?.length || 0} member{ws.members?.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Role-specific hint */}
                  <div style={s.wsHint}>
                    {role === 'owner'  && '⚡ Full access — manage everything'}
                    {role === 'editor' && '✏️ Editor — create and edit content'}
                    {role === 'viewer' && '👁 Viewer — read-only access'}
                  </div>

                  <div style={s.wsArrow}>Open →</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal title="Create Workspace" open={showCreate} onClose={() => { setShowCreate(false); setForm({ name: '', description: '' }) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={s.label}>Workspace Name *</label>
            <input
              className="input"
              placeholder="e.g. Product Team, Personal Projects"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && createWorkspace()}
            />
          </div>
          <div>
            <label style={s.label}>Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
            <textarea
              className="input"
              placeholder="What is this workspace for?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            You'll be the <strong>Owner</strong> of this workspace with full control over members and settings.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={createWorkspace} disabled={creating || !form.name.trim()}>
              {creating ? 'Creating…' : 'Create Workspace'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Accept Invite Modal */}
      <Modal title="Accept Invitation" open={showAccept} onClose={() => { setShowAccept(false); setToken(''); setAcceptErr('') }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Paste the invitation token shared by your workspace owner:
          </p>
          <input
            className="input"
            placeholder="Paste invitation token here…"
            value={inviteToken}
            onChange={e => setToken(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && acceptInvite()}
          />
          {acceptErr && (
            <div style={{ fontSize: 13, color: 'var(--danger)', background: '#fee2e2', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
              ❌ {acceptErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAccept(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={acceptInvite} disabled={!inviteToken.trim()}>
              Accept & Join
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const s = {
  container: { maxWidth: 960, margin: '0 auto', padding: '32px 20px' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  subheading: { color: 'var(--text-secondary)', fontSize: 14 },
  legend: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24, padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' },
  legendText: { fontSize: 12, color: 'var(--text-secondary)', marginRight: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 },
  wsCard: { padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow .15s, transform .1s' },
  wsTop: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  wsIcon: { width: 42, height: 42, borderRadius: 10, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 },
  wsName: { fontSize: 15, fontWeight: 600, marginBottom: 2, color: 'var(--text-primary)' },
  wsDesc: { fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  wsMeta: { display: 'flex', alignItems: 'center', gap: 10 },
  wsMembers: { fontSize: 12, color: 'var(--text-muted)' },
  wsHint: { fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' },
  wsArrow: { fontSize: 13, color: 'var(--accent)', fontWeight: 500, marginTop: 2 },
  empty: { textAlign: 'center', padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 5 },
}
