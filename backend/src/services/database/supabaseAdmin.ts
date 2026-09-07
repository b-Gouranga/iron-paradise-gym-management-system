import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../../config/env.js'

let adminClient: SupabaseClient | undefined

/**
 * Returns the server-only Supabase client. Do not import this module from the
 * frontend or expose its service-role key in an API response.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient

  const { supabaseUrl, supabaseServiceRoleKey } = env
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  }

  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}
