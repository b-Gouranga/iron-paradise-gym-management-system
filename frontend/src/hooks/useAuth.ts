import { useAuthContext } from '../context/AuthContext'

/**
 * Returns the current authentication and authorization state.
 * Must be used inside <AuthProvider>.
 */
export function useAuth() {
  return useAuthContext()
}
