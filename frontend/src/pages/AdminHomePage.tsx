import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../lib/api'

export function AdminHomePage() {
  const { profile, signOut } = useAuth()
  const [apiStatus, setApiStatus] = useState('Checking admin API authorization...')

  useEffect(() => {
    void apiRequest<{ message: string }>('/api/v1/admin/test')
      .then((response) => setApiStatus(response.message))
      .catch((error: unknown) => setApiStatus(error instanceof Error ? error.message : 'Admin check failed'))
  }, [])

  return (
    <main className="workspace">
      <section className="workspace-card">
        <p className="eyebrow">Admin workspace</p>
        <h1>Phase 1 admin access is working.</h1>
        <p>Signed in as {profile?.full_name} ({profile?.email}).</p>
        <p>{apiStatus}</p>
        <p>Event management and dashboard statistics are intentionally coming in later phases.</p>
        <button onClick={() => void signOut()}>Sign out</button>
      </section>
    </main>
  )
}
