import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchMemberPayments } from '../services/paymentsService'
import type { MemberPaymentSummary } from '../types/payments'

export function useMemberPayments(memberId: string | undefined) {
  const { session } = useAuth()
  const [summary, setSummary] = useState<MemberPaymentSummary | null>(null)
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

    fetchMemberPayments(token, memberId)
      .then(data => {
        if (!cancelled) {
          setSummary(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load member payments. Please try again.',
          )
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token, memberId, reloadIndex])

  return {
    summary,
    loading,
    error,
    refresh,
  }
}
