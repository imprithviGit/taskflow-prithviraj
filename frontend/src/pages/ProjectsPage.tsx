import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FolderOpen, Calendar } from 'lucide-react'
import { getProjects, createProject } from '../lib/api'
import { Navbar } from '../components/Navbar'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { CreateProjectModal } from '../components/CreateProjectModal'

export function ProjectsPage() {
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: projects, isLoading, isError, error } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      createProject(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {isLoading && <LoadingSpinner />}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            Failed to load projects:{' '}
            {(error as { message?: string })?.message ?? 'Unknown error'}
          </div>
        )}

        {!isLoading && !isError && projects?.length === 0 && (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No projects yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first project to get started</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Create Project
            </button>
          </div>
        )}

        {!isLoading && projects && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {project.name}
                  </h2>
                  <FolderOpen className="w-5 h-5 text-gray-400 flex-shrink-0 group-hover:text-blue-400" />
                </div>
                {project.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-auto">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(project.created_at).toLocaleDateString()}
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
