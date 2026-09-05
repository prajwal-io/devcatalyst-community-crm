import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types/auth'

type ProtectedRouteProps = PropsWithChildren<{
  role?: UserRole
}>

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <main className="centered"><p>Loading your account...</p></main>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <main className="centered"><p>Your application profile could not be loaded.</p></main>
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'ADMIN' ? '/admin' : '/app'} replace />
  }

  return children
}
