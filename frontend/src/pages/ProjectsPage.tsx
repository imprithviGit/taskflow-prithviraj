import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FolderKanban, Calendar, ArrowRight } from 'lucide-react'
import { getProjects, createProject } from '../lib/api'
import { Navbar } from '../components/Navbar'
import { SkeletonCard } from '../components/LoadingSpinner'
import { CreateProjectModal } from '../components/CreateProjectModal'
import { useToast } from '../contexts/ToastContext'

const ACCENT_GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-violet-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-indigo-500 to-indigo-600',
]

export function ProjectsPage() {
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      createProject(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast('Project created')
    },
    onError: () => toast('Failed to create project', 'error'),
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Projects</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {projects ? `${projects.length} project${projects.length !== 1 ? 's' : ''}` : 'Your workspace'}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-5 py-4 text-sm">
            Failed to load projects. Please refresh.
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && projects?.length === 0 && (
          <div className="text-center py-24 animate-fade-in">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No projects yet</h3>
            <p className="text-slate-400 text-sm mb-6">Create your first project to get started</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </div>
        )}

        {/* Grid */}
        {!isLoading && projects && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <button
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden text-left hover:shadow-lg hover:shadow-slate-200 hover:-translate-y-0.5 transition-all duration-200 animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Color accent bar */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${ACCENT_GRADIENTS[i % ACCENT_GRADIENTS.length]}`} />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 text-base">
                      {project.name}
                    </h2>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors group-hover:translate-x-0.5 duration-200" />
                  </div>

                  {project.description ? (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                      {project.description}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-300 italic mb-4">No description</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(project.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onSubmit={async (name, description) => {
            await createMutation.mutateAsync({ name, description })
          }}
        />
      )}
    </div>
  )
}
