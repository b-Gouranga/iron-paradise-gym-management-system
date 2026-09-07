import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
}
