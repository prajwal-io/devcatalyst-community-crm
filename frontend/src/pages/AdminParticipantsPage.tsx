import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { useLiveQuery } from '../lib/useLiveQuery'
import type { ParticipantSummary } from '../types/domain'

interface ParticipantRecord extends ParticipantSummary {
  registrations: number; attended: number; absent: number; cancelled: number; active: number
}
interface ParticipantPage { items: ParticipantRecord[]; total: number; page: number; page_size: number }

export function AdminParticipantsPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [participation, setParticipation] = useState('all')
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ q: query, participation, page: String(page), page_size: '20' })
  const { data, error, loading, reload, live } = useLiveQuery<ParticipantPage>('/api/v1/admin/participants?' + params)
  function submit(event: FormEvent) { event.preventDefault(); setPage(1); setQuery(search.trim()) }
  return <AppShell>
    <div className="page-heading"><p className="eyebrow">Community CRM</p><h1>Participants</h1><p>Find community members and review their complete participation history.</p></div>
    <form className="filter-bar" onSubmit={submit}>
      <label>Search participants<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email" maxLength={160} /></label>
      <label>Participation<select value={participation} onChange={e => { setParticipation(e.target.value); setPage(1) }}>
        <option value="all">All participants</option><option value="registered">Currently registered</option><option value="attended">Has attended</option><option value="none">No registrations</option>
      </select></label>
      <button className="button" type="submit">Search</button>
      <button className="button secondary" type="button" onClick={() => void reload()}>Refresh</button>
    </form>
    <p className="muted">{live ? 'Live updates' : 'Auto-refresh enabled'}{data ? ` · ${data.total} participants` : ''}</p>
    {error && <p role="alert" className="error notice">{error}</p>}
    {loading ? <p role="status">Loading participants…</p> : data && <>
      {data.items.length === 0 ? <div className="empty-state"><h2>No participants found</h2><p>Try a different search or participation filter. New participant accounts appear here after signup.</p></div> :
        <div className="table-card" tabIndex={0} role="region" aria-label="Participants table"><table>
          <thead><tr><th scope="col">Participant</th><th scope="col">Email</th><th scope="col">Registrations</th><th scope="col">Attended</th><th scope="col">Absent</th><th scope="col">Cancelled</th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}>
            <td><Link to={`/admin/participants/${item.id}/history`}>{item.full_name}</Link></td>
            <td>{item.email}</td><td>{item.registrations}</td><td>{item.attended}</td><td>{item.absent}</td><td>{item.cancelled}</td>
          </tr>)}</tbody>
        </table></div>}
      <nav className="pagination" aria-label="Participant pages">
        <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {Math.max(1, Math.ceil(data.total / data.page_size))}</span>
        <button className="button secondary" disabled={page * data.page_size >= data.total} onClick={() => setPage(page + 1)}>Next</button>
      </nav>
    </>}
  </AppShell>
}
