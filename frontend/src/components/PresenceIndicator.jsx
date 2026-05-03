export default function PresenceIndicator({ activeUsers, connected }) {
  return (
    <div style={styles.wrap}>
      <span style={{ ...styles.dot, background: connected ? 'var(--success)' : 'var(--text-muted)' }} title={connected ? 'Connected' : 'Reconnecting...'} />
      <div style={styles.avatars}>
        {activeUsers.slice(0, 5).map(u => (
          <div key={u.id} style={styles.avatar} title={`${u.name} (${u.role})`}>
            {u.name?.[0]?.toUpperCase()}
          </div>
        ))}
        {activeUsers.length > 5 && (
          <div style={{ ...styles.avatar, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 11 }}>
            +{activeUsers.length - 5}
          </div>
        )}
      </div>
      {activeUsers.length > 0 && (
        <span style={styles.label}>{activeUsers.length} online</span>
      )}
    </div>
  )
}

const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']

const styles = {
  wrap: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  avatars: { display: 'flex', gap: -4 },
  avatar: {
    width: 26, height: 26,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 600,
    border: '2px solid var(--bg-primary)',
    marginLeft: -4,
  },
  label: { fontSize: 12, color: 'var(--text-secondary)' },
}
