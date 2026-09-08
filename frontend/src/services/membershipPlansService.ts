import type {
  CreateMembershipPlanPayload,
  MembershipPlan,
  MembershipPlanFilter,
  UpdateMembershipPlanPayload,
} from '../types/membershipPlans'

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

  if (!json.data) {
    throw new Error('Invalid response from server.')
  }

  return json.data
}

export async function fetchMembershipPlans(
  accessToken: string,
  filter?: MembershipPlanFilter,
): Promise<MembershipPlan[]> {
  const url =
    filter && filter !== 'all'
      ? `${API_BASE}/api/membership-plans?filter=${encodeURIComponent(filter)}`
      : `${API_BASE}/api/membership-plans`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<MembershipPlan[]>(res, 'Failed to load membership plans.')
}

export async function fetchMembershipPlan(
  accessToken: string,
  id: string,
): Promise<MembershipPlan> {
  const res = await fetch(`${API_BASE}/api/membership-plans/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<MembershipPlan>(res, 'Failed to load membership plan.')
}

export async function createMembershipPlan(
  accessToken: string,
  payload: CreateMembershipPlanPayload,
): Promise<MembershipPlan> {
  const res = await fetch(`${API_BASE}/api/membership-plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<MembershipPlan>(res, 'Failed to create membership plan.')
}

export async function updateMembershipPlan(
  accessToken: string,
  id: string,
  payload: UpdateMembershipPlanPayload,
): Promise<MembershipPlan> {
  const res = await fetch(`${API_BASE}/api/membership-plans/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<MembershipPlan>(res, 'Failed to update membership plan.')
}

export async function archiveMembershipPlan(
  accessToken: string,
  id: string,
): Promise<MembershipPlan> {
  const res = await fetch(`${API_BASE}/api/membership-plans/${id}/archive`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<MembershipPlan>(res, 'Failed to deactivate membership plan.')
}

export async function reactivateMembershipPlan(
  accessToken: string,
  id: string,
): Promise<MembershipPlan> {
  const res = await fetch(`${API_BASE}/api/membership-plans/${id}/reactivate`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<MembershipPlan>(res, 'Failed to reactivate membership plan.')
}
