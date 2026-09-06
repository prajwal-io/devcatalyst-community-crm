import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { EventForm } from '../components/EventForm'
import { apiRequest } from '../lib/api'
import type { EventPayload, EventRecord } from '../types/domain'

export function AdminEventFormPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventRecord | null>(null)
  const [loading, setLoading] = useState(Boolean(eventId))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!eventId) return
    void apiRequest<EventRecord>(`/api/v1/admin/events/${eventId}`)
      .then(setEvent)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load event'))
      .finally(() => setLoading(false))
  }, [eventId])

  async function saveEvent(payload: EventPayload) {
    setSubmitting(true)
    try {
      if (eventId) {
        await apiRequest<EventRecord>(`/api/v1/admin/events/${eventId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await apiRequest<EventRecord>('/api/v1/admin/events', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      navigate('/admin')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="page-heading">
        <p className="eyebrow">Admin · Event editor</p>
        <h1>{eventId ? 'Edit event' : 'Create event'}</h1>
        <p>New events start as drafts. Publish them from the Events page when they are ready.</p>
        <Link to="/admin">← Back to events</Link>
      </div>
      {error && <p className="error notice">{error}</p>}
      {loading ? <p>Loading event…</p> : eventId && !event ? <p>Event is unavailable. Return to events and try again.</p> : <EventForm event={event} submitting={submitting} onSubmit={saveEvent} />}
    </AppShell>
  )
}
