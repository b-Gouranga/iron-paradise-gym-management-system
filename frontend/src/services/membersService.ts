import type {
  CreateMemberPayload,
  MemberDetail,
  MembersListResponse,
  UpdateMemberPayload,
} from '../types/members'

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

export async function fetchMembers(
  accessToken: string,
  params: { q?: string; filter?: string; page?: number; limit?: number } = {},
): Promise<MembersListResponse> {
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.set('q', params.q)
  if (params.filter && params.filter !== 'all') searchParams.set('filter', params.filter)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  const queryString = searchParams.toString()
  const url = `${API_BASE}/api/members${queryString ? `?${queryString}` : ''}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<MembersListResponse>(res, 'Failed to load members.')
}

export async function fetchMember(accessToken: string, id: string): Promise<MemberDetail> {
  const res = await fetch(`${API_BASE}/api/members/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<MemberDetail>(res, 'Failed to load member.')
}

export async function createMember(
  accessToken: string,
  payload: CreateMemberPayload,
): Promise<MemberDetail> {
  const res = await fetch(`${API_BASE}/api/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<MemberDetail>(res, 'Failed to create member.')
}

export async function updateMember(
  accessToken: string,
  id: string,
  payload: UpdateMemberPayload,
): Promise<MemberDetail> {
  const res = await fetch(`${API_BASE}/api/members/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<MemberDetail>(res, 'Failed to update member.')
}

export async function archiveMember(accessToken: string, id: string): Promise<MemberDetail> {
  const res = await fetch(`${API_BASE}/api/members/${id}/archive`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return handleResponse<MemberDetail>(res, 'Failed to archive member.')
}
