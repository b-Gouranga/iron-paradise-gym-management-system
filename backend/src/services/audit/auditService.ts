import { getSupabaseAdmin } from '../database/supabaseAdmin.js'

export interface LogAuditParams {
  actorId?: string | null
  entityType: string
  entityId?: string | string[] | null
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
  'authorization',
  'auth',
  'cookie',
  'api_key',
  'apikey',
  'private_key',
  'session',
  'credential',
])

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(str: unknown): str is string {
  return typeof str === 'string' && UUID_REGEX.test(str)
}

/**
 * Recursively strips sensitive fields (passwords, tokens, authorization keys, secrets)
 * from objects and nested arrays to avoid recording secrets in immutable audit logs.
 */
export function scrubSensitiveData(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  const cleaned: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue // strip sensitive fields
    }

    if (Array.isArray(value)) {
      cleaned[key] = value.map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return scrubSensitiveData(item as Record<string, unknown>)
        }
        return item
      })
    } else if (value && typeof value === 'object') {
      cleaned[key] = scrubSensitiveData(value as Record<string, unknown>)
    } else {
      cleaned[key] = value
    }
  }

  return cleaned
}

/**
 * Inserts an immutable audit log entry into `public.audit_logs`.
 * Automatically scrubs sensitive attributes like passwords and tokens,
 * and ensures UUID parameters conform to Postgres type requirements.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()

    // Validate entityId format: must be valid UUID or null
    const rawEntityId = Array.isArray(params.entityId) ? params.entityId[0] : params.entityId
    const validEntityId = isValidUuid(rawEntityId) ? rawEntityId : null

    // If entityId was provided as a string but wasn't a valid UUID,
    // preserve it in newData as _entity_identifier so information is not lost
    let finalNewData = params.newData ? { ...params.newData } : null
    if (rawEntityId && !validEntityId && finalNewData) {
      if (!finalNewData._entity_identifier) {
        finalNewData._entity_identifier = rawEntityId
      }
    }

    const { error } = await supabase.from('audit_logs').insert({
      actor_id: isValidUuid(params.actorId) ? params.actorId : null,
      entity_type: params.entityType,
      entity_id: validEntityId,
      action: params.action,
      previous_data: scrubSensitiveData(params.previousData),
      new_data: scrubSensitiveData(finalNewData),
    })

    if (error) {
      console.error('[auditService] Failed to record audit log:', error.message)
    }
  } catch (err) {
    console.error('[auditService] Unexpected error recording audit log:', err)
  }
}
