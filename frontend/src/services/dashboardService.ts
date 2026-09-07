import type { DashboardData } from '../types/dashboard'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

/**
 * Fetches the aggregated dashboard summary from the protected backend endpoint.
 *
 * Security:
 * - Sends the user's Supabase access token in the Authorization header.
 * - The backend verifies the JWT server-side before executing any DB query.
 * - No raw financial rows are returned — only computed totals and bounded lists.
 * - The service-role key is never exposed to the browser.
 */
export async function fetchDashboardSummary(accessToken: string): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/api/dashboard/summary`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const json = await res.json().catch(() => ({})) as {
    success?: boolean
    message?: string
    data?: DashboardData
  }

  if (!res.ok) {
    throw new Error(json.message ?? 'Failed to load dashboard data.')
  }

  if (!json.data) {
    throw new Error('Invalid response from dashboard API.')
  }

  return json.data
}
