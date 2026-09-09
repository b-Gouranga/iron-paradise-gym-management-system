import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import { scrubSensitiveData } from '../services/audit/auditService.js'

export interface AuditLogActor {
  id: string
  full_name: string
  email: string
  role: string
}

export interface AuditLogResponseItem {
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

/**
 * GET /api/audit-logs
 *
 * Owner-only endpoint to view immutable audit logs.
 * Supports pagination, date range filtering, action filtering, entity type filtering,
 * and search by staff member name or email.
 */
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25))
    const offset = (page - 1) * limit

    const action = req.query.action ? String(req.query.action).trim() : null
    const entityType = req.query.entity_type ? String(req.query.entity_type).trim() : null
    const startDate = req.query.start_date ? String(req.query.start_date).trim() : null
    const endDate = req.query.end_date ? String(req.query.end_date).trim() : null
    const search = req.query.search ? String(req.query.search).trim() : null

    // If search is provided, find staff profiles matching by name or email
    let matchingActorIds: string[] | null = null
    if (search) {
      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

      matchingActorIds = (matchedProfiles || []).map((p) => p.id)

      // If search yielded no staff profiles, we can return empty early
      if (matchingActorIds.length === 0) {
        res.json({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
        return
      }
    }

    // Build the query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })

    if (action) {
      query = query.eq('action', action)
    }

    if (entityType) {
      query = query.eq('entity_type', entityType)
    }

    if (startDate) {
      // Beginning of start_date UTC
      query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
    }

    if (endDate) {
      // End of end_date UTC
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
    }

    if (matchingActorIds && matchingActorIds.length > 0) {
      query = query.in('actor_id', matchingActorIds)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: logs, count, error } = await query

    if (error) {
      console.error('[auditLogsController] Failed to query audit logs:', error.message)
      res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' })
      return
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit)

    // Collect actor profiles for the returned logs to enrich staff details
    const actorIds = Array.from(
      new Set((logs || []).map((l) => l.actor_id).filter((id): id is string => Boolean(id))),
    )

    let actorMap = new Map<string, AuditLogActor>()
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', actorIds)

      if (profiles) {
        for (const p of profiles) {
          actorMap.set(p.id, {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            role: p.role,
          })
        }
      }
    }

    // Enrich logs with actor details and ensure data scrubbing
    const items: AuditLogResponseItem[] = (logs || []).map((log) => {
      const actor = log.actor_id ? actorMap.get(log.actor_id) ?? null : null
      return {
        id: log.id,
        actor_id: log.actor_id,
        actor,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        action: log.action,
        previous_data: scrubSensitiveData(log.previous_data),
        new_data: scrubSensitiveData(log.new_data),
        created_at: log.created_at,
      }
    })

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (err) {
    console.error('[auditLogsController] Unexpected error in getAuditLogs:', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}
