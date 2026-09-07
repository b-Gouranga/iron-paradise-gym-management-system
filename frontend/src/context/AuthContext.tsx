import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../services/database/supabaseClient'
import type { AuthState, ProfileState, UserProfile } from '../types/auth'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthState | undefined>(undefined)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient()

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileState, setProfileState] = useState<ProfileState>('idle')
  const [loading, setLoading] = useState(true)   // true until initial auth resolved
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Load profile for an authenticated user
  // ---------------------------------------------------------------------------
  const loadProfile = useCallback(
    async (userId: string) => {
      setProfileState('loading')
      setProfile(null)

      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          // No row returned — profile is missing
          setProfileState('missing')
          setProfile(null)
        } else {
          setProfileState('error')
          setProfile(null)
          console.error('[AuthContext] profile query error', queryError)
        }
        return
      }

      if (!data) {
        setProfileState('missing')
        return
      }

      const row = data as unknown as UserProfile

      if (row.role !== 'owner' && row.role !== 'trainer') {
        setProfileState('invalid_role')
        setProfile(null)
        return
      }

      setProfile(row)
      setProfileState('loaded')
    },
    [supabase],
  )


  // ---------------------------------------------------------------------------
  // Bootstrap: restore session on first mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true

    // getSession() resolves immediately from storage — no network round-trip.
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!mounted) return

      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      if (currentSession?.user) {
        await loadProfile(currentSession.user.id)
      } else {
        setProfileState('idle')
      }

      setLoading(false)
    })

    // Listen for subsequent auth state changes (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return

        setSession(newSession)
        setUser(newSession?.user ?? null)
        setError(null)

        if (newSession?.user) {
          await loadProfile(newSession.user.id)
        } else {
          setProfile(null)
          setProfileState('idle')
        }

        // After the initial bootstrap, subsequent auth changes resolve loading immediately.
        setLoading(false)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, loadProfile])

  // ---------------------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------------------

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null)
      setLoading(true)

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setLoading(false)
        // Map Supabase error messages to user-friendly strings.
        const msg = authError.message.toLowerCase()
        if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
          throw new Error('Incorrect email or password. Please try again.')
        }
        if (msg.includes('email not confirmed')) {
          throw new Error('Please confirm your email address before logging in.')
        }
        if (msg.includes('too many requests')) {
          throw new Error('Too many login attempts. Please wait a moment and try again.')
        }
        throw new Error('Login failed. Please check your connection and try again.')
      }
      // onAuthStateChange will handle setting user/session/profile and setLoading(false).
    },
    [supabase],
  )

  const logout = useCallback(async () => {
    setError(null)
    await supabase.auth.signOut()
    // onAuthStateChange clears state.
  }, [supabase])

  // ---------------------------------------------------------------------------
  // Derived flags — computed only from loaded profile, never assumed
  // ---------------------------------------------------------------------------
  const isAuthenticated = !loading && user !== null && session !== null
  const isOwner = isAuthenticated && profileState === 'loaded' && profile?.role === 'owner'
  const isTrainer = isAuthenticated && profileState === 'loaded' && profile?.role === 'trainer'

  const value: AuthState = {
    user,
    session,
    profile,
    loading,
    error,
    isAuthenticated,
    isOwner,
    isTrainer,
    profileState,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Internal hook — used only by the exported useAuth hook
// ---------------------------------------------------------------------------
export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
