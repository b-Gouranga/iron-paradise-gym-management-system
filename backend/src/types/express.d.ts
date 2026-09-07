import type { ProfileRow } from '../../types/auth.js'
import type { User } from '@supabase/supabase-js'

// Augment Express's Request type so middleware can attach verified auth data.
// These fields are only set after requireAuth (and optionally requireRole) run.
declare global {
  namespace Express {
    interface Request {
      /** Verified Supabase Auth user. Set by requireAuth middleware. */
      authUser?: User
      /** Verified gym staff profile. Set by requireRole middleware. */
      authProfile?: ProfileRow
    }
  }
}
