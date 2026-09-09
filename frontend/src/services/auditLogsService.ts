import type { AuditLogFilter, AuditLogsResponse } from '../types/audit'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export async function fetchAuditLogs(
  accessToken: string,
  filters: AuditLogFilter = {},
): Promise<AuditLogsResponse> {
  const params = new URLSearchParams()

  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.action) params.set('action', filters.action)
  if (filters.entity_type) params.set('entity_type', filters.entity_type)
  if (filters.start_date) params.set('start_date', filters.start_date)
  if (filters.end_date) params.set('end_date', filters.end_date)
  if (filters.search) params.set('search', filters.search)

  const queryString = params.toString()
  const url = `${API_BASE}/api/audit-logs${queryString ? `?${queryString}` : ''}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const json = (await res.json().catch(() => ({}))) as AuditLogsResponse

  if (!res.ok) {
    throw new Error(json.message ?? 'Failed to retrieve audit logs.')
  }

  return json
}
