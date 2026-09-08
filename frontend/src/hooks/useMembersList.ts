import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchMembers } from '../services/membersService'
import type { MemberFilter, MemberListItem } from '../types/members'

export function useMembersList() {
  const { session } = useAuth()
  const [members, setMembers] = useState<MemberListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearchState] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilterState] = useState<MemberFilter>('all')
  const [reloadIndex, setReloadIndex] = useState(0)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const setSearch = useCallback((val: string) => {
    setSearchState(val)
  }, [])

  const setFilter = useCallback((val: MemberFilter) => {
    setFilterState(val)
    setPage(1)
  }, [])

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

    fetchMembers(token, {
      q: debouncedSearch,
      filter,
      page,
      limit: 15,
    })
      .then(res => {
        if (!cancelled) {
          setMembers(res.members)
          setTotal(res.total)
          setTotalPages(res.totalPages)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load members. Please try again.',
          )
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token, debouncedSearch, filter, page, reloadIndex])

  return {
    members,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    setPage,
    refresh,
  }
}
