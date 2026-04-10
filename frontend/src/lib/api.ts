import axios from 'axios'
import type { AuthResponse, Project, Task, TaskPriority, TaskStatus } from '../types'

const baseURL = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// Auth
export const register = (name: string, email: string, password: string) =>
  api.post<AuthResponse>('/auth/register', { name, email, password }).then((r) => r.data)

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data)

// Projects
export const getProjects = () =>
  api.get<Project[]>('/projects').then((r) => r.data)

export const getProject = (id: string) =>
  api.get<Project>(`/projects/${id}`).then((r) => r.data)

export const createProject = (name: string, description?: string) =>
  api.post<Project>('/projects', { name, description: description || null }).then((r) => r.data)

export const updateProject = (id: string, name: string, description?: string) =>
  api.patch<Project>(`/projects/${id}`, { name, description: description || null }).then((r) => r.data)

export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`)

// Tasks
export const getTasks = (projectId: string, filters?: { status?: string; assignee?: string }) =>
  api
    .get<Task[]>(`/projects/${projectId}/tasks`, { params: filters })
    .then((r) => r.data)

export const createTask = (
  projectId: string,
  data: {
    title: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority
    assignee_id?: string
    due_date?: string
  },
) => api.post<Task>(`/projects/${projectId}/tasks`, data).then((r) => r.data)

export const updateTask = (
  taskId: string,
  data: {
    title?: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority
    assignee_id?: string
    due_date?: string
  },
) => api.patch<Task>(`/tasks/${taskId}`, data).then((r) => r.data)

export const deleteTask = (taskId: string) =>
  api.delete(`/tasks/${taskId}`)

// Stats
export const getProjectStats = (projectId: string) =>
  api.get<{
    total: number
    todo: number
    in_progress: number
    done: number
    high_priority: number
    medium_priority: number
    low_priority: number
  }>(`/projects/${projectId}/stats`).then((r) => r.data)
