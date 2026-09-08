import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchMembershipPlans } from '../services/membershipPlansService'
import type { MembershipPlan, MembershipPlanFilter } from '../types/membershipPlans'

export function useMembershipPlans(initialFilter: MembershipPlanFilter = 'all') {
  const { session } = useAuth()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [filter, setFilter] = useState<MembershipPlanFilter>(initialFilter)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadIndex, setReloadIndex] = useState(0)

  const refresh = useCallback(() => {
    setReloadIndex(i => i + 1)
  }, [])

  useEffect(() => {
    const token = session?.access_token
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchMembershipPlans(token, filter)
      .then(data => {
        if (!cancelled) {
          setPlans(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load membership plans. Please try again.',
          )
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token, filter, reloadIndex])

  return {
    plans,
    loading,
    error,
    filter,
    setFilter,
    refresh,
  }
}
