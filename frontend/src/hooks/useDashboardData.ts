import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchDashboardSummary } from '../services/dashboardService'
import type { DashboardData } from '../types/dashboard'

/**
 * Fetches all dashboard data from the protected backend endpoint.
 *
 * Depends on the Part 3 AuthContext for the user's access token.
 * Re-fetches automatically if the session token changes.
 * Returns null data (with loading=true) until the first fetch resolves.
 */
export function useDashboardData(): {
  data: DashboardData | null
  loading: boolean
  error: string | null
} {
  const { session } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = session?.access_token
    if (!token) {
      // No session — ProtectedRoute should redirect, but handle gracefully
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchDashboardSummary(token)
      .then(d => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load dashboard data. Please refresh the page.',
          )
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  return { data, loading, error }
}
