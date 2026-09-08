import type {
  MembershipReportData,
  PaymentReportData,
  RenewalReportData,
  ReportFilters,
  ReportsOverviewData,
  RevenueReportData,
} from '../types/reports'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

interface ApiResponse<T> {
  success?: boolean
  error?: string
  data?: T
}

async function handleResponse<T>(res: Response, defaultErrMsg: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>

  if (!res.ok) {
    throw new Error(json.error ?? defaultErrMsg)
  }

  if (json.data === undefined) {
    throw new Error('Invalid response received from server.')
  }

  return json.data
}

function buildQueryParams(filters: Partial<ReportFilters> = {}): string {
  const params = new URLSearchParams()
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.period) params.set('period', filters.period)
  if (filters.plan_id && filters.plan_id !== 'all') params.set('plan_id', filters.plan_id)
  if (filters.payment_method && filters.payment_method !== 'all') {
    params.set('payment_method', filters.payment_method)
  }
  if (filters.payment_status && filters.payment_status !== 'all') {
    params.set('payment_status', filters.payment_status)
  }
  const str = params.toString()
  return str ? `?${str}` : ''
}

export async function fetchOverview(
  accessToken: string,
  filters: Partial<ReportFilters> = {},
): Promise<ReportsOverviewData> {
  const url = `${API_BASE}/api/reports/overview${buildQueryParams(filters)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<ReportsOverviewData>(res, 'Failed to fetch reports overview.')
}

export async function fetchRevenueReport(
  accessToken: string,
  filters: Partial<ReportFilters> = {},
): Promise<RevenueReportData> {
  const url = `${API_BASE}/api/reports/revenue${buildQueryParams(filters)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<RevenueReportData>(res, 'Failed to fetch revenue report.')
}

export async function fetchPaymentReport(
  accessToken: string,
  filters: Partial<ReportFilters> = {},
): Promise<PaymentReportData> {
  const url = `${API_BASE}/api/reports/payments${buildQueryParams(filters)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<PaymentReportData>(res, 'Failed to fetch payment report.')
}

export async function fetchMembershipReport(
  accessToken: string,
  filters: Partial<ReportFilters> = {},
): Promise<MembershipReportData> {
  const url = `${API_BASE}/api/reports/memberships${buildQueryParams(filters)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<MembershipReportData>(res, 'Failed to fetch membership report.')
}

export async function fetchRenewalReport(
  accessToken: string,
  filters: Partial<ReportFilters> = {},
): Promise<RenewalReportData> {
  const url = `${API_BASE}/api/reports/renewals${buildQueryParams(filters)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<RenewalReportData>(res, 'Failed to fetch renewal report.')
}
