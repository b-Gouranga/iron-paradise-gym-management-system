import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchMember } from '../services/membersService'
import type { MemberDetail } from '../types/members'

export function useMemberDetail(id: string | undefined) {
  const { session } = useAuth()
  const [member, setMember] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadIndex, setReloadIndex] = useState(0)

  const refresh = useCallback(() => {
    setReloadIndex(i => i + 1)
  }, [])

  useEffect(() => {
    const token = session?.access_token
    if (!token || !id) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchMember(token, id)
      .then(data => {
        if (!cancelled) {
          setMember(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load member details. Please try again.',
          )
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token, id, reloadIndex])

  return { member, setMember, loading, error, refresh }
}
