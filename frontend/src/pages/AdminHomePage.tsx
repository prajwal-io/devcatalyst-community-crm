import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { StatusBadge } from '../components/StatusBadge'
import { apiRequest } from '../lib/api'
import type { EventRecord } from '../types/domain'

export function AdminHomePage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function loadEvents() {
    setLoading(true)
    setError('')
    try {
      setEvents(await apiRequest<EventRecord[]>('/api/v1/admin/events'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  async function togglePublication(event: EventRecord) {
    setBusyId(event.id)
    setError('')
    try {
      const action = event.status === 'PUBLISHED' ? 'unpublish' : 'publish'
      const updated = await apiRequest<EventRecord>(`/api/v1/admin/events/${event.id}/${action}`, { method: 'POST' })
      setEvents((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update event')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteEvent(event: EventRecord) {
    if (!window.confirm(`Delete “${event.name}”? Its registrations will also be removed.`)) return
    setBusyId(event.id)
    try {
      await apiRequest<void>(`/api/v1/admin/events/${event.id}`, { method: 'DELETE' })
      setEvents((current) => current.filter((item) => item.id !== event.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete event')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell>
      <div className="page-heading split">
        <div>
          <p className="eyebrow">Admin · Phase 2</p>
          <h1>Event management</h1>
          <p>Create, edit, publish, unpublish, delete, and inspect registrations.</p>
        </div>
        <Link className="button link-button" to="/admin/events/new">Create event</Link>
      </div>

      {error && <p className="error notice">{error}</p>}
      {loading ? <p>Loading events…</p> : events.length === 0 ? (
        <div className="empty-state"><h2>No events yet</h2><p>Create the first event to start the community workflow.</p></div>
      ) : (
        <div className="card-grid">
          {events.map((event) => (
            <article className="event-card" key={event.id}>
              <div className="card-heading">
                <StatusBadge status={event.status} />
                <span className="muted">{event.active_registrations}/{event.capacity} registered</span>
              </div>
              <h2>{event.name}</h2>
              <p>{event.description || 'No description provided.'}</p>
              <dl className="details-list">
                <div><dt>Starts</dt><dd>{new Date(event.starts_at).toLocaleString()}</dd></div>
                <div><dt>Deadline</dt><dd>{new Date(event.registration_deadline).toLocaleString()}</dd></div>
                <div><dt>Venue</dt><dd>{event.location ?? event.online_link ?? '—'}</dd></div>
              </dl>
              <div className="button-row wrap">
                <Link className="button secondary link-button" to={`/admin/events/${event.id}/edit`}>Edit</Link>
                <Link className="button secondary link-button" to={`/admin/events/${event.id}/registrations`}>Registrations</Link>
                <button
                  className="button"
                  disabled={busyId === event.id || event.status === 'COMPLETED' || event.status === 'CANCELLED'}
                  type="button"
                  onClick={() => void togglePublication(event)}
                >
                  {event.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                </button>
                <button className="button danger" disabled={busyId === event.id} type="button" onClick={() => void deleteEvent(event)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  )
}
