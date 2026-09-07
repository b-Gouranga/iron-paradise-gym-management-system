import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ShieldX } from 'lucide-react'

/**
 * Wraps routes that require the Owner role.
 * - Unauthenticated users are redirected to /login.
 * - Authenticated non-owners see an "Access Denied" panel — they remain logged in.
 * - Owners proceed to the child route via <Outlet />.
 *
 * This guard is available for Part 4+ owner-only pages.
 */
export function OwnerRoute() {
  const { loading, isAuthenticated, isOwner } = useAuth()
  const location = useLocation()

  if (loading) return null  // ProtectedRoute's spinner handles this above us

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isOwner) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-red-400">
          <ShieldX size={36} />
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="max-w-sm text-sm leading-6 text-zinc-400">
          This section is restricted to the gym owner. If you believe this is
          an error, contact your administrator.
        </p>
      </div>
    )
  }

  return <Outlet />
}
