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
  Calendar,
  User,
  GripVertical,
} from 'lucide-react'
import { getProject, getTasks, createTask, updateTask, deleteTask, getProjectStats } from '../lib/api'
import type { Task, TaskStatus, TaskPriority } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Navbar } from '../components/Navbar'
import { SkeletonTask } from '../components/LoadingSpinner'
import { TaskModal } from '../components/TaskModal'

const STATUS_COLUMNS: { status: TaskStatus; label: string; icon: ReactNode; color: string; headerBg: string; dot: string }[] = [
  {
    status: 'todo',
    label: 'To Do',
    icon: <ListTodo className="w-4 h-4" />,
    color: 'text-slate-600',
    headerBg: 'bg-slate-100',
    dot: 'bg-slate-400',
  },
  {
    status: 'in_progress',
    label: 'In Progress',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-blue-600',
    headerBg: 'bg-blue-50',
    dot: 'bg-blue-500',
  },
  {
    status: 'done',
    label: 'Done',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-emerald-600',
    headerBg: 'bg-emerald-50',
    dot: 'bg-emerald-500',
  },
]

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200',
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-rose-500',
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast } = useToast()

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
    queryKey: ['tasks', id, '', assigneeFilter],
    queryFn: () =>
      getTasks(id!, {
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
      toast('Task created')
    },
    onError: () => toast('Failed to create task', 'error'),
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
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', id] })
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', id, '', assigneeFilter])
      queryClient.setQueryData<Task[]>(
        ['tasks', id, '', assigneeFilter],
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
        queryClient.setQueryData(['tasks', id, '', assigneeFilter], ctx.previousTasks)
      }
      toast('Failed to update task', 'error')
    },
    onSuccess: () => toast('Task updated'),
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
      toast('Task deleted')
    },
    onError: () => toast('Failed to delete task', 'error'),
  })

  const handleQuickStatusCycle = (task: Task) => {
    const nextStatus = STATUS_NEXT[task.status]
    updateMutation.mutate({
      taskId: task.id,
      data: {
        title: task.title,
        description: task.description ?? '',
        status: nextStatus,
        priority: task.priority,
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        assignee_id: task.assignee_id ?? '',
      },
    })
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    setDeletingId(taskId)
    try {
      await deleteMutation.mutateAsync(taskId)
    } finally {
      setDeletingId(null)
    }
  }

  const doneCount = stats?.done ?? 0
  const totalCount = stats?.total ?? 0
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="h-8 bg-slate-200 rounded-lg w-48 mb-6 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-10 bg-slate-200 rounded-xl animate-pulse" />
                {[1, 2].map((j) => <SkeletonTask key={j} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (projectError || !project) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-5 py-4 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Project not found or you don&apos;t have access.
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to projects
          </button>
        </div>
      </div>
    )
  }

  const tasksByStatus = (status: TaskStatus) =>
    (tasks ?? []).filter((t) => t.status === status)

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          All Projects
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-slate-500 mt-1 text-sm leading-relaxed max-w-xl">
                {project.description}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setEditingTask(null)
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-blue-200 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {/* Stats Card */}
        {stats && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BarChart2 className="w-4 h-4 text-slate-400" />
                Progress
              </div>
              <span className="text-sm font-bold text-slate-900">{progressPct}%</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total', value: stats.total, color: 'text-slate-900', bg: 'bg-slate-50' },
                { label: 'To Do', value: stats.todo, color: 'text-slate-600', bg: 'bg-slate-50' },
                { label: 'In Progress', value: stats.in_progress, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Done', value: stats.done, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          {user && (
            <button
              onClick={() => setAssigneeFilter(assigneeFilter === user.id ? '' : user.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                assigneeFilter === user.id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {assigneeFilter === user.id ? 'My Tasks' : 'My Tasks'}
            </button>
          )}
          {assigneeFilter && (
            <button
              onClick={() => setAssigneeFilter('')}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear filter
            </button>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            Click a status badge to cycle it forward
          </span>
        </div>

        {/* Error */}
        {tasksError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-5 py-4 text-sm flex items-center gap-2 mb-5">
            <AlertCircle className="w-4 h-4" />
            Failed to load tasks.
          </div>
        )}

        {/* Kanban Board */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = tasksByStatus(col.status)
            return (
              <div key={col.status} className="flex flex-col min-h-[400px]">
                {/* Column Header */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${col.headerBg} mb-3`}>
                  <div className={`flex items-center gap-2 font-semibold text-sm ${col.color}`}>
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    {col.icon}
                    {col.label}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 ${col.color}`}>
                    {tasksLoading ? '–' : colTasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="kanban-col flex flex-col gap-2.5 flex-1">
                  {tasksLoading ? (
                    <>
                      <SkeletonTask />
                      <SkeletonTask />
                    </>
                  ) : colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-200 rounded-xl flex-1">
                      <div className={`w-8 h-8 rounded-full ${col.headerBg} flex items-center justify-center mb-2`}>
                        <span className={col.color}>{col.icon}</span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">No {col.label.toLowerCase()} tasks</p>
                    </div>
                  ) : (
                    colTasks.map((task, i) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        userId={user?.id}
                        deleting={deletingId === task.id}
                        animDelay={i * 40}
                        onEdit={() => {
                          setEditingTask(task)
                          setShowModal(true)
                        }}
                        onDelete={() => handleDeleteTask(task.id)}
                        onStatusCycle={() => handleQuickStatusCycle(task)}
                      />
                    ))
                  )}

                  {/* Add task shortcut at bottom of each column */}
                  {!tasksLoading && (
                    <button
                      onClick={() => {
                        setEditingTask(null)
                        setShowModal(true)
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all border-2 border-transparent hover:border-slate-200 mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add task
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task
  userId?: string
  deleting: boolean
  animDelay: number
  onEdit: () => void
  onDelete: () => void
  onStatusCycle: () => void
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const STATUS_ICON: Record<TaskStatus, ReactNode> = {
  todo: <ListTodo className="w-3 h-3" />,
  in_progress: <Clock className="w-3 h-3" />,
  done: <CheckCircle2 className="w-3 h-3" />,
}

function TaskCard({ task, userId, deleting, animDelay, onEdit, onDelete, onStatusCycle }: TaskCardProps) {
  const isOverdue =
    task.due_date && task.status !== 'done'
      ? new Date(task.due_date) < new Date()
      : false

  return (
    <div
      className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md hover:shadow-slate-100 transition-all duration-200 animate-slide-up"
      style={{ animationDelay: `${animDelay}ms` }}
    >
      {/* Priority accent */}
      <div
        className={`h-0.5 w-full rounded-t-xl ${
          task.priority === 'high'
            ? 'bg-rose-400'
            : task.priority === 'medium'
            ? 'bg-amber-400'
            : 'bg-emerald-400'
        }`}
      />

      <div className="p-3.5">
        {/* Title row */}
        <div className="flex items-start gap-2 mb-2">
          <GripVertical className="w-3.5 h-3.5 text-slate-200 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3
            className={`text-sm font-medium flex-1 min-w-0 leading-snug ${
              task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'
            }`}
          >
            {task.title}
          </h3>
        </div>

        {task.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-2.5 leading-relaxed ml-5">
            {task.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-1.5 flex-wrap ml-5 mb-2.5">
          {/* Clickable status badge */}
          <button
            type="button"
            onClick={onStatusCycle}
            title="Click to advance status"
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-current cursor-pointer ${STATUS_BADGE[task.status]}`}
          >
            {STATUS_ICON[task.status]}
            {STATUS_LABEL[task.status]}
          </button>

          {/* Priority badge */}
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${PRIORITY_BADGE[task.priority]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
            {task.priority}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between ml-5">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {task.assignee_id && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {task.assignee_id === userId ? 'You' : task.assignee_id.slice(0, 6) + '…'}
              </span>
            )}
            {task.due_date && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-500 font-semibold' : ''}`}>
                <Calendar className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {isOverdue && ' (overdue)'}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
