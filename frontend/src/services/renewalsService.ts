import type {
  ExpiredRenewalsResponse,
  RenewalHistoryResponse,
  UpcomingRenewalsResponse,
} from '../types/renewals'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

interface ApiResponse<T> {
  success?: boolean
  message?: string
  error?: string
  data?: T
}

async function handleResponse<T>(res: Response, defaultErrMsg: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>
  if (!res.ok) {
    throw new Error(json.error || json.message || defaultErrMsg)
  }
  if (json.data === undefined) {
    throw new Error('Invalid response from server.')
  }
  return json.data
}

export async function fetchUpcomingRenewals(
  accessToken: string,
  days: string | number = '30',
  search = '',
): Promise<UpcomingRenewalsResponse> {
  const params = new URLSearchParams()
  if (days) params.set('days', String(days))
  if (search) params.set('q', search.trim())

  const url = `${API_BASE}/api/renewals/upcoming${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<UpcomingRenewalsResponse>(res, 'Failed to load upcoming renewals.')
}

export async function fetchExpiredRenewals(
  accessToken: string,
  days = 60,
  search = '',
): Promise<ExpiredRenewalsResponse> {
  const params = new URLSearchParams()
  if (days) params.set('days', String(days))
  if (search) params.set('q', search.trim())

  const url = `${API_BASE}/api/renewals/expired${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<ExpiredRenewalsResponse>(res, 'Failed to load expired renewals.')
}

export async function fetchRenewalHistory(
  accessToken: string,
): Promise<RenewalHistoryResponse> {
  const res = await fetch(`${API_BASE}/api/renewals/history`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<RenewalHistoryResponse>(res, 'Failed to load renewal history.')
}
