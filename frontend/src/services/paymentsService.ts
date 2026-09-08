import type {
  MemberPaymentSummary,
  MembershipPaymentSummary,
  PaymentListFilters,
  PaymentListResponse,
  PaymentTransaction,
  RecordPaymentPayload,
} from '../types/payments'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

interface ApiResponse<T> {
  success?: boolean
  message?: string
  data?: T
}

async function handleResponse<T>(res: Response, defaultErrMsg: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>

  if (!res.ok) {
    throw new Error(json.message ?? defaultErrMsg)
  }

  if (json.data === undefined) {
    throw new Error('Invalid response from server.')
  }

  return json.data
}

export async function fetchPayments(
  accessToken: string,
  filters: PaymentListFilters = {},
): Promise<PaymentListResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.search) {
    const s = filters.search.trim()
    params.set('search', s)
    params.set('q', s)
  }
  if (filters.payment_method && filters.payment_method !== 'all') {
    params.set('payment_method', filters.payment_method)
    params.set('method', filters.payment_method)
  }
  if (filters.purpose && filters.purpose !== 'all') {
    params.set('purpose', filters.purpose)
  }
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)

  const url = `${API_BASE}/api/payments${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<PaymentListResponse>(res, 'Failed to load payments.')
}

export async function fetchMemberPayments(
  accessToken: string,
  memberId: string,
): Promise<MemberPaymentSummary> {
  const res = await fetch(`${API_BASE}/api/members/${memberId}/payments`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<MemberPaymentSummary>(res, 'Failed to load member payments.')
}

export async function fetchMembershipPayments(
  accessToken: string,
  membershipId: string,
): Promise<{ summary: MembershipPaymentSummary; payments: PaymentTransaction[] }> {
  const res = await fetch(`${API_BASE}/api/memberships/${membershipId}/payments`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<{ summary: MembershipPaymentSummary; payments: PaymentTransaction[] }>(
    res,
    'Failed to load membership payments.',
  )
}

export async function recordPayment(
  accessToken: string,
  membershipId: string,
  payload: RecordPaymentPayload,
): Promise<{ payment: PaymentTransaction; summary: MembershipPaymentSummary }> {
  const res = await fetch(`${API_BASE}/api/memberships/${membershipId}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<{ payment: PaymentTransaction; summary: MembershipPaymentSummary }>(
    res,
    'Failed to record payment.',
  )
}
