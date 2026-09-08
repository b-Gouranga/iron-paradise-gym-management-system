import type {
  CreateTrainerInput,
  Trainer,
  TrainerStatusFilter,
  TrainerSummary,
  UpdateTrainerInput,
} from '../types/trainer'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

interface ApiResponse<T> {
  success?: boolean
  message?: string
  data?: T
  summary?: TrainerSummary
}

async function handleResponse<T>(res: Response, defaultErrMsg: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>

  if (!res.ok) {
    throw new Error(json.message ?? defaultErrMsg)
  }

  if (json.data === undefined && res.status !== 204) {
    throw new Error('Invalid response from server.')
  }

  return json.data as T
}

export async function fetchTrainers(
  accessToken: string,
  params?: { search?: string; status?: TrainerStatusFilter },
): Promise<{ trainers: Trainer[]; summary: TrainerSummary }> {
  const query = new URLSearchParams()
  if (params?.search) query.append('search', params.search)
  if (params?.status && params.status !== 'all') query.append('status', params.status)

  const url = `${API_BASE}/api/trainers${query.toString() ? `?${query.toString()}` : ''}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const json = (await res.json().catch(() => ({}))) as ApiResponse<Trainer[]>
  if (!res.ok) {
    throw new Error(json.message ?? 'Failed to load trainers.')
  }

  return {
    trainers: json.data || [],
    summary: json.summary || { total_trainers: 0, active_trainers: 0, inactive_trainers: 0 },
  }
}

export async function fetchTrainer(accessToken: string, id: string): Promise<Trainer> {
  const res = await fetch(`${API_BASE}/api/trainers/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return handleResponse<Trainer>(res, 'Failed to fetch trainer.')
}

export async function createTrainer(
  accessToken: string,
  input: CreateTrainerInput,
): Promise<Trainer> {
  const res = await fetch(`${API_BASE}/api/trainers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  })
  return handleResponse<Trainer>(res, 'Failed to create trainer.')
}

export async function updateTrainer(
  accessToken: string,
  id: string,
  input: UpdateTrainerInput,
): Promise<Trainer> {
  const res = await fetch(`${API_BASE}/api/trainers/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  })
  return handleResponse<Trainer>(res, 'Failed to update trainer.')
}

export async function activateTrainer(accessToken: string, id: string): Promise<Trainer> {
  const res = await fetch(`${API_BASE}/api/trainers/${id}/activate`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return handleResponse<Trainer>(res, 'Failed to activate trainer.')
}

export async function deactivateTrainer(accessToken: string, id: string): Promise<Trainer> {
  const res = await fetch(`${API_BASE}/api/trainers/${id}/deactivate`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return handleResponse<Trainer>(res, 'Failed to deactivate trainer.')
}

export async function resetTrainerPassword(
  accessToken: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/trainers/${id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message ?? 'Failed to reset password.')
  }
}
