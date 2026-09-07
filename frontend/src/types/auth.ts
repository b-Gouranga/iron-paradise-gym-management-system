/**
 * Authentication and authorization types for Iron Paradise.
 * Used by AuthContext, useAuth, and route guards.
 */

export type ProfileRole = 'owner' | 'trainer'

/**
 * Describes the lifecycle state of loading the user's profile after
 * authentication is established.
 */
export type ProfileState =
  | 'idle'          // No auth session — profile not loaded
  | 'loading'       // Auth session exists, profile query in flight
  | 'loaded'        // Profile loaded successfully with a recognized role
  | 'missing'       // Authenticated but no profile row found
  | 'invalid_role'  // Profile row found but role is not recognized
  | 'error'         // Profile query failed

export interface UserProfile {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: ProfileRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthState {
  /** The Supabase Auth user object, null when unauthenticated. */
  user: import('@supabase/supabase-js').User | null
  /** The active Supabase session, null when unauthenticated. */
  session: import('@supabase/supabase-js').Session | null
  /** The user's gym profile loaded from the profiles table. */
  profile: UserProfile | null
  /** True while the initial auth state is being resolved (page load). */
  loading: boolean
  /** Any auth or profile loading error message, for display purposes. */
  error: string | null
  /** True once loading is false and a valid session exists. */
  isAuthenticated: boolean
  /** True when the user has a loaded profile with role === 'owner'. */
  isOwner: boolean
  /** True when the user has a loaded profile with role === 'trainer'. */
  isTrainer: boolean
  /** Granular state of the profile loading lifecycle. */
  profileState: ProfileState
  /** Log in with email and password. */
  login: (email: string, password: string) => Promise<void>
  /** Log out and clear the session. */
  logout: () => Promise<void>
}
