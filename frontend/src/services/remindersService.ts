import type {
  HistoryFilters,
  MemberRemindersResponse,
  MessageHistoryResponse,
  MessageTemplate,
  ReminderFilters,
  ReminderItem,
  ReminderSetting,
  ReminderStage,
  RemindersListResponse,
} from '../types/reminders'

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

export async function fetchReminders(
  accessToken: string,
  filters: ReminderFilters = {},
): Promise<RemindersListResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.q) params.set('q', filters.q.trim())
  if (filters.stage && filters.stage !== 'all') params.set('stage', filters.stage)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.channel && filters.channel !== 'all') params.set('channel', filters.channel)

  const url = `${API_BASE}/api/reminders${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  return handleResponse<RemindersListResponse>(res, 'Failed to load reminders.')
}

export async function fetchMessageHistory(
  accessToken: string,
  filters: HistoryFilters = {},
): Promise<MessageHistoryResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.q) params.set('q', filters.q.trim())
  if (filters.channel && filters.channel !== 'all') params.set('channel', filters.channel)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.stage && filters.stage !== 'all') params.set('stage', filters.stage)

  const url = `${API_BASE}/api/reminders/history${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  return handleResponse<MessageHistoryResponse>(res, 'Failed to load message history.')
}

export async function fetchReminderSettings(accessToken: string): Promise<ReminderSetting[]> {
  const res = await fetch(`${API_BASE}/api/reminders/settings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<ReminderSetting[]>(res, 'Failed to load reminder settings.')
}

export async function updateReminderSetting(
  accessToken: string,
  stage: ReminderStage,
  payload: { is_enabled?: boolean; channel?: 'whatsapp' | 'sms'; auto_generate?: boolean; max_retries?: number },
): Promise<ReminderSetting> {
  const res = await fetch(`${API_BASE}/api/reminders/settings/${stage}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  return handleResponse<ReminderSetting>(res, 'Failed to update reminder setting.')
}

export async function fetchMessageTemplates(accessToken: string): Promise<MessageTemplate[]> {
  const res = await fetch(`${API_BASE}/api/reminders/templates`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<MessageTemplate[]>(res, 'Failed to load message templates.')
}

export async function updateMessageTemplate(
  accessToken: string,
  id: string,
  payload: { body?: string; is_active?: boolean },
): Promise<MessageTemplate> {
  const res = await fetch(`${API_BASE}/api/reminders/templates/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  return handleResponse<MessageTemplate>(res, 'Failed to update message template.')
}

export async function previewTemplate(
  accessToken: string,
  body: string,
  memberId?: string,
): Promise<{ rendered: string; context: Record<string, string> }> {
  const res = await fetch(`${API_BASE}/api/reminders/preview-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ body, member_id: memberId }),
  })
  return handleResponse<{ rendered: string; context: Record<string, string> }>(
    res,
    'Failed to preview template.',
  )
}

export async function triggerGenerate(accessToken: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/reminders/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<{ message: string }>(res, 'Failed to generate reminders.')
}

export async function triggerProcess(
  accessToken: string,
  simulateFailure?: boolean,
  failureReason?: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/reminders/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ simulateFailure, failureReason }),
  })
  return handleResponse<{ message: string }>(res, 'Failed to process reminders.')
}

export async function triggerRun(accessToken: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/reminders/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<{ message: string }>(res, 'Failed to run reminder engine.')
}

export async function sendReminder(
  accessToken: string,
  reminderId: string,
  simulateFailure?: boolean,
  failureReason?: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/reminders/${reminderId}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ simulateFailure, failureReason }),
  })
  return handleResponse<{ message: string }>(res, 'Failed to send reminder.')
}

export async function cancelReminder(
  accessToken: string,
  reminderId: string,
): Promise<ReminderItem> {
  const res = await fetch(`${API_BASE}/api/reminders/${reminderId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<ReminderItem>(res, 'Failed to cancel reminder.')
}

export async function retryReminder(
  accessToken: string,
  reminderId: string,
): Promise<{ message: string; result?: unknown }> {
  const res = await fetch(`${API_BASE}/api/reminders/${reminderId}/retry`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<{ message: string; result?: unknown }>(res, 'Failed to retry reminder.')
}

export interface ManualSendReminderPayload {
  memberId?: string
  member_id?: string
  reminderStage?: ReminderStage | string
  stage?: ReminderStage | string
  membershipId?: string
  membership_id?: string
  channel?: 'whatsapp' | 'sms'
}

export async function manualSendReminder(
  accessToken: string,
  payload: ManualSendReminderPayload,
): Promise<{ message: string; result?: unknown }> {
  const body = {
    memberId: payload.memberId || payload.member_id,
    reminderStage: payload.reminderStage || payload.stage,
    channel: payload.channel || 'whatsapp',
    ...(payload.membershipId || payload.membership_id
      ? { membershipId: payload.membershipId || payload.membership_id }
      : {}),
  }
  const res = await fetch(`${API_BASE}/api/reminders/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  return handleResponse<{ message: string; result?: unknown }>(res, 'Failed to send manual reminder.')
}

export async function fetchMemberReminders(
  accessToken: string,
  memberId: string,
): Promise<MemberRemindersResponse> {
  const res = await fetch(`${API_BASE}/api/members/${memberId}/reminders`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return handleResponse<MemberRemindersResponse>(res, 'Failed to load member reminders.')
}

