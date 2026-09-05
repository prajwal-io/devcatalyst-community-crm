import type { EventStatus, RegistrationStatus } from '../types/domain'

type Status = EventStatus | RegistrationStatus

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status.replace('_', ' ')}</span>
}
