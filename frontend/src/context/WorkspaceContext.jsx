import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { workspaceApi } from '../services/api'
import { useAuth } from './AuthContext'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ workspaceId, children }) {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      const res = await workspaceApi.get(workspaceId)
      setWorkspace(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { reload() }, [reload])

  const userRole = workspace?.members?.find(m => m.user_id === user?.id)?.role ?? null

  // Permission helpers
  const isOwner   = userRole === 'owner'
  const isEditor  = userRole === 'editor' || isOwner
  const isViewer  = userRole === 'viewer' || isEditor   // everyone with any role can view
  const canEdit   = isEditor
  const canManage = isOwner   // rename workspace, delete workspace, manage members

  return (
    <WorkspaceContext.Provider value={{
      workspace, loading, error, reload,
      userRole, isOwner, isEditor, isViewer,
      canEdit, canManage,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}
