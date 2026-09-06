import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { useLiveQuery } from '../lib/useLiveQuery'
import type { EventSummary } from '../types/domain'

interface Dashboard {
  participants: number; events: number; registrations: number; active_registrations: number
  attended: number; absent: number; cancelled: number; attendance_rate: number
  upcoming_events: EventSummary[]
}

export function AdminDashboardPage() {
  const { data, error, loading, reload, live } = useLiveQuery<Dashboard>('/api/v1/admin/dashboard')
  return <AppShell>
    <div className="page-heading split">
      <div><p className="eyebrow">Community overview</p><h1>Dashboard</h1><p>Participation, attendance, and what is coming next.</p></div>
      <div className="button-row"><span className="muted">{live ? 'Live updates' : 'Auto-refresh enabled'}</span><button className="button secondary" onClick={() => void reload()}>Refresh</button></div>
    </div>
    {error && <p role="alert" className="error notice">{error}</p>}
    {loading ? <p role="status">Loading overview…</p> : data && <>
      <dl className="metric-grid">
        {[['Participants', data.participants], ['Events', data.events], ['Registrations', data.registrations], ['Awaiting attendance', data.active_registrations]].map(([label, value]) =>
          <div className="metric" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="dashboard-grid">
        <section className="detail-card"><h2>Attendance outcomes</h2>
          <p className="metric-value">{data.attendance_rate}%</p>
          <p className="muted">Attendance rate among records marked Attended or Absent. Pending and cancelled records are excluded.</p>
          <dl className="details-list">
            <div><dt>Attended</dt><dd>{data.attended}</dd></div>
            <div><dt>Absent</dt><dd>{data.absent}</dd></div>
            <div><dt>Cancelled</dt><dd>{data.cancelled}</dd></div>
          </dl>
          <Link className="button secondary link-button" to="/admin/participants">View participants</Link>
        </section>
        <section className="detail-card"><h2>Upcoming events</h2>
          {data.upcoming_events.length === 0 ? <p>No upcoming published events. <Link to="/admin/events/new">Create an event</Link></p> :
            <ul className="upcoming-list">{data.upcoming_events.map(event => <li key={event.id}>
              <Link to={`/admin/events/${event.id}/registrations`}>{event.name}</Link>
              <span className="muted">{new Date(event.starts_at).toLocaleString()}</span>
              <span>{event.location || 'Online'}</span>
            </li>)}</ul>}
        </section>
      </div>
    </>}
  </AppShell>
}
