import type { MembershipStatus } from '../types/memberships.js'

/**
 * Returns an ISO date string (YYYY-MM-DD) offset by `offsetDays` from `baseDateStr` (default: today UTC).
 */
export function isoDate(offsetDays = 0, baseDateStr?: string): string {
  const d = baseDateStr ? new Date(baseDateStr) : new Date()
  if (offsetDays !== 0) d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

export interface MembershipDateStatusCheck {
  status: string
  start_date: string
  expiry_date: string
}

/**
 * Determines if a membership is effectively Active today.
 *
 * Requirements:
 * - it is not cancelled
 * - its start date has been reached (start_date <= today)
 * - its expiry date has not passed (expiry_date >= today)
 */
export function isMembershipActive(
  m: MembershipDateStatusCheck,
  today: string = isoDate(),
): boolean {
  if (m.status === 'cancelled') return false
  return m.start_date <= today && m.expiry_date >= today
}

/**
 * Determines if a membership is effectively Expired today.
 *
 * Requirements:
 * - it is not cancelled
 * - its expiry date is strictly before today (expiry_date < today)
 * Even if the database stored status says 'active'.
 */
export function isMembershipExpired(
  m: { status: string; expiry_date: string },
  today: string = isoDate(),
): boolean {
  if (m.status === 'cancelled') return false
  return m.expiry_date < today
}

/**
 * Determines if a membership is in the Future.
 *
 * Requirements:
 * - it is not cancelled
 * - its start date has not been reached yet (start_date > today)
 */
export function isMembershipFuture(
  m: { status: string; start_date: string },
  today: string = isoDate(),
): boolean {
  if (m.status === 'cancelled') return false
  return m.start_date > today
}

/**
 * Determines if a membership is Expiring Soon.
 *
 * Requirements:
 * - it must be currently active (not cancelled, start_date <= today, expiry_date >= today)
 * - its expiry date is within the configured window (today <= expiry_date <= today + windowDays)
 */
export function isMembershipExpiringSoon(
  m: MembershipDateStatusCheck,
  today: string = isoDate(),
  windowDays = 7,
): boolean {
  if (!isMembershipActive(m, today)) return false
  const maxDate = isoDate(windowDays, today)
  return m.expiry_date <= maxDate
}

/**
 * Resolves the effective status of a membership for presentation / API responses.
 *
 * - 'cancelled' if status is cancelled
 * - 'future' if start_date > today
 * - 'expired' if expiry_date < today
 * - 'active' if start_date <= today and expiry_date >= today
 */
export function getEffectiveMembershipStatus(
  m: { status: string; start_date?: string; expiry_date: string },
  today: string = isoDate(),
): MembershipStatus {
  if (m.status === 'cancelled') return 'cancelled'
  if (m.start_date && m.start_date > today) return 'future'
  if (m.expiry_date < today) return 'expired'
  return 'active'
}

/**
 * Counts the number of UNIQUE members who currently possess at least one valid active membership.
 */
export function countUniqueActiveMembers(
  memberships: (MembershipDateStatusCheck & { member_id: string })[],
  today: string = isoDate(),
): number {
  const activeMemberIds = new Set<string>()
  for (const m of memberships) {
    if (isMembershipActive(m, today)) {
      activeMemberIds.add(m.member_id)
    }
  }
  return activeMemberIds.size
}

/**
 * Selects the current membership deterministically:
 * - considers only effectively Active memberships today (status !== 'cancelled', start_date <= today, expiry_date >= today)
 * - chooses the active membership with the latest expiry_date
 * - if expiry dates tie, chooses the latest start_date
 * - if still tied, chooses the one created latest
 * - returns null if there are no active memberships (never chooses a Future membership)
 */
export function selectCurrentMembership<T extends {
  status: string
  start_date: string
  expiry_date: string
  created_at?: string
}>(memberships: T[], today: string = isoDate()): T | null {
  const activeMemberships = memberships.filter(m => isMembershipActive(m, today))
  if (activeMemberships.length === 0) return null

  return activeMemberships.reduce((best, cur) => {
    if (cur.expiry_date > best.expiry_date) return cur
    if (cur.expiry_date < best.expiry_date) return best
    if (cur.start_date > best.start_date) return cur
    if (cur.start_date < best.start_date) return best
    if (cur.created_at && best.created_at && cur.created_at > best.created_at) return cur
    return best
  })
}

/**
 * Determines if a membership is eligible for Pending Dues calculation.
 *
 * Approved Business Rule:
 * - Includes Active memberships
 * - Includes Expired memberships
 * - Strictly EXCLUDES Cancelled memberships (status === 'cancelled')
 * - Strictly EXCLUDES Future memberships (start_date > today)
 */
export function isMembershipEligibleForPendingDues(
  m: { status: string; start_date?: string; expiry_date?: string },
  today: string = isoDate(),
): boolean {
  if (m.status === 'cancelled') return false
  if (m.start_date && isMembershipFuture({ status: m.status, start_date: m.start_date }, today)) {
    return false
  }
  return true
}

/**
 * Computes the pending amount for a membership given actual fee and total paid.
 * Enforces minimum 0, floating-point tolerance (> 0.005), and 2-decimal rounding.
 */
export function computePendingAmount(actualFee: number, totalPaid: number): number {
  const pending = Math.max(0, Number(actualFee) - Number(totalPaid))
  return pending > 0.005 ? Math.round(pending * 100) / 100 : 0
}
