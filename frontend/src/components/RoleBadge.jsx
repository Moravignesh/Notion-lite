const CONFIG = {
  owner:  { label: '👑 Owner',  bg: '#fef3c7', color: '#92400e', darkBg: '#451a03', darkColor: '#fbbf24' },
  editor: { label: '✏️ Editor', bg: '#dbeafe', color: '#1e40af', darkBg: '#1e3a5f', darkColor: '#60a5fa' },
  viewer: { label: '👁 Viewer', bg: '#f3f4f6', color: '#4b5563', darkBg: '#374151', darkColor: '#9ca3af' },
}

export default function RoleBadge({ role, size = 'sm' }) {
  const cfg = CONFIG[role] || CONFIG.viewer
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 999,
      fontSize: size === 'sm' ? 12 : 13,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

export function RoleDescription({ role }) {
  const descriptions = {
    owner:  'Full control — manage members, settings, and all content',
    editor: 'Can create, edit, and delete notes & tasks',
    viewer: 'Read-only access — can view content and add comments',
  }
  return (
    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
      {descriptions[role] || ''}
    </span>
  )
}
