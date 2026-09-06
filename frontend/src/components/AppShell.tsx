import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export function AppShell({ children }: PropsWithChildren) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'ADMIN'
  const [error, setError] = useState('')

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign out')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to={isAdmin ? '/admin' : '/app'}>
          DevCatalyst Community CRM
        </NavLink>
        <nav className="nav-links" aria-label="Primary navigation">
          {isAdmin ? (
            <>
              <NavLink to="/admin/dashboard">Dashboard</NavLink>
              <NavLink to="/admin" end>Events</NavLink>
              <NavLink to="/admin/participants">Participants</NavLink>
              <NavLink to="/admin/events/new">Create event</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/app" end>Events</NavLink>
              <NavLink to="/app/registrations">My registrations</NavLink>
            </>
          )}
        </nav>
        <div className="topbar-user">
          <span>{profile?.full_name}</span>
          <span className="role-pill">{profile?.role}</span>
          <button className="button secondary small" type="button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="page-container">{error && <p role="alert" className="error notice">{error}</p>}{children}</main>
    </div>
  )
}
