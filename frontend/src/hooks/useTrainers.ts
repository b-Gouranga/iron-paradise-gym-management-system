import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import {
  activateTrainer,
  createTrainer,
  deactivateTrainer,
  fetchTrainers,
  resetTrainerPassword,
  updateTrainer,
} from '../services/trainersService'
import type {
  CreateTrainerInput,
  Trainer,
  TrainerStatusFilter,
  TrainerSummary,
  UpdateTrainerInput,
} from '../types/trainer'

export function useTrainers() {
  const { session } = useAuth()
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [summary, setSummary] = useState<TrainerSummary>({
    total_trainers: 0,
    active_trainers: 0,
    inactive_trainers: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TrainerStatusFilter>('all')
  const [reloadIndex, setReloadIndex] = useState(0)

  const refresh = useCallback(() => {
    setReloadIndex((i) => i + 1)
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

    fetchTrainers(token, { search, status })
      .then((res) => {
        if (!cancelled) {
          setTrainers(res.trainers)
          setSummary(res.summary)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load trainers.')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token, search, status, reloadIndex])

  const addTrainer = async (input: CreateTrainerInput) => {
    if (!session?.access_token) throw new Error('Not authenticated')
    const res = await createTrainer(session.access_token, input)
    refresh()
    return res
  }

  const editTrainer = async (id: string, input: UpdateTrainerInput) => {
    if (!session?.access_token) throw new Error('Not authenticated')
    const res = await updateTrainer(session.access_token, id, input)
    refresh()
    return res
  }

  const activate = async (id: string) => {
    if (!session?.access_token) throw new Error('Not authenticated')
    await activateTrainer(session.access_token, id)
    refresh()
  }

  const deactivate = async (id: string) => {
    if (!session?.access_token) throw new Error('Not authenticated')
    await deactivateTrainer(session.access_token, id)
    refresh()
  }

  const resetPassword = async (id: string, pass: string) => {
    if (!session?.access_token) throw new Error('Not authenticated')
    await resetTrainerPassword(session.access_token, id, pass)
  }

  return {
    trainers,
    summary,
    loading,
    error,
    search,
    setSearch,
    status,
    setStatus,
    refresh,
    addTrainer,
    editTrainer,
    activate,
    deactivate,
    resetPassword,
  }
}
