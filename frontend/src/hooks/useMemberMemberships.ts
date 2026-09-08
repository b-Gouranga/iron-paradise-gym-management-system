import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchMemberMemberships } from '../services/membershipsService'
import type { Membership } from '../types/memberships'

export function useMemberMemberships(memberId: string | undefined) {
  const { session } = useAuth()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadIndex, setReloadIndex] = useState(0)

  const refresh = useCallback(() => {
    setReloadIndex(i => i + 1)
  }, [])

  useEffect(() => {
    const token = session?.access_token
    if (!token || !memberId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchMemberMemberships(token, memberId)
      .then(data => {
        if (!cancelled) {
          setMemberships(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load memberships. Please try again.',
          )
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token, memberId, reloadIndex])

  // Current membership is the first active membership (if any), or the most recent one
  const currentMembership =
    memberships.find(m => m.status === 'active') ?? memberships[0] ?? null

  return {
    memberships,
    currentMembership,
    loading,
    error,
    refresh,
  }
}
