import type { PropsWithChildren } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export function AppShell({ children }: PropsWithChildren) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'ADMIN'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
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
              <NavLink to="/admin">Events</NavLink>
              <NavLink to="/admin/events/new">Create event</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/app">Events</NavLink>
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
      <main className="page-container">{children}</main>
    </div>
  )
}
