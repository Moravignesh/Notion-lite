import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { noteApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { WSProvider, useWS } from '../context/WebSocketContext'
import { WorkspaceProvider, useWorkspace } from '../context/WorkspaceContext'
import Navbar from '../components/Navbar'
import PresenceIndicator from '../components/PresenceIndicator'
import RoleBadge from '../components/RoleBadge'
import { formatDistanceToNow } from 'date-fns'

const SAVE_DELAY = 1200

/* ── helpers ──────────────────────────────────────────────────── */
function StatusDot({ status }) {
  const cfg = {
    saved:   { color: 'var(--success)', label: '✓ Saved' },
    saving:  { color: 'var(--warning)', label: '⏳ Saving…' },
    unsaved: { color: 'var(--danger)',  label: '● Unsaved' },
  }[status]
  return (
    <span style={{ fontSize: 12, color: cfg.color, fontWeight: 500, minWidth: 80 }}>
      {cfg.label}
    </span>
  )
}

/* ── main component ───────────────────────────────────────────── */
function NoteEditorContent() {
  const { id: workspaceId, noteId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { userRole, canEdit } = useWorkspace()
  const { activeUsers, connected, on } = useWS()

  const [note, setNote]           = useState(null)
  const [title, setTitle]         = useState('')
  const [content, setContent]     = useState('')
  const [loading, setLoading]     = useState(true)
  const [saveStatus, setSave]     = useState('saved')
  const [viewMode, setViewMode]   = useState('edit')   // edit | split | preview
  const [showVersions, setShowV]  = useState(false)
  const [showComments, setShowC]  = useState(false)
  const [versions, setVersions]   = useState([])
  const [comments, setComments]   = useState([])
  const [newComment, setNewCmt]   = useState('')
  const [remoteBanner, setRemote] = useState(null)
  const [restoringV, setRestoring] = useState(null)

  const saveTimer = useRef(null)
  const lastSaved = useRef({ title: '', content: '' })

  /* ── load note ─────────────────────────────────── */
  useEffect(() => {
    noteApi.get(noteId)
      .then(res => {
        setNote(res.data)
        setTitle(res.data.title)
        setContent(res.data.content || '')
        setVersions(res.data.versions || [])
        lastSaved.current = { title: res.data.title, content: res.data.content || '' }
        // Viewers default to preview
        if (!canEdit) setViewMode('preview')
      })
      .catch(() => navigate(`/workspace/${workspaceId}`))
      .finally(() => setLoading(false))

    noteApi.getComments(noteId).then(r => setComments(r.data)).catch(() => {})
  }, [noteId, workspaceId, navigate, canEdit])

  /* ── real-time events ──────────────────────────── */
  useEffect(() => {
    const u1 = on('note:update', msg => {
      if (msg.note.id !== parseInt(noteId)) return
      setRemote(`Note updated by another collaborator`)
      if (saveStatus === 'saved') {
        setTitle(msg.note.title)
        setContent(msg.note.content || '')
        lastSaved.current = { title: msg.note.title, content: msg.note.content || '' }
      }
      setTimeout(() => setRemote(null), 5000)
    })
    const u2 = on('comment:new', msg => {
      if (msg.comment.note_id !== parseInt(noteId)) return
      setComments(p => p.find(c => c.id === msg.comment.id) ? p : [...p, msg.comment])
    })
    return () => { u1(); u2() }
  }, [on, noteId, saveStatus])

  /* ── auto-save ─────────────────────────────────── */
  const doSave = useCallback(async (t, c) => {
    if (t === lastSaved.current.title && c === lastSaved.current.content) return
    setSave('saving')
    try {
      const res = await noteApi.update(noteId, { title: t, content: c })
      lastSaved.current = { title: t, content: c }
      setVersions(res.data.versions || [])
      setSave('saved')
    } catch { setSave('unsaved') }
  }, [noteId])

  const scheduleAutoSave = useCallback((t, c) => {
    if (!canEdit) return
    setSave('unsaved')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(t, c), SAVE_DELAY)
  }, [doSave, canEdit])

  const handleTitleChange = e => {
    setTitle(e.target.value)
    scheduleAutoSave(e.target.value, content)
  }

  const handleContentChange = e => {
    setContent(e.target.value)
    scheduleAutoSave(title, e.target.value)
  }

  const manualSave = () => {
    clearTimeout(saveTimer.current)
    doSave(title, content)
  }

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  /* ── restore version ───────────────────────────── */
  const restoreVersion = async v => {
    if (!canEdit) return
    if (!confirm(`Restore to version ${v.version_number}? Current content will be saved as a new version.`)) return
    setRestoring(v.id)
    setTitle(v.title)
    setContent(v.content || '')
    scheduleAutoSave(v.title, v.content || '')
    setShowV(false)
    setRestoring(null)
  }

  /* ── add comment ───────────────────────────────── */
  const addComment = async () => {
    if (!newComment.trim()) return
    try {
      const res = await noteApi.addComment(noteId, { content: newComment })
      setComments(p => [...p, res.data])
      setNewCmt('')
    } catch {}
  }

  /* ── render ────────────────────────────────────── */
  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' }}>
      <div className="spinner" />
    </div>
  )

  const viewerModeOptions = canEdit
    ? ['edit', 'split', 'preview']
    : ['preview']

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary)', display:'flex', flexDirection:'column' }}>
      <Navbar />

      {/* Toolbar */}
      <div style={s.toolbar}>
        <Link to={`/workspace/${workspaceId}`} style={{ ...s.backLink }}>← Back</Link>

        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {/* Mode switcher — only relevant modes by role */}
          {viewerModeOptions.map(m => (
            <button
              key={m}
              className={`btn btn-sm ${viewMode === m ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode(m)}
              style={{ textTransform:'capitalize' }}
            >
              {m === 'edit' ? '✏️ Edit' : m === 'split' ? '⬜ Split' : '👁 Preview'}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto', flexWrap:'wrap' }}>
          <PresenceIndicator activeUsers={activeUsers} connected={connected} />

          {/* Role badge in toolbar */}
          {userRole && <RoleBadge role={userRole} />}

          {/* Save status — only for editors */}
          {canEdit && <StatusDot status={saveStatus} />}

          <button
            className={`btn btn-ghost btn-sm ${showVersions ? 'btn-secondary' : ''}`}
            onClick={() => { setShowV(v => !v); setShowC(false) }}
          >
            🕐 History ({versions.length})
          </button>
          <button
            className={`btn btn-ghost btn-sm ${showComments ? 'btn-secondary' : ''}`}
            onClick={() => { setShowC(v => !v); setShowV(false) }}
          >
            💬 Comments ({comments.length})
          </button>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={manualSave} disabled={saveStatus === 'saving'}>
              Save
            </button>
          )}
        </div>
      </div>

      {/* Concurrent-edit banner */}
      {remoteBanner && (
        <div style={s.remoteBanner}>
          🔄 {remoteBanner}
          {saveStatus !== 'saved' && ' — your unsaved changes are preserved.'}
        </div>
      )}

      {/* Viewer read-only notice */}
      {!canEdit && (
        <div style={s.viewerNotice}>
          👁 <strong>Read-only mode.</strong> You can view this note and add comments, but cannot edit the content.
          {' '}Contact a workspace owner or editor to request write access.
        </div>
      )}

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Version History Panel */}
        {showVersions && (
          <aside style={s.panel}>
            <h3 style={s.panelTitle}>🕐 Version History</h3>
            <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
              {versions.length === 0 && <p style={s.panelEmpty}>No versions saved yet</p>}
              {versions.map((v, i) => (
                <div key={v.id} style={{ ...s.versionCard, border: i === 0 ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--accent)' }}>v{v.version_number}</span>
                    {i === 0 && <span style={s.currentTag}>latest</span>}
                  </div>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)', marginBottom:2 }}>
                    {v.title || 'Untitled'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{v.creator?.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom: canEdit ? 8 : 0 }}>
                    {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                  </div>
                  {canEdit && i !== 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width:'100%', justifyContent:'center' }}
                      onClick={() => restoreVersion(v)}
                      disabled={restoringV === v.id}
                    >
                      {restoringV === v.id ? 'Restoring…' : 'Restore'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Editor / Preview */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <input
            style={{
              ...s.titleInput,
              cursor: canEdit ? 'text' : 'default',
              opacity: canEdit ? 1 : 0.85,
            }}
            value={title}
            onChange={handleTitleChange}
            placeholder="Note title…"
            readOnly={!canEdit}
          />
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
            {(viewMode === 'edit' || viewMode === 'split') && (
              <textarea
                style={{
                  ...s.editor,
                  flex:1,
                  borderRight: viewMode === 'split' ? '1px solid var(--border)' : 'none',
                  background: canEdit ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                  cursor: canEdit ? 'text' : 'not-allowed',
                }}
                value={content}
                onChange={handleContentChange}
                placeholder={canEdit ? 'Start writing… Markdown is supported ✨' : ''}
                readOnly={!canEdit}
                spellCheck={canEdit}
              />
            )}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div style={{ ...s.preview, flex:1 }} className="markdown-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || '*No content yet.*'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Comments Panel */}
        {showComments && (
          <aside style={s.panel}>
            <h3 style={s.panelTitle}>💬 Comments</h3>
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
              {comments.length === 0 && <p style={s.panelEmpty}>No comments yet. Be the first!</p>}
              {comments.map(c => (
                <div key={c.id} style={s.comment}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                    <div style={s.cmtAvatar}>{c.user.name[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{c.user.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize:13, lineHeight:1.55, color:'var(--text-primary)' }}>{c.content}</p>
                </div>
              ))}
            </div>
            {/* All roles can comment */}
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
              <textarea
                className="input"
                rows={3}
                style={{ resize:'none', fontSize:13 }}
                placeholder="Add a comment…"
                value={newComment}
                onChange={e => setNewCmt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addComment() }}
              />
              <button className="btn btn-primary btn-sm" onClick={addComment} disabled={!newComment.trim()}>
                Post Comment
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

/* ── Wrappers (provide context) ───────────────────────────────── */
function NoteEditorWithWS() {
  const { id } = useParams()
  return (
    <WSProvider workspaceId={parseInt(id)}>
      <NoteEditorContent />
    </WSProvider>
  )
}

export default function NoteEditor() {
  const { id } = useParams()
  return (
    <WorkspaceProvider workspaceId={parseInt(id)}>
      <NoteEditorWithWS />
    </WorkspaceProvider>
  )
}

/* ── Styles ───────────────────────────────────────────────────── */
const s = {
  toolbar: {
    display:'flex', alignItems:'center', gap:8,
    padding:'8px 16px', borderBottom:'1px solid var(--border)',
    background:'var(--bg-primary)', flexWrap:'wrap',
    position:'sticky', top:0, zIndex:10,
  },
  backLink: { fontSize:13, color:'var(--text-secondary)', textDecoration:'none', whiteSpace:'nowrap' },

  remoteBanner: {
    background:'#fef3c7', color:'#92400e',
    padding:'8px 20px', fontSize:13, textAlign:'center',
    borderBottom:'1px solid #fde68a',
  },
  viewerNotice: {
    background:'var(--accent-light)', color:'var(--accent)',
    padding:'9px 20px', fontSize:13,
    borderBottom:'1px solid var(--border)',
  },

  panel: {
    width:256, flexShrink:0,
    borderLeft:'1px solid var(--border)',
    background:'var(--bg-secondary)',
    padding:16, display:'flex', flexDirection:'column', gap:10, overflowY:'auto',
  },
  panelTitle: { fontSize:14, fontWeight:600, flexShrink:0 },
  panelEmpty: { fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'16px 0' },

  versionCard: {
    background:'var(--bg-primary)',
    borderRadius:'var(--radius-sm)',
    padding:'10px 12px',
  },
  currentTag: {
    fontSize:10, fontWeight:700, textTransform:'uppercase',
    background:'var(--accent)', color:'#fff',
    borderRadius:999, padding:'1px 6px',
  },

  titleInput: {
    width:'100%', padding:'16px 24px',
    fontSize:26, fontWeight:700,
    border:'none', outline:'none',
    background:'var(--bg-primary)', color:'var(--text-primary)',
    borderBottom:'1px solid var(--border)',
    fontFamily:'var(--font)',
  },
  editor: {
    padding:'20px 24px', fontSize:15, lineHeight:1.8,
    border:'none', outline:'none', resize:'none',
    color:'var(--text-primary)',
    fontFamily:"'SF Mono','Fira Code',monospace",
  },
  preview: {
    padding:'20px 28px', overflowY:'auto',
    background:'var(--bg-primary)', color:'var(--text-primary)',
    fontSize:15, lineHeight:1.8,
  },
  comment: {
    background:'var(--bg-primary)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-sm)', padding:'10px 12px',
  },
  cmtAvatar: {
    width:26, height:26, borderRadius:'50%',
    background:'var(--accent)', color:'#fff',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:11, fontWeight:700, flexShrink:0,
  },
}
