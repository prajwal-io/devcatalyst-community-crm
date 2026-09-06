import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { apiRequest } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types/auth'

interface SignUpResult {
  needsEmailConfirmation: boolean
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (fullName: string, email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let revision = 0

    async function loadSession(nextSession: Session | null) {
      const request = ++revision
      setSession(nextSession)
      setProfile(null)
      setLoading(true)
      try {
        if (nextSession) {
          // Use the event's token; calling getSession inside the auth callback
          // can wait on the same Supabase auth lock.
          const result = await apiRequest<UserProfile>('/api/v1/auth/me', {}, nextSession.access_token)
          if (mounted && request === revision) setProfile(result)
        }
      } catch {
        if (mounted && request === revision) setProfile(null)
      } finally {
        if (mounted && request === revision) setLoading(false)
      }
    }

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (mounted && revision === 0) void loadSession(data.session)
      })
      .catch(() => { if (mounted && revision === 0) setLoading(false) })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) void loadSession(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(fullName: string, email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (error) throw error
    return { needsEmailConfirmation: data.session === null }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [session, profile, loading],
  )

  if (!loading && session && !profile) {
    return (
      <main className="centered">
        <div>
          <p>Your account profile could not be loaded. Check that the API is available.</p>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </main>
    )
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
