import { Link } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { useLiveQuery } from '../lib/useLiveQuery'
import type { EventRecord } from '../types/domain'

export function ParticipantHomePage() {
  const { data, loading, error, reload } = useLiveQuery<EventRecord[]>('/api/v1/events')
  const events = data ?? []

  return (
    <AppShell>
      <div className="page-heading">
        <p className="eyebrow">Community events</p>
        <h1>Available events</h1>
        <p>Discover published workshops, programs, and community events.</p>
      </div>
      {error && <p role="alert" className="error notice">{error} <button className="button secondary small" onClick={() => void reload()}>Retry</button></p>}
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
