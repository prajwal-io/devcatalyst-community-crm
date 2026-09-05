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

  async function loadProfile(nextSession: Session | null) {
    if (!nextSession) {
      setProfile(null)
      return
    }

    const currentProfile = await apiRequest<UserProfile>('/api/v1/auth/me')
    setProfile(currentProfile)
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session)
        await loadProfile(data.session)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(true)
      void loadProfile(nextSession).finally(() => setLoading(false))
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
