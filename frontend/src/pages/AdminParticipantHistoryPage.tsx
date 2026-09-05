import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { StatusBadge } from '../components/StatusBadge'
import { apiRequest } from '../lib/api'
import type { ParticipantHistoryResponse } from '../types/domain'

export function AdminParticipantHistoryPage() {
  const { participantId } = useParams()
  const [history, setHistory] = useState<ParticipantHistoryResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!participantId) return
    void apiRequest<ParticipantHistoryResponse>(`/api/v1/admin/participants/${participantId}/history`)
      .then(setHistory)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load participant history'))
  }, [participantId])

  return (
    <AppShell>
      <div className="page-heading">
        <p className="eyebrow">Admin · Participant history</p>
        <h1>{history?.participant.full_name ?? 'Participant history'}</h1>
        <p>{history?.participant.email}</p>
        <Link to="/admin">← Back to events</Link>
      </div>
      {error && <p className="error notice">{error}</p>}
      {!history ? <p>Loading history…</p> : history.registrations.length === 0 ? (
        <div className="empty-state"><h2>No event history</h2></div>
      ) : (
        <div className="history-list">
          {history.registrations.map((registration) => (
            <article className="history-item" key={registration.id}>
              <div><h2>{registration.event.name}</h2><p>{new Date(registration.event.starts_at).toLocaleString()}</p></div>
              <StatusBadge status={registration.status} />
            </article>
          ))}
        </div>
      )}
    </AppShell>
  )
}
