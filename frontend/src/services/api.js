import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.patch('/auth/me', data),
}

export const workspaceApi = {
  list: () => api.get('/workspaces'),
  get: (id) => api.get(`/workspaces/${id}`),
  create: (data) => api.post('/workspaces', data),
  update: (id, data) => api.patch(`/workspaces/${id}`, data),
  delete: (id) => api.delete(`/workspaces/${id}`),
  invite: (id, data) => api.post(`/workspaces/${id}/invite`, data),
  listInvitations: (id) => api.get(`/workspaces/${id}/invitations`),
  acceptInvite: (token) => api.post('/workspaces/invitations/accept', { token }),
  updateMemberRole: (wsId, memberId, role) => api.patch(`/workspaces/${wsId}/members/${memberId}`, { role }),
  removeMember: (wsId, userId) => api.delete(`/workspaces/${wsId}/members/${userId}`),
}

export const noteApi = {
  list: (workspaceId) => api.get(`/notes/workspace/${workspaceId}`),
  get: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.patch(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
  getVersions: (id) => api.get(`/notes/${id}/versions`),
  addComment: (id, data) => api.post(`/notes/${id}/comments`, data),
  getComments: (id) => api.get(`/notes/${id}/comments`),
}

export const taskApi = {
  getBoard: (workspaceId) => api.get(`/tasks/workspace/${workspaceId}/board`),
  create: (workspaceId, data) => api.post(`/tasks/workspace/${workspaceId}`, data),
  update: (id, data) => api.patch(`/tasks/${id}`, data),
  move: (id, data) => api.patch(`/tasks/${id}/move`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  addComment: (id, data) => api.post(`/tasks/${id}/comments`, data),
  getComments: (id) => api.get(`/tasks/${id}/comments`),
}

export const searchApi = {
  search: (q) => api.get('/search', { params: { q } }),
}

export default api
