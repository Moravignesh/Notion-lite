export default function AccessDenied({ message = 'You do not have permission to perform this action.' }) {
  return (
    <div style={styles.wrap}>
      <span style={{ fontSize: 36 }}>🔒</span>
      <h3 style={styles.title}>Access Restricted</h3>
      <p style={styles.msg}>{message}</p>
    </div>
  )
}

export function ViewerBanner() {
  return (
    <div style={styles.banner}>
      👁 <strong>Viewer mode</strong> — you can read and comment but cannot edit content.
      Contact a workspace owner to request edit access.
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '60px 20px', textAlign: 'center',
  },
  title: { fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' },
  msg: { fontSize: 14, color: 'var(--text-secondary)', maxWidth: 320 },
  banner: {
    background: 'var(--accent-light)',
    color: 'var(--accent)',
    borderBottom: '1px solid var(--border)',
    padding: '9px 20px',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
}
