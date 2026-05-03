import { useEffect } from 'react'

export default function Modal({ title, open, onClose, children, width = 460 }) {
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, onClose])

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        className="card fade-in"
        style={{ ...styles.modal, width }}
        onClick={e => e.stopPropagation()}
      >
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: { padding: 0, overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  title: { fontSize: 15, fontWeight: 600 },
  body: { padding: 20 },
}
