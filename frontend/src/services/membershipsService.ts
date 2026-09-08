import type {
  CreateMembershipPayload,
  Membership,
  RenewMembershipPayload,
  UpdateMembershipPayload,
} from '../types/memberships'

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

export async function fetchMemberMemberships(
  accessToken: string,
  memberId: string,
): Promise<Membership[]> {
  const res = await fetch(`${API_BASE}/api/members/${memberId}/memberships`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<Membership[]>(res, 'Failed to load member memberships.')
}

export async function fetchMembership(
  accessToken: string,
  id: string,
): Promise<Membership> {
  const res = await fetch(`${API_BASE}/api/memberships/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<Membership>(res, 'Failed to load membership.')
}

export async function createMembership(
  accessToken: string,
  memberId: string,
  payload: CreateMembershipPayload,
): Promise<Membership> {
  const res = await fetch(`${API_BASE}/api/members/${memberId}/memberships`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<Membership>(res, 'Failed to create membership.')
}

export async function renewMembership(
  accessToken: string,
  membershipId: string,
  payload: RenewMembershipPayload,
): Promise<Membership> {
  const res = await fetch(`${API_BASE}/api/memberships/${membershipId}/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<Membership>(res, 'Failed to renew membership.')
}

export async function updateMembership(
  accessToken: string,
  id: string,
  payload: UpdateMembershipPayload,
): Promise<Membership> {
  const res = await fetch(`${API_BASE}/api/memberships/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<Membership>(res, 'Failed to update membership.')
}
