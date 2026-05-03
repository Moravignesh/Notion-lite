import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { noteApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { WSProvider, useWS } from '../context/WebSocketContext'
import { WorkspaceProvider, useWorkspace } from '../context/WorkspaceContext'
import Navbar from '../components/Navbar'
import KanbanBoard from '../components/KanbanBoard'
import PresenceIndicator from '../components/PresenceIndicator'
import MembersPanel from '../components/MembersPanel'
import WorkspaceSettings from '../components/WorkspaceSettings'
import RoleBadge from '../components/RoleBadge'
import { ViewerBanner } from '../components/AccessDenied'
import { formatDistanceToNow } from 'date-fns'

function WorkspaceContent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { workspace, loading, error, userRole, canEdit, isOwner } = useWorkspace()
  const { activeUsers, connected, on } = useWS()

  const [notes, setNotes]             = useState([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [tab, setTab]                 = useState('notes')
  const [showMembers, setShowMembers] = useState(false)
  const [creatingNote, setCreating]   = useState(false)

  useEffect(() => {
    if (!workspace) return
    setNotesLoading(true)
    noteApi.list(id).then(r => setNotes(r.data)).finally(() => setNotesLoading(false))
  }, [id, workspace])

  useEffect(() => {
    const u1 = on('note:create', m => setNotes(p => p.find(n => n.id === m.note.id) ? p : [m.note, ...p]))
    const u2 = on('note:update', m => setNotes(p => p.map(n => n.id === m.note.id ? { ...n, ...m.note } : n)))
    const u3 = on('note:delete', m => setNotes(p => p.filter(n => n.id !== m.note_id)))
    return () => { u1(); u2(); u3() }
  }, [on])

  const createNote = async () => {
    if (!canEdit) return
    setCreating(true)
    try {
      const res = await noteApi.create({ title: 'Untitled', content: '', workspace_id: parseInt(id) })
      navigate(`/workspace/${id}/note/${res.data.id}`)
    } catch { } finally { setCreating(false) }
  }

  const deleteNote = async (e, noteId) => {
    e.stopPropagation()
    if (!canEdit || !confirm('Delete this note permanently?')) return
    try {
      await noteApi.delete(noteId)
      setNotes(p => p.filter(n => n.id !== noteId))
    } catch { }
  }

  if (loading) return <div style={s.center}><div className="spinner" /></div>
  if (error)   return <div style={s.center}><span style={{fontSize:36}}>⚠️</span><p style={{color:'var(--text-secondary)'}}>{error}</p><Link to="/" className="btn btn-secondary btn-sm">← Back</Link></div>
  if (!workspace) return null

  const navItems = [
    { id: 'notes',    label: '📄 Notes',      show: true         },
    { id: 'board',    label: '📋 Task Board',  show: true         },
    { id: 'settings', label: '⚙️ Settings',   show: isOwner      },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      {userRole === 'viewer' && <ViewerBanner />}

      <div style={s.layout}>
        {/* SIDEBAR */}
        <aside style={s.sidebar}>
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link to="/" style={s.back}>← Dashboard</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={s.wsIcon}>{workspace.name[0]?.toUpperCase()}</div>
              <div>
                <div style={s.wsName}>{workspace.name}</div>
                {userRole && <RoleBadge role={userRole} />}
              </div>
            </div>
            {workspace.description && <p style={s.wsDesc}>{workspace.description}</p>}
            <PresenceIndicator activeUsers={activeUsers} connected={connected} />
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {navItems.filter(n => n.show).map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                style={{
                  ...s.navItem,
                  background: tab === item.id ? 'var(--accent-light)' : 'transparent',
                  color:      tab === item.id ? 'var(--accent)'       : 'var(--text-secondary)',
                  fontWeight: tab === item.id ? 600 : 400,
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div style={s.sidebarFooter}>
            <button style={s.footerBtn} onClick={() => setShowMembers(true)}>
              👥 Members <span style={s.countBadge}>{workspace.members.length}</span>
            </button>
            {canEdit && (
              <button style={s.footerBtn} onClick={() => setShowMembers(true)}>
                📧 Invite People
              </button>
            )}
          </div>
        </aside>

        {/* MAIN */}
        <main style={s.main}>

          {/* ── NOTES ── */}
          {tab === 'notes' && (
            <div className="fade-in">
              <div style={s.pageHeader}>
                <div>
                  <h2 style={s.pageTitle}>📄 Notes</h2>
                  <p style={s.pageSub}>{canEdit ? 'Create and collaborate on notes' : 'Read-only — you can view and comment'}</p>
                </div>
                {canEdit && (
                  <button className="btn btn-primary btn-sm" onClick={createNote} disabled={creatingNote}>
                    {creatingNote ? '…' : '+ New Note'}
                  </button>
                )}
              </div>

              {notesLoading
                ? <div style={{textAlign:'center',padding:48}}><div className="spinner" style={{margin:'0 auto'}}/></div>
                : notes.length === 0
                ? (
                  <div style={s.empty}>
                    <span style={{fontSize:44}}>📝</span>
                    <h3 style={{fontWeight:600}}>No notes yet</h3>
                    <p style={{color:'var(--text-secondary)',fontSize:14,maxWidth:280}}>
                      {canEdit ? 'Create your first note to start collaborating.' : 'No notes have been created in this workspace yet.'}
                    </p>
                    {canEdit && <button className="btn btn-primary btn-sm" onClick={createNote}>Create Note</button>}
                  </div>
                )
                : (
                  <div style={s.grid}>
                    {notes.map(note => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        canEdit={canEdit}
                        onClick={() => navigate(`/workspace/${id}/note/${note.id}`)}
                        onDelete={e => deleteNote(e, note.id)}
                      />
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ── BOARD ── */}
          {tab === 'board' && (
            <div className="fade-in">
              <div style={s.pageHeader}>
                <div>
                  <h2 style={s.pageTitle}>📋 Task Board</h2>
                  <p style={s.pageSub}>{canEdit ? 'Manage tasks with drag-and-drop' : 'Read-only — you can view and comment on tasks'}</p>
                </div>
              </div>
              <KanbanBoard
                workspaceId={parseInt(id)}
                workspaceMembers={workspace.members}
                canEdit={canEdit}
              />
            </div>
          )}

          {/* ── SETTINGS (owner only) ── */}
          {tab === 'settings' && isOwner && (
            <div className="fade-in">
              <div style={s.pageHeader}>
                <div>
                  <h2 style={s.pageTitle}>⚙️ Workspace Settings</h2>
                  <p style={s.pageSub}>Manage name, description, and workspace deletion</p>
                </div>
              </div>
              <WorkspaceSettings />
            </div>
          )}

        </main>
      </div>

      <MembersPanel open={showMembers} onClose={() => setShowMembers(false)} />
    </div>
  )
}

function NoteCard({ note, canEdit, onClick, onDelete }) {
  const [hov, setHov] = useState(false)
  const preview = note.content?.replace(/[#*`>\-_\[\]]/g, '').slice(0, 110) || ''
  return (
    <div
      className="card"
      style={{ ...s.noteCard, boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-sm)', transform: hov ? 'translateY(-2px)' : 'none' }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 6 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{note.title || 'Untitled'}</h3>
        {canEdit && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 6px', opacity: hov ? 1 : 0, transition: 'opacity .15s', color: 'var(--danger)', flexShrink: 0 }}
            onClick={onDelete}
            title="Delete note"
          >🗑</button>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 12, minHeight: 40 }}>
        {preview ? (preview + (note.content.length > 110 ? '…' : '')) : <em style={{color:'var(--text-muted)'}}>Empty note</em>}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{note.creator?.name}</span>
        <span>·</span>
        <span>{formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}</span>
        {!canEdit && <span style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderRadius: 999, padding: '1px 6px' }}>👁 view only</span>}
      </div>
    </div>
  )
}

function WorkspaceWithWS() {
  const { id } = useParams()
  return (
    <WSProvider workspaceId={parseInt(id)}>
      <WorkspaceContent />
    </WSProvider>
  )
}

export default function WorkspacePage() {
  const { id } = useParams()
  return (
    <WorkspaceProvider workspaceId={parseInt(id)}>
      <WorkspaceWithWS />
    </WorkspaceProvider>
  )
}

const s = {
  center: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, minHeight:'100vh', background:'var(--bg-secondary)' },
  layout: { display:'flex', height:'calc(100vh - 52px)', overflow:'hidden' },
  sidebar: { width:230, flexShrink:0, background:'var(--bg-primary)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'14px 10px', overflowY:'auto' },
  back: { fontSize:12, color:'var(--text-secondary)', textDecoration:'none' },
  wsIcon: { width:36, height:36, borderRadius:8, background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, flexShrink:0 },
  wsName: { fontSize:14, fontWeight:700, marginBottom:4, color:'var(--text-primary)' },
  wsDesc: { fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 },
  navItem: { display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', border:'none', borderRadius:'var(--radius-sm)', fontSize:14, cursor:'pointer', textAlign:'left', transition:'background .15s,color .15s', fontFamily:'var(--font)' },
  sidebarFooter: { marginTop:'auto', paddingTop:10, borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:2 },
  footerBtn: { display:'flex', alignItems:'center', gap:8, padding:'7px 10px', border:'none', borderRadius:'var(--radius-sm)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer', textAlign:'left', fontFamily:'var(--font)', transition:'background .15s' },
  countBadge: { marginLeft:'auto', background:'var(--bg-tertiary)', color:'var(--text-secondary)', borderRadius:999, fontSize:11, fontWeight:600, padding:'1px 6px' },
  main: { flex:1, overflowY:'auto', padding:'28px 32px' },
  pageHeader: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, gap:12 },
  pageTitle: { fontSize:20, fontWeight:700, marginBottom:4 },
  pageSub: { fontSize:13, color:'var(--text-secondary)' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:14 },
  noteCard: { padding:16, cursor:'pointer', transition:'box-shadow .15s, transform .15s' },
  empty: { textAlign:'center', padding:'70px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 },
}
