import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { apiRequest } from '../lib/api'
import type { EventRecord } from '../types/domain'

export function ParticipantHomePage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void apiRequest<EventRecord[]>('/api/v1/events')
      .then(setEvents)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load events'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="page-heading">
        <p className="eyebrow">Participant · Phase 3</p>
        <h1>Available events</h1>
        <p>Discover published workshops, programs, and community events.</p>
      </div>
      {error && <p className="error notice">{error}</p>}
      {loading ? <p>Loading events…</p> : events.length === 0 ? (
        <div className="empty-state"><h2>No events are open right now</h2><p>Published events will appear here.</p></div>
      ) : (
        <div className="card-grid">
          {events.map((event) => (
            <article className="event-card" key={event.id}>
              <div className="card-heading"><span className="role-pill">{event.available_spots} spots left</span></div>
              <h2>{event.name}</h2>
              <p>{event.description || 'No description provided.'}</p>
              <dl className="details-list">
                <div><dt>Starts</dt><dd>{new Date(event.starts_at).toLocaleString()}</dd></div>
                <div><dt>Register by</dt><dd>{new Date(event.registration_deadline).toLocaleString()}</dd></div>
                <div><dt>Venue</dt><dd>{event.location ?? (event.online_link ? 'Online' : '—')}</dd></div>
              </dl>
              <Link className="button link-button" to={`/app/events/${event.id}`}>View event</Link>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  )
}
