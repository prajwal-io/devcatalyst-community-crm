import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../components/AppShell'
import { StatusBadge } from '../components/StatusBadge'
import { useLiveQuery } from '../lib/useLiveQuery'
import type { ParticipantHistoryResponse } from '../types/domain'

export function AdminParticipantHistoryPage() {
  const { participantId } = useParams()
  const { data: history, error, loading, reload } = useLiveQuery<ParticipantHistoryResponse>(`/api/v1/admin/participants/${participantId}/history`)

  return (
    <AppShell>
      <div className="page-heading">
        <p className="eyebrow">Admin · Participant history</p>
        <h1>{history?.participant.full_name ?? 'Participant history'}</h1>
        <p>{history?.participant.email}</p>
        <Link to="/admin/participants">← Back to participants</Link>
      </div>
      {error && <p role="alert" className="error notice">{error} <button className="button secondary small" onClick={() => void reload()}>Retry</button></p>}
      {loading ? <p>Loading history…</p> : !history ? null : history.registrations.length === 0 ? (
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
