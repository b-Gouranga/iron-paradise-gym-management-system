import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Dumbbell } from 'lucide-react'

/** Full-screen loading spinner shown while the auth state is being resolved. */
function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#111113]">
      <div className="rounded-xl bg-brand p-3 text-white">
        <Dumbbell size={28} className="animate-pulse" />
      </div>
      <p className="text-sm text-zinc-500">Loading Iron Paradise…</p>
    </div>
  )
}

/**
 * Wraps routes that require authentication.
 * - While loading: shows a full-screen spinner (prevents flash of protected content).
 * - If not authenticated: redirects to /login, preserving the intended destination.
 * - If authenticated: renders child routes via <Outlet />.
 */
export function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoadingScreen />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
