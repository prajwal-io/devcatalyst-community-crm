import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { StatusBadge } from '../components/StatusBadge'
import { apiRequest } from '../lib/api'
import type { AdminRegistrationView, EventRecord, RegistrationRecord, RegistrationStatus } from '../types/domain'

const attendanceStatuses: RegistrationStatus[] = ['REGISTERED', 'ATTENDED', 'ABSENT', 'CANCELLED']

export function AdminEventRegistrationsPage() {
  const { eventId } = useParams()
  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<AdminRegistrationView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    if (!eventId) return
    setLoading(true)
    try {
      const [eventData, registrationData] = await Promise.all([
        apiRequest<EventRecord>(`/api/v1/admin/events/${eventId}`),
        apiRequest<AdminRegistrationView[]>(`/api/v1/admin/events/${eventId}/registrations`),
      ])
      setEvent(eventData)
      setRegistrations(registrationData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load registrations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [eventId])

  async function changeStatus(registrationId: string, status: RegistrationStatus) {
    setBusyId(registrationId)
    setError('')
    try {
      const updated = await apiRequest<RegistrationRecord>(`/api/v1/admin/registrations/${registrationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setRegistrations((current) => current.map((item) => (
        item.id === registrationId ? { ...item, ...updated, participant: item.participant } : item
      )))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update attendance')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell>
      <div className="page-heading">
        <p className="eyebrow">Admin · Phase 5</p>
        <h1>{event?.name ?? 'Event registrations'}</h1>
        <p>Review registrations and record attendance outcomes.</p>
        <Link to="/admin">← Back to events</Link>
      </div>
      {error && <p className="error notice">{error}</p>}
      {loading ? <p>Loading registrations…</p> : registrations.length === 0 ? (
        <div className="empty-state"><h2>No registrations yet</h2><p>Participants will appear here after registering.</p></div>
      ) : (
        <div className="table-card">
          <table>
            <thead><tr><th>Participant</th><th>Email</th><th>Registered</th><th>Status</th><th>Attendance action</th></tr></thead>
            <tbody>
              {registrations.map((registration) => (
                <tr key={registration.id}>
                  <td><Link to={`/admin/participants/${registration.participant.id}/history`}>{registration.participant.full_name}</Link></td>
                  <td>{registration.participant.email}</td>
                  <td>{new Date(registration.registered_at).toLocaleString()}</td>
                  <td><StatusBadge status={registration.status} /></td>
                  <td>
                    <select
                      disabled={busyId === registration.id}
                      value={registration.status}
                      onChange={(e) => void changeStatus(registration.id, e.target.value as RegistrationStatus)}
                    >
                      {attendanceStatuses.map((status) => <option value={status} key={status}>{status}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
