import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { fetchMemberReminders } from '../services/remindersService'
import type { MessageHistoryItem, ReminderItem } from '../types/reminders'

export function useMemberReminders(memberId?: string) {
  const { session } = useAuth()
  const token = session?.access_token

  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [history, setHistory] = useState<MessageHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !memberId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetchMemberReminders(token, memberId)
      setReminders(res.reminders)
      setHistory(res.history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load member reminder data.')
    } finally {
      setLoading(false)
    }
  }, [token, memberId])

  useEffect(() => {
    load()
  }, [load])

  return {
    reminders,
    history,
    loading,
    error,
    refresh: load,
  }
}
