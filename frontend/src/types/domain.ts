export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
export type RegistrationStatus = 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED'

export interface EventRecord {
  id: string
  name: string
  description: string
  starts_at: string
  ends_at: string | null
  location: string | null
  online_link: string | null
  registration_deadline: string
  capacity: number
  status: EventStatus
  created_by: string
  created_at: string
  updated_at: string
  active_registrations: number
  available_spots: number
}

export interface EventSummary {
  id: string
  name: string
  starts_at: string
  location: string | null
  online_link: string | null
}

export interface RegistrationRecord {
  id: string
  event_id: string
  participant_id: string
  status: RegistrationStatus
  registered_at: string
  cancelled_at: string | null
  updated_at: string
}

export interface RegistrationHistoryItem extends RegistrationRecord {
  event: EventSummary
}

export interface ParticipantSummary {
  id: string
  full_name: string
  email: string
}

export interface AdminRegistrationView extends RegistrationRecord {
  participant: ParticipantSummary
}

export interface ParticipantHistoryResponse {
  participant: ParticipantSummary
  registrations: RegistrationHistoryItem[]
}

export interface EventPayload {
  name: string
  description: string
  starts_at: string
  ends_at: string | null
  location: string | null
  online_link: string | null
  registration_deadline: string
  capacity: number
}
