import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'

let client: SupabaseClient<Database> | undefined

/** Returns the browser-safe Supabase client. It never uses a service-role key. */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.')
  }

  client = createClient<Database>(url, anonKey)
  return client
}
