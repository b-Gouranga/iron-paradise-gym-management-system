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

  // Current membership is chosen deterministically from effectively Active memberships today:
  // - considers only effectively Active memberships today (status !== 'cancelled', start_date <= today, expiry_date >= today)
  // - chooses the active membership with the latest expiry_date
  // - if expiry dates tie, chooses the latest start_date
  // - if still tied, chooses the latest created_at
  // - never chooses a Future membership (returns null if no active memberships)
  const today = new Date().toISOString().split('T')[0]
  const activeMemberships = memberships.filter(
    m => m.status !== 'cancelled' && m.start_date <= today && m.expiry_date >= today,
  )

  const currentMembership =
    activeMemberships.length > 0
      ? activeMemberships.reduce((best, cur) => {
          if (cur.expiry_date > best.expiry_date) return cur
          if (cur.expiry_date < best.expiry_date) return best
          if (cur.start_date > best.start_date) return cur
          if (cur.start_date < best.start_date) return best
          if (cur.created_at && best.created_at && cur.created_at > best.created_at) return cur
          return best
        })
      : null

  return {
    memberships,
    currentMembership,
    loading,
    error,
    refresh,
  }
}
