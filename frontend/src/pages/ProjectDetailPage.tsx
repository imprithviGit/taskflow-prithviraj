import { useState, type ReactNode } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ListTodo,
  BarChart2,
} from 'lucide-react'
import { getProject, getTasks, createTask, updateTask, deleteTask, getProjectStats } from '../lib/api'
import type { Task, TaskStatus, TaskPriority } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { Navbar } from '../components/Navbar'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { TaskModal } from '../components/TaskModal'

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

const STATUS_ICONS: Record<TaskStatus, ReactNode> = {
  todo: <ListTodo className="w-3.5 h-3.5" />,
  in_progress: <Clock className="w-3.5 h-3.5" />,
  done: <CheckCircle2 className="w-3.5 h-3.5" />,
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-red-50 text-red-700 border-red-200',
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [statusFilter, setStatusFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
  } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  })

  const {
    data: tasks,
    isLoading: tasksLoading,
    isError: tasksError,
  } = useQuery({
    queryKey: ['tasks', id, statusFilter, assigneeFilter],
    queryFn: () =>
      getTasks(id!, {
        status: statusFilter || undefined,
        assignee: assigneeFilter || undefined,
      }),
    enabled: !!id,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', id],
    queryFn: () => getProjectStats(id!),
    enabled: !!id,
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string
      description: string
      status: TaskStatus
      priority: TaskPriority
      due_date: string
      assignee_id: string
    }) =>
      createTask(id!, {
        title: data.title,
        description: data.description || undefined,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || undefined,
        assignee_id: data.assignee_id || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['stats', id] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string
      data: {
        title: string
        description: string
        status: TaskStatus
        priority: TaskPriority
        due_date: string
        assignee_id: string
      }
    }) =>
      updateTask(taskId, {
        title: data.title,
        description: data.description || undefined,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || undefined,
        assignee_id: data.assignee_id || undefined,
      }),
    // Optimistic update: reflect changes in the UI immediately
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', id] })
      const previousTasks = queryClient.getQueryData<Task[]>([
        'tasks', id, statusFilter, assigneeFilter,
      ])
      queryClient.setQueryData<Task[]>(
        ['tasks', id, statusFilter, assigneeFilter],
        (old) =>
          old?.map((t) =>
            t.id === taskId
              ? { ...t, title: data.title, status: data.status, priority: data.priority }
              : t,
          ) ?? [],
      )
      return { previousTasks }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousTasks) {
        queryClient.setQueryData(['tasks', id, statusFilter, assigneeFilter], ctx.previousTasks)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['stats', id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['stats', id] })
    },
  })

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    setDeletingId(taskId)
    try {
      await deleteMutation.mutateAsync(taskId)
    } finally {
      setDeletingId(null)
    }
  }

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <LoadingSpinner />
      </div>
    )
  }

  if (projectError || !project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Project not found or you don&apos;t have access.
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="mt-4 text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back to projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/projects"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            All Projects
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-gray-500 mt-1 text-sm">{project.description}</p>
              )}
            </div>
            <button
              onClick={() => {
                setEditingTask(null)
                setShowModal(true)
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-3">
              <BarChart2 className="w-4 h-4" />
              Project Stats
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-500 mt-0.5">Total</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-500">{stats.todo}</div>
                <div className="text-xs text-gray-500 mt-0.5">To Do</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
                <div className="text-xs text-blue-500 mt-0.5">In Progress</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600">{stats.done}</div>
                <div className="text-xs text-green-500 mt-0.5">Done</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 font-medium">Status:</span>
            {(['', 'todo', 'in_progress', 'done'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'
                }`}
              >
                {s === '' ? 'All' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {user && (
            <button
              onClick={() =>
                setAssigneeFilter(assigneeFilter === user.id ? '' : user.id)
              }
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                assigneeFilter === user.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-indigo-400'
              }`}
            >
              {assigneeFilter === user.id ? 'Assigned to me ✓' : 'Assigned to me'}
            </button>
          )}
        </div>

        {/* Tasks */}
        {tasksLoading && <LoadingSpinner message="Loading tasks..." />}

        {tasksError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Failed to load tasks.
          </div>
        )}

        {!tasksLoading && !tasksError && tasks?.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {statusFilter || assigneeFilter ? 'No tasks match your filters' : 'No tasks yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {statusFilter || assigneeFilter
                ? 'Try adjusting your filters'
                : 'Add your first task to get started'}
            </p>
          </div>
        )}

        {!tasksLoading && tasks && tasks.length > 0 && (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{task.title}</h3>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}
                      >
                        {STATUS_ICONS[task.status]}
                        {STATUS_LABELS[task.status]}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                      {task.assignee_id && (
                        <span>
                          Assignee:{' '}
                          {task.assignee_id === user?.id
                            ? 'You'
                            : task.assignee_id.slice(0, 8) + '…'}
                        </span>
                      )}
                      {task.due_date && (
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingTask(task)
                        setShowModal(true)
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit task"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      disabled={deletingId === task.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <TaskModal
          task={editingTask}
          onClose={() => {
            setShowModal(false)
            setEditingTask(null)
          }}
          onSubmit={async (data) => {
            if (editingTask) {
              await updateMutation.mutateAsync({ taskId: editingTask.id, data })
            } else {
              await createMutation.mutateAsync(data)
            }
          }}
        />
      )}
    </div>
  )
}
