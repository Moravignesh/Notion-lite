import { useState } from 'react'
import { workspaceApi } from '../services/api'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import RoleBadge, { RoleDescription } from './RoleBadge'
import Modal from './Modal'

export default function MembersPanel({ open, onClose }) {
  const { workspace, reload, isOwner } = useWorkspace()
  const { user } = useAuth()
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'editor' })
  const [inviteResult, setInviteResult] = useState(null)
  const [inviteTab, setInviteTab] = useState('members')    // members | invite | pending
  const [pendingInvites, setPendingInvites] = useState([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [changingRole, setChangingRole] = useState(null)   // memberId
  const [removing, setRemoving] = useState(null)           // userId

  const loadPending = async () => {
    setLoadingPending(true)
    try {
      const res = await workspaceApi.listInvitations(workspace.id)
      setPendingInvites(res.data.filter(i => i.status === 'pending'))
    } catch {} finally { setLoadingPending(false) }
  }

  const handleTabChange = (tab) => {
    setInviteTab(tab)
    if (tab === 'pending') loadPending()
  }

  const sendInvite = async () => {
    if (!inviteForm.email.trim()) return
    try {
      const res = await workspaceApi.invite(workspace.id, inviteForm)
      setInviteResult(res.data)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to invite')
    }
  }

  const changeRole = async (member, newRole) => {
    if (member.user_id === user.id) return
    setChangingRole(member.id)
    try {
      await workspaceApi.updateMemberRole(workspace.id, member.id, newRole)
      await reload()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to change role')
    } finally { setChangingRole(null) }
  }

  const removeMember = async (member) => {
    if (!confirm(`Remove ${member.user.name} from this workspace?`)) return
    setRemoving(member.user_id)
    try {
      await workspaceApi.removeMember(workspace.id, member.user_id)
      await reload()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove member')
    } finally { setRemoving(null) }
  }

  if (!workspace) return null

  return (
    <Modal title="Team Members" open={open} onClose={() => { onClose(); setInviteResult(null); setInviteTab('members') }} width={520}>
      {/* Tab bar */}
      <div style={styles.tabs}>
        {[
          { id: 'members', label: `👥 Members (${workspace.members.length})` },
          { id: 'invite',  label: '📧 Invite' },
          ...(isOwner ? [{ id: 'pending', label: '⏳ Pending' }] : []),
        ].map(t => (
          <button
            key={t.id}
            className={`btn btn-sm ${inviteTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Members list */}
      {inviteTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
          {workspace.members.map(m => {
            const isSelf = m.user_id === user.id
            const isThisOwner = m.role === 'owner'
            return (
              <div key={m.id} style={styles.memberRow}>
                <div style={styles.avatar}>{m.user.name[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.memberName}>
                    {m.user.name}
                    {isSelf && <span style={styles.youBadge}>you</span>}
                  </div>
                  <div style={styles.memberEmail}>{m.user.email}</div>
                </div>

                {/* Role selector — owner only, not self, not other owners */}
                {isOwner && !isSelf && !isThisOwner ? (
                  <select
                    className="input"
                    style={styles.roleSelect}
                    value={m.role}
                    disabled={changingRole === m.id}
                    onChange={e => changeRole(m, e.target.value)}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}

                {/* Remove button — owner only, not self, not other owners */}
                {isOwner && !isSelf && !isThisOwner && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', padding: '4px 6px' }}
                    onClick={() => removeMember(m)}
                    disabled={removing === m.user_id}
                    title="Remove from workspace"
                  >
                    {removing === m.user_id ? '…' : '✕'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Invite tab */}
      {inviteTab === 'invite' && (
        !inviteResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={styles.label}>Email address</label>
              <input
                className="input"
                type="email"
                placeholder="colleague@example.com"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label style={styles.label}>Role</label>
              <select
                className="input"
                value={inviteForm.role}
                onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="editor">Editor — can create and edit content</option>
                <option value="viewer">Viewer — read-only access</option>
              </select>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <RoleDescription role={inviteForm.role} />
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={sendInvite}>Send Invitation</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={styles.successBox}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Invitation created!</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Share this token with <strong>{inviteResult.email}</strong> ({inviteResult.role}):
                </div>
              </div>
            </div>
            <div style={styles.tokenBox}>
              <code style={{ fontSize: 11, wordBreak: 'break-all', lineHeight: 1.6 }}>{inviteResult.token}</code>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              They paste this token in the "Accept Invite" dialog on their dashboard.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setInviteResult(null); setInviteForm({ email: '', role: 'editor' }) }}>
                Invite another
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => { onClose(); setInviteResult(null) }}>Done</button>
            </div>
          </div>
        )
      )}

      {/* Pending invites tab (owner only) */}
      {inviteTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
          {loadingPending && <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
          {!loadingPending && pendingInvites.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No pending invitations</p>
          )}
          {pendingInvites.map(inv => (
            <div key={inv.id} style={styles.pendingRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{inv.email}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending · {inv.role}</div>
              </div>
              <RoleBadge role={inv.role} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

const styles = {
  tabs: { display: 'flex', gap: 6, marginBottom: 16 },
  memberRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 0', borderBottom: '1px solid var(--border)',
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'var(--accent)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  memberName: { fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
  memberEmail: { fontSize: 12, color: 'var(--text-muted)' },
  youBadge: {
    fontSize: 11, padding: '1px 6px', borderRadius: 999,
    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 500,
  },
  roleSelect: { width: 100, padding: '4px 8px', fontSize: 12 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 5 },
  successBox: {
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: 'var(--radius-sm)', padding: '12px 14px',
    display: 'flex', alignItems: 'flex-start', gap: 10, color: '#166534',
  },
  tokenBox: {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '10px 14px',
  },
  pendingRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 0', borderBottom: '1px solid var(--border)',
  },
}
