import { getSupabaseAdmin } from '../database/supabaseAdmin.js'

export interface LogAuditParams {
  actorId?: string | null
  entityType: string
  entityId: string
  action: string
  previousData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'key',
  'service_role_key',
])

function scrubSensitiveData(data: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!data) return null
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue // strip sensitive fields
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = scrubSensitiveData(value as Record<string, unknown>)
    } else {
      cleaned[key] = value
    }
  }
  return cleaned
}

/**
 * Inserts an immutable audit log entry into `public.audit_logs`.
 * Automatically scrubs sensitive attributes like passwords and tokens.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: params.actorId ?? null,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      previous_data: scrubSensitiveData(params.previousData),
      new_data: scrubSensitiveData(params.newData),
    })

    if (error) {
      console.error('[auditService] Failed to record audit log:', error.message)
    }
  } catch (err) {
    console.error('[auditService] Unexpected error recording audit log:', err)
  }
}
