import { AlertTriangle, ArrowRight, Calendar, Clock, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { useAuth } from '../../hooks/useAuth'
import { fetchMembershipPlans } from '../../services/membershipPlansService'
import { renewMembership } from '../../services/membershipsService'
import type { MembershipPlan } from '../../types/membershipPlans'
import type { Membership } from '../../types/memberships'

interface RenewMembershipModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  previousMembership: Membership | null
  memberName: string
}

function calculatePreviewExpiry(
  startDateStr: string,
  durationValue: number,
  durationUnit: string,
): string {
  if (!startDateStr || !durationValue || !durationUnit) return ''
  const [year, month, day] = startDateStr.split('-').map(Number)
  if (!year || !month || !day) return ''

  if (durationUnit === 'days') {
    const d = new Date(Date.UTC(year, month - 1, day))
    d.setUTCDate(d.getUTCDate() + durationValue - 1)
    return d.toISOString().split('T')[0]
  }

  if (durationUnit === 'months') {
    let targetMonth = month - 1 + durationValue
    const targetYear = year + Math.floor(targetMonth / 12)
    targetMonth = targetMonth % 12
    const maxDays = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
    const targetDay = Math.min(day, maxDays)
    const d = new Date(Date.UTC(targetYear, targetMonth, targetDay))
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().split('T')[0]
  }

  if (durationUnit === 'years') {
    const targetYear = year + durationValue
    const targetMonth = month - 1
    const maxDays = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
    const targetDay = Math.min(day, maxDays)
    const d = new Date(Date.UTC(targetYear, targetMonth, targetDay))
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().split('T')[0]
  }

  return ''
}

function calculateRenewalDelayDays(
  previousExpiryDateStr: string,
  newStartDateStr: string,
): number {
  if (!previousExpiryDateStr || !newStartDateStr) return 0
  const [pY, pM, pD] = previousExpiryDateStr.split('-').map(Number)
  const [nY, nM, nD] = newStartDateStr.split('-').map(Number)
  const prevExpiryUtc = Date.UTC(pY, pM - 1, pD)
  const newStartUtc = Date.UTC(nY, nM - 1, nD)
  return Math.round((newStartUtc - prevExpiryUtc) / 86_400_000)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function getDefaultRenewalStart(previousExpiry: string): string {
  if (!previousExpiry) return new Date().toISOString().split('T')[0]
  const [y, m, d] = previousExpiry.split('-').map(Number)
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1))
  return nextDay.toISOString().split('T')[0]
}

