import type { GymSettings, UpdateGymSettingsInput, ChangePasswordInput } from '../types/settings'
import type { UserProfile } from '../types/auth'

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

  if (json.data === undefined && res.status !== 204) {
    throw new Error(json.message ?? 'Invalid response from server.')
  }

  return json.data as T
}

export async function fetchGymSettings(accessToken: string): Promise<GymSettings> {
  const res = await fetch(`${API_BASE}/api/settings/gym`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return handleResponse<GymSettings>(res, 'Failed to load gym settings.')
}

export async function updateGymSettings(
  accessToken: string,
  input: UpdateGymSettingsInput,
): Promise<GymSettings> {
  const res = await fetch(`${API_BASE}/api/settings/gym`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  return handleResponse<GymSettings>(res, 'Failed to update gym settings.')
}

export async function fetchMyProfile(
  accessToken: string,
): Promise<UserProfile & { last_sign_in_at: string | null }> {
  const res = await fetch(`${API_BASE}/api/settings/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return handleResponse<UserProfile & { last_sign_in_at: string | null }>(
    res,
    'Failed to load profile details.',
  )
}

export async function updateMyProfile(
  accessToken: string,
  input: { full_name?: string; phone?: string | null },
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/settings/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  return handleResponse<UserProfile>(res, 'Failed to update profile.')
}

export async function changePassword(
  accessToken: string,
  input: ChangePasswordInput,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/settings/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const json = (await res.json().catch(() => ({}))) as ApiResponse<unknown>
  if (!res.ok) {
    throw new Error(json.message ?? 'Failed to change password.')
  }

  return { success: true, message: json.message ?? 'Password changed successfully.' }
}
