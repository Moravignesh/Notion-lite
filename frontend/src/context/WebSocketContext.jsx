import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

const WSContext = createContext(null)

export function WSProvider({ workspaceId, children }) {
  const { getToken } = useAuth()
  const wsRef = useRef(null)
  const listenersRef = useRef({})
  const reconnectTimer = useRef(null)
  const [activeUsers, setActiveUsers] = useState([])
  const [connected, setConnected] = useState(false)

  const emit = useCallback((type, data) => {
    const handlers = listenersRef.current[type] || []
    handlers.forEach(h => h(data))
  }, [])

  const on = useCallback((type, handler) => {
    if (!listenersRef.current[type]) listenersRef.current[type] = []
    listenersRef.current[type].push(handler)
    return () => {
      listenersRef.current[type] = listenersRef.current[type].filter(h => h !== handler)
    }
  }, [])

  const connect = useCallback(() => {
    if (!workspaceId) return
    const token = getToken()
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const wsUrl = `${protocol}//${host}:8000/ws/${workspaceId}?token=${token}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // Start ping interval
      ws._pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 25000)
    }

    ws.onmessage = (event) => {
      if (event.data === 'pong') return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'presence:list' || msg.type === 'presence:join' || msg.type === 'presence:leave') {
          setActiveUsers(msg.active_users || [])
        }
        emit(msg.type, msg)
      } catch (e) { /* ignore */ }
    }

    ws.onclose = () => {
      setConnected(false)
      clearInterval(ws._pingInterval)
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [workspaceId, getToken, emit])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect on unmount
        wsRef.current.close()
      }
    }
  }, [connect])

  return (
    <WSContext.Provider value={{ connected, activeUsers, on }}>
      {children}
    </WSContext.Provider>
  )
}

export const useWS = () => useContext(WSContext)
