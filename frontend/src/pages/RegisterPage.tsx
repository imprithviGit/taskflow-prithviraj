import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { register } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { setAuth } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!email.includes('@')) errs.email = 'Valid email is required'
    if (password.length < 8) errs.password = 'Minimum 8 characters'
    if (Object.keys(errs).length > 0) return setErrors(errs)

    setErrors({})
    setLoading(true)
    try {
      const data = await register(name, email, password)
      setAuth(data.user, data.token)
      navigate('/projects')
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string; fields?: Record<string, string> } } }
      if (apiErr.response?.data?.fields) {
        setErrors(apiErr.response.data.fields)
      } else {
        setErrors({ _general: apiErr.response?.data?.error ?? 'Registration failed' })
      }
    } finally {
      setLoading(false)
    }
  }

  const field = (
    label: string,
    key: string,
    type: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    autoComplete?: string,
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
          errors[key] ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
        }`}
      />
      {errors[key] && <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors[key]}</p>}
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-xl">TaskFlow</span>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
          <p className="text-slate-500 mt-1 text-sm">Get started for free, no credit card required</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {errors._general && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-5">
              {errors._general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {field('Full name', 'name', 'text', name, setName, 'Jane Smith', 'name')}
            {field('Email address', 'email', 'email', email, setEmail, 'you@example.com', 'email')}
            {field('Password', 'password', 'password', password, setPassword, 'Min. 8 characters', 'new-password')}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all shadow-sm shadow-blue-200 mt-2"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
