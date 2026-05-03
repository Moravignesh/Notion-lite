import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { searchApi } from '../services/api'

export default function Navbar({ workspaceId }) {
  const { user, logout, theme, toggleTheme } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const handleSearch = async (e) => {
    const q = e.target.value
    setSearchQuery(q)
    if (q.trim().length < 2) { setSearchResults(null); return }
    setSearching(true)
    try {
      const res = await searchApi.search(q.trim())
      setSearchResults(res.data)
    } catch { setSearchResults(null) } finally { setSearching(false) }
  }

  return (
    <header style={styles.nav}>
      <Link to="/" style={styles.brand}>
        <span>📝</span>
        <span style={styles.brandName}>Notion Lite</span>
      </Link>

      <div style={styles.searchWrap}>
        <input
          className="input"
          style={styles.searchInput}
          placeholder="Search notes & tasks..."
          value={searchQuery}
          onChange={handleSearch}
          onFocus={() => setShowSearch(true)}
          onBlur={() => setTimeout(() => setShowSearch(false), 200)}
        />
        {showSearch && searchResults && (
          <div style={styles.dropdown} className="card">
            {searching && <p style={styles.dropdownMsg}>Searching...</p>}
            {!searching && searchResults.notes.length === 0 && searchResults.tasks.length === 0 && (
              <p style={styles.dropdownMsg}>No results found</p>
            )}
            {searchResults.notes.length > 0 && (
              <div>
                <p style={styles.dropdownSection}>Notes</p>
                {searchResults.notes.map(n => (
                  <div
                    key={n.id}
                    style={styles.dropdownItem}
                    onClick={() => { navigate(`/workspace/${n.workspace_id}/note/${n.id}`); setSearchQuery(''); setSearchResults(null) }}
                  >
                    <span>📄</span> {n.title}
                  </div>
                ))}
              </div>
            )}
            {searchResults.tasks.length > 0 && (
              <div>
                <p style={styles.dropdownSection}>Tasks</p>
                {searchResults.tasks.map(t => (
                  <div key={t.id} style={styles.dropdownItem}>
                    <span>✅</span> {t.title}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{t.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={styles.actions}>
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{user?.name}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
      </div>
    </header>
  )
}

const styles = {
  nav: {
    height: 52,
    background: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 16,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 },
  brandName: { fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' },
  searchWrap: { flex: 1, maxWidth: 400, position: 'relative' },
  searchInput: { padding: '6px 12px', fontSize: 13 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    maxHeight: 320,
    overflowY: 'auto',
    zIndex: 200,
    padding: 8,
  },
  dropdownSection: { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px', letterSpacing: '0.05em' },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  dropdownMsg: { fontSize: 13, color: 'var(--text-secondary)', padding: '8px', textAlign: 'center' },
  actions: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 8 },
  avatar: {
    width: 28, height: 28,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 600,
  },
}
