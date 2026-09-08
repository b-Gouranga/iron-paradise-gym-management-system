import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import {
  fetchMessageHistory,
  fetchMessageTemplates,
  fetchReminderSettings,
  fetchReminders,
} from '../services/remindersService'
import type {
  HistoryFilters,
  MessageHistoryItem,
  MessageTemplate,
  ReminderFilters,
  ReminderItem,
  ReminderSetting,
  ReminderStatsSummary,
} from '../types/reminders'

export function useReminders(
  reminderFilters: ReminderFilters = {},
  historyFilters: HistoryFilters = {},
) {
  const { session } = useAuth()
  const token = session?.access_token

  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [totalReminders, setTotalReminders] = useState(0)
  const [reminderPages, setReminderPages] = useState(0)
  const [stats, setStats] = useState<ReminderStatsSummary>({
    scheduledCount: 0,
    sentCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    totalCount: 0,
  })

  const [history, setHistory] = useState<MessageHistoryItem[]>([])
  const [totalHistory, setTotalHistory] = useState(0)
  const [historyPages, setHistoryPages] = useState(0)

  const [settings, setSettings] = useState<ReminderSetting[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const [rRes, hRes, sRes, tRes] = await Promise.all([
        fetchReminders(token, reminderFilters),
        fetchMessageHistory(token, historyFilters),
        fetchReminderSettings(token),
        fetchMessageTemplates(token),
      ])

      setReminders(rRes.reminders)
      setTotalReminders(rRes.total)
      setReminderPages(rRes.totalPages)
      setStats(rRes.stats)

      setHistory(hRes.history)
      setTotalHistory(hRes.total)
      setHistoryPages(hRes.totalPages)

      setSettings(sRes)
      setTemplates(tRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminder data.')
    } finally {
      setLoading(false)
    }
  }, [
    token,
    reminderFilters.page,
    reminderFilters.limit,
    reminderFilters.q,
    reminderFilters.stage,
    reminderFilters.status,
    reminderFilters.channel,
    historyFilters.page,
    historyFilters.limit,
    historyFilters.q,
    historyFilters.channel,
    historyFilters.status,
    historyFilters.stage,
  ])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  return {
    reminders,
    totalReminders,
    reminderPages,
    stats,
    history,
    totalHistory,
    historyPages,
    settings,
    templates,
    loading,
    error,
    refresh: loadAll,
  }
}
