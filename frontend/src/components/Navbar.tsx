import { Link, useNavigate } from 'react-router-dom'
import { LogOut, CheckSquare } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
        <Link to="/projects" className="flex items-center gap-2 font-bold text-lg text-blue-600">
          <CheckSquare className="w-6 h-6" />
          TaskFlow
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
