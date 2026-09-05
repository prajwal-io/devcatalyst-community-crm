import { type FormEvent, useEffect, useState } from 'react'

import type { EventPayload, EventRecord } from '../types/domain'

interface EventFormProps {
  event?: EventRecord | null
  submitting: boolean
  onSubmit: (payload: EventPayload) => Promise<void>
}

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null
}

export function EventForm({ event, submitting, onSubmit }: EventFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [location, setLocation] = useState('')
  const [onlineLink, setOnlineLink] = useState('')
  const [deadline, setDeadline] = useState('')
  const [capacity, setCapacity] = useState('50')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!event) return
    setName(event.name)
    setDescription(event.description)
    setStartsAt(toLocalDateTime(event.starts_at))
    setEndsAt(toLocalDateTime(event.ends_at))
    setLocation(event.location ?? '')
    setOnlineLink(event.online_link ?? '')
    setDeadline(toLocalDateTime(event.registration_deadline))
    setCapacity(String(event.capacity))
  }, [event])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!location.trim() && !onlineLink.trim()) {
      setError('Provide either a physical location or an online link.')
      return
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: toIsoOrNull(endsAt),
        location: location.trim() || null,
        online_link: onlineLink.trim() || null,
        registration_deadline: new Date(deadline).toISOString(),
        capacity: Number(capacity),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event')
    }
  }

  return (
    <form className="form-card" onSubmit={(e) => void handleSubmit(e)}>
      {error && <p className="error notice">{error}</p>}
      <label>
        Event name
        <input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Description
        <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="form-grid two">
        <label>
          Starts at
          <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label>
          Ends at
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
      </div>
      <div className="form-grid two">
        <label>
          Physical location
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Community Hall" />
        </label>
        <label>
          Online link
          <input type="url" value={onlineLink} onChange={(e) => setOnlineLink(e.target.value)} placeholder="https://meet.example.com/..." />
        </label>
      </div>
      <div className="form-grid two">
        <label>
          Registration deadline
          <input required type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label>
          Capacity
          <input required min={1} max={100000} type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </label>
      </div>
      <button className="button" disabled={submitting} type="submit">
        {submitting ? 'Saving…' : event ? 'Save changes' : 'Create event'}
      </button>
    </form>
  )
}
