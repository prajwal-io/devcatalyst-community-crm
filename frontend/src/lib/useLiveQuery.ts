import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { apiRequest } from './api'
import { supabase } from './supabase'

/** Changes invalidate REST data; database payloads never become trusted UI state. */
export function useLiveRefresh(refresh: () => void) {
  const latest = useRef(refresh)
  latest.current = refresh
  const id = useId()
  const [live, setLive] = useState(false)
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { if (active) latest.current() }, 200)
    }
    const channel = supabase.channel('crm-' + id)
    for (const table of ['events', 'registrations', 'profiles']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
    }
    channel.subscribe((status) => {
      if (!active) return
      setLive(status === 'SUBSCRIBED')
      if (status === 'SUBSCRIBED') schedule()
    })
    // Covers reconnects, deletes, and rows that become invisible under RLS.
    const interval = setInterval(schedule, 30000)
    const onFocus = () => { if (!document.hidden) schedule() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      active = false
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      void supabase.removeChannel(channel)
    }
  }, [id])
  return live
}

export function useLiveQuery<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const request = useRef<AbortController | null>(null)
  const reload = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const result = await apiRequest<T>(path, { signal: controller.signal })
      if (!controller.signal.aborted) {
        setData(result)
        setError('')
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load data')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [path])
  useEffect(() => {
    setData(null)
    setLoading(true)
    void reload()
    return () => request.current?.abort()
  }, [reload])
  const live = useLiveRefresh(() => { void reload() })
  return { data, error, loading, reload, live }
}
