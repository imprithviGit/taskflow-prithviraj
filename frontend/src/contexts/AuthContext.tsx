import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadFromStorage(): { user: User | null; token: string | null } {
  try {
    const token = localStorage.getItem('token')
    const raw = localStorage.getItem('user')
    const user = raw ? (JSON.parse(raw) as User) : null
    return { token, user }
  } catch {
    return { user: null, token: null }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ user, token }, setState] = useState(loadFromStorage)

  const setAuth = useCallback((u: User, t: string) => {
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
    setState({ user: u, token: t })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setState({ user: null, token: null })
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
