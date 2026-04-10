import { useState, useEffect } from 'react'
import { X, CheckCircle2, Clock, ListTodo, AlertCircle, Minus, ChevronUp, User } from 'lucide-react'
import type { Task, TaskPriority, TaskStatus } from '../types'
import { useAuth } from '../contexts/AuthContext'

interface TaskModalProps {
  task?: Task | null
  onClose: () => void
  onSubmit: (data: {
    title: string
    description: string
    status: TaskStatus
    priority: TaskPriority
    due_date: string
    assignee_id: string
  }) => Promise<void>
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: React.ReactNode; classes: string }[] = [
  { value: 'todo', label: 'To Do', icon: <ListTodo className="w-3.5 h-3.5" />, classes: 'bg-slate-100 text-slate-700 ring-slate-300' },
  { value: 'in_progress', label: 'In Progress', icon: <Clock className="w-3.5 h-3.5" />, classes: 'bg-blue-100 text-blue-700 ring-blue-400' },
  { value: 'done', label: 'Done', icon: <CheckCircle2 className="w-3.5 h-3.5" />, classes: 'bg-emerald-100 text-emerald-700 ring-emerald-400' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; icon: React.ReactNode; dot: string }[] = [
  { value: 'low', label: 'Low', icon: <Minus className="w-3.5 h-3.5" />, dot: 'bg-emerald-500' },
  { value: 'medium', label: 'Medium', icon: <ChevronUp className="w-3.5 h-3.5" />, dot: 'bg-amber-500' },
  { value: 'high', label: 'High', icon: <AlertCircle className="w-3.5 h-3.5" />, dot: 'bg-rose-500' },
]

export function TaskModal({ task, onClose, onSubmit }: TaskModalProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.split('T')[0] : '')
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        title: title.trim(),
        description,
        status,
        priority,
        due_date: dueDate,
        assignee_id: assigneeId,
      })
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Something went wrong'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {task ? 'Edit Task' : 'Create Task'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {task ? 'Update the task details below' : 'Fill in the details for your new task'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description
              <span className="text-slate-400 font-normal ml-1.5">optional</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more context or details…"
              rows={3}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <div className="flex flex-col gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border-2 ${
                      status === opt.value
                        ? `${opt.classes} ring-2 border-transparent`
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
              <div className="flex flex-col gap-1.5">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border-2 ${
                      priority === opt.value
                        ? 'border-transparent bg-slate-100 text-slate-800 ring-2 ring-slate-300'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Due Date & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Assignee</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  placeholder="User UUID"
                  className="flex-1 min-w-0 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {user && (
                  <button
                    type="button"
                    onClick={() => setAssigneeId(assigneeId === user.id ? '' : user.id)}
                    title={assigneeId === user.id ? 'Unassign me' : 'Assign to me'}
                    className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-all ${
                      assigneeId === user.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-500'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {assigneeId === user?.id && (
                <p className="text-xs text-blue-600 mt-1 font-medium">Assigned to you</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl disabled:opacity-50 transition-all shadow-sm shadow-blue-200"
            >
              {submitting ? 'Saving…' : task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
