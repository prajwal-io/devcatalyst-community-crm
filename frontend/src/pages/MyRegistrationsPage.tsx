import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { StatusBadge } from '../components/StatusBadge'
import { apiRequest } from '../lib/api'
import type { RegistrationHistoryItem, RegistrationRecord } from '../types/domain'

export function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRegistrations(await apiRequest<RegistrationHistoryItem[]>('/api/v1/me/registrations'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load registration history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function cancel(item: RegistrationHistoryItem) {
    setBusyId(item.id)
    setError('')
    try {
      await apiRequest<RegistrationRecord>(`/api/v1/events/${item.event_id}/cancel`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel registration')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell>
      <div className="page-heading">
        <p className="eyebrow">Participant · Phase 5</p>
        <h1>My event history</h1>
        <p>Every registration and attendance outcome is kept here, including cancellations.</p>
      </div>
      {error && <p className="error notice">{error}</p>}
      {loading ? <p>Loading history…</p> : registrations.length === 0 ? (
        <div className="empty-state"><h2>No registrations yet</h2><Link to="/app">Browse events</Link></div>
      ) : (
        <div className="history-list">
          {registrations.map((item) => (
            <article className="history-item" key={item.id}>
              <div>
                <h2><Link to={`/app/events/${item.event.id}`}>{item.event.name}</Link></h2>
                <p>{new Date(item.event.starts_at).toLocaleString()}</p>
                <p className="muted">Registered {new Date(item.registered_at).toLocaleString()}</p>
              </div>
              <div className="history-actions">
                <StatusBadge status={item.status} />
                {item.status === 'REGISTERED' && (
                  <button className="button danger small" disabled={busyId === item.id} type="button" onClick={() => void cancel(item)}>Cancel</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  )
}