export function RenewMembershipModal({
  isOpen,
  onClose,
  onSuccess,
  previousMembership,
  memberName,
}: RenewMembershipModalProps) {
  const { session } = useAuth()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)

  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [actualFee, setActualFee] = useState('')
  const [paymentDueDate, setPaymentDueDate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !previousMembership) return
    const token = session?.access_token
    if (!token) return

    setLoadingPlans(true)
    fetchMembershipPlans(token, 'active')
      .then(activePlans => {
        setPlans(activePlans)
        // Prefer previous plan if still active; otherwise first active plan
        const match =
          activePlans.find(p => p.id === previousMembership.plan_id) ?? activePlans[0]
        if (match) {
          setPlanId(match.id)
          setActualFee(String(match.default_fee))
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load membership plans.')
      })
      .finally(() => setLoadingPlans(false))

    const defStart = getDefaultRenewalStart(previousMembership.expiry_date)
    setStartDate(defStart)
    setPaymentDueDate('')
    setError(null)
  }, [isOpen, previousMembership, session?.access_token])

  if (!isOpen || !previousMembership) return null

  const selectedPlan = plans.find(p => p.id === planId)
  const previewExpiry = selectedPlan
    ? calculatePreviewExpiry(startDate, selectedPlan.duration_value, selectedPlan.duration_unit)
    : ''

  const renewalDelay = calculateRenewalDelayDays(previousMembership.expiry_date, startDate)

  function handlePlanChange(newPlanId: string) {
    setPlanId(newPlanId)
    const plan = plans.find(p => p.id === newPlanId)
    if (plan) {
      setActualFee(String(plan.default_fee))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!previousMembership) {
      setError('Previous membership reference is missing.')
      return
    }

    if (!planId) {
      setError('Please select a membership plan for renewal.')
      return
    }

    const parsedFee = parseFloat(actualFee)
    if (isNaN(parsedFee) || parsedFee < 0) {
      setError('Actual fee must be a valid non-negative number.')
      return
    }

    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to renew a membership.')
      return
    }

    setSubmitting(true)
    try {
      await renewMembership(token, previousMembership.id, {
        plan_id: planId,
        start_date: startDate,
        actual_fee: parsedFee,
        payment_due_date: paymentDueDate.trim() || null,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to renew membership.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="renew-membership-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div>
            <h2 id="renew-membership-modal-title" className="text-lg font-bold text-white">
              Renew Membership
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Create a renewal membership for <strong className="text-zinc-200">{memberName}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}

        {/* Previous Membership Reference Box */}
        <div className="mt-4 rounded-xl border border-white/[.08] bg-white/[.03] p-3.5 text-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-zinc-500">
              Previous Membership
            </span>
            <span className="rounded bg-white/[.06] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
              Preserved Permanently
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between font-medium text-white">
            <span>{previousMembership.plan_name}</span>
            <span className="text-zinc-400">
              Expired: {formatDate(previousMembership.expiry_date)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[.06] bg-white/[.02] p-3 text-xs text-zinc-400">
          <Info size={15} className="mt-0.5 shrink-0 text-zinc-400" />
          <p>
            Renewal generates a brand new membership record linked to the previous one. The previous
            record and its financial history remain untouched.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Renewal Plan <span className="text-brand">*</span>
            </label>
            {loadingPlans ? (
              <div className="py-2 text-xs text-zinc-500">Loading active plans…</div>
            ) : (
              <select
                required
                value={planId}
                onChange={e => handlePlanChange(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand/70"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#1C1C1F] text-white">
                    {p.name} ({p.duration_value} {p.duration_unit}) — ₹{p.default_fee}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                New Start Date <span className="text-brand">*</span>
              </label>
              <Input
                required
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Calculated Expiry
              </label>
              <div className="flex h-[42px] items-center rounded-lg border border-white/10 bg-white/[.02] px-3.5 text-sm font-semibold text-emerald-300">
                <Calendar size={14} className="mr-2 text-emerald-400" />
                {previewExpiry ? formatDate(previewExpiry) : '—'}
              </div>
            </div>
          </div>

          {/* Live Renewal Delay Indicator */}
          <div className="flex items-center justify-between rounded-lg border border-white/[.06] bg-white/[.02] px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock size={14} />
              <span>Renewal Gap:</span>
            </div>
            <span
              className={`font-semibold ${
                renewalDelay <= 1
                  ? 'text-emerald-300'
                  : renewalDelay <= 7
                    ? 'text-amber-300'
                    : 'text-zinc-300'
              }`}
            >
              {renewalDelay <= 1
                ? 'Continuous renewal (0–1 day gap)'
                : `+${renewalDelay} days renewal delay`}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Actual Fee (₹) <span className="text-brand">*</span>
              </label>
              <Input
                required
                type="number"
                min="0"
                step="any"
                value={actualFee}
                onChange={e => setActualFee(e.target.value)}
                placeholder="e.g. 1500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Payment Due Date
              </label>
              <Input
                type="date"
                value={paymentDueDate}
                onChange={e => setPaymentDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/[.07] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[.06] hover:text-white"
            >
              Cancel
            </button>
            <Button type="submit" disabled={submitting || plans.length === 0}>
              {submitting ? 'Renewing...' : 'Confirm Renewal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
