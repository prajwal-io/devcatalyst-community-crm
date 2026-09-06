import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { StatusBadge } from '../components/StatusBadge'
import { apiRequest } from '../lib/api'
import { useLiveRefresh } from '../lib/useLiveQuery'
import type { EventRecord, RegistrationHistoryItem, RegistrationRecord } from '../types/domain'

export function EventDetailsPage() {
  useLiveRefresh(() => { void load() })
  const { eventId } = useParams()
  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    if (!eventId) return
    setLoading(true)
    try {
      const [eventData, registrationData] = await Promise.all([
        apiRequest<EventRecord>(`/api/v1/events/${eventId}`),
        apiRequest<RegistrationHistoryItem[]>('/api/v1/me/registrations'),
      ])
      setEvent(eventData)
      setRegistrations(registrationData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load event')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [eventId])

  const registration = useMemo(
    () => registrations.find((item) => item.event_id === eventId),
    [registrations, eventId],
  )
  const activeRegistration = registration && registration.status !== 'CANCELLED'

  async function register() {
    if (!eventId) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await apiRequest<RegistrationRecord>(`/api/v1/events/${eventId}/register`, { method: 'POST' })
      setSuccess('Registration confirmed.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!eventId) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await apiRequest<RegistrationRecord>(`/api/v1/events/${eventId}/cancel`, { method: 'POST' })
      setSuccess('Registration cancelled.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel registration')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <div className="page-heading"><Link to="/app">← Back to events</Link></div>
      {error && <p className="error notice">{error}</p>}
      {success && <p className="success notice">{success}</p>}
      {loading ? <p>Loading event…</p> : !event ? <p>Event is unavailable.</p> : (
        <article className="detail-card">
          <div className="card-heading"><StatusBadge status={event.status} /><span className="muted">{event.available_spots} spots available</span></div>
          <h1>{event.name}</h1>
          <p className="lead">{event.description || 'No description provided.'}</p>
          <dl className="details-list large">
            <div><dt>Date and time</dt><dd>{new Date(event.starts_at).toLocaleString()}{event.ends_at ? ` – ${new Date(event.ends_at).toLocaleString()}` : ''}</dd></div>
            <div><dt>Registration deadline</dt><dd>{new Date(event.registration_deadline).toLocaleString()}</dd></div>
            <div><dt>Capacity</dt><dd>{event.active_registrations} / {event.capacity}</dd></div>
            {event.location && <div><dt>Location</dt><dd>{event.location}</dd></div>}
            {event.online_link && <div><dt>Online</dt><dd><a href={event.online_link} rel="noreferrer" target="_blank">Open event link</a></dd></div>}
          </dl>
          <div className="button-row">
            {activeRegistration ? (
              registration.status === 'REGISTERED' && <button className="button danger" disabled={busy} type="button" onClick={() => void cancel()}>Cancel registration</button>
            ) : (
              <button className="button" disabled={busy || event.available_spots <= 0 || new Date(event.registration_deadline) < new Date()} type="button" onClick={() => void register()}>
                {event.available_spots <= 0 ? 'Event full' : 'Register'}
              </button>
            )}
            {registration && <StatusBadge status={registration.status} />}
          </div>
        </article>
      )}
    </AppShell>
  )
}
