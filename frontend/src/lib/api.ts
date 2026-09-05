import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = 'Request failed'
    try {
      const body = (await response.json()) as { detail?: string }
      message = body.detail ?? message
    } catch {
      // Keep the generic message when the response is not JSON.
    }
    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
}
