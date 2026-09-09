/**
 * Types for Iron Paradise Gym Audit Logs.
 */

export interface AuditLogActor {
  id: string
  full_name: string
  email: string
  role: string
}

export interface AuditLogItem {
  id: string
  actor_id: string | null
  actor: AuditLogActor | null
  entity_type: string
  entity_id: string | null
  action: string
  previous_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

export interface AuditLogPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AuditLogsResponse {
  success: boolean
  data: AuditLogItem[]
  pagination: AuditLogPagination
  message?: string
}

export interface AuditLogFilter {
  page?: number
  limit?: number
  action?: string
  entity_type?: string
  start_date?: string
  end_date?: string
  search?: string
}
