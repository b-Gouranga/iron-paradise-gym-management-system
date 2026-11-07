import { AlertTriangle, Calendar, IndianRupee, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { useAuth } from '../../hooks/useAuth'
import { fetchMembershipPlans } from '../../services/membershipPlansService'
import { updateMembership } from '../../services/membershipsService'
import type { MembershipPlan } from '../../types/membershipPlans'
import type { Membership } from '../../types/memberships'

interface EditMembershipModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  membership: Membership | null
  memberName: string
  totalPaid?: number
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

const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

export function EditMembershipModal({
  isOpen,
  onClose,
  onSuccess,
  membership,
  memberName,
  totalPaid = 0,
}: EditMembershipModalProps) {
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
    if (!isOpen || !membership) return
    const token = session?.access_token
    if (!token) return

    setLoadingPlans(true)
    fetchMembershipPlans(token, 'all')
      .then(allPlans => {
        setPlans(allPlans)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load membership plans.')
      })
      .finally(() => setLoadingPlans(false))

    setPlanId(membership.plan_id)
    setStartDate(membership.start_date)
    setActualFee(String(membership.actual_fee))
    setPaymentDueDate(membership.payment_due_date || '')
    setError(null)
  }, [isOpen, membership, session?.access_token])

  if (!isOpen || !membership) return null

  const selectedPlan = plans.find(p => p.id === planId)
  const previewExpiry = selectedPlan
    ? calculatePreviewExpiry(startDate, selectedPlan.duration_value, selectedPlan.duration_unit)
    : membership.expiry_date

  const parsedFee = parseFloat(actualFee)
  const isFeeValid = !isNaN(parsedFee) && parsedFee >= 0
  const isBelowPaid = isFeeValid && totalPaid > 0 && parsedFee < totalPaid - 0.005
  const newPending = isFeeValid ? Math.max(0, parsedFee - totalPaid) : 0

  function handlePlanChange(newPlanId: string) {
    setPlanId(newPlanId)
    const plan = plans.find(p => p.id === newPlanId)
    if (plan && newPlanId !== membership?.plan_id) {
      setActualFee(String(plan.default_fee))
    } else if (newPlanId === membership?.plan_id) {
      setActualFee(String(membership.actual_fee))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!planId) {
      setError('Please select a membership plan.')
      return
    }

    if (!startDate) {
      setError('Please select a valid start date.')
      return
    }

    if (isNaN(parsedFee) || parsedFee < 0) {
      setError('Actual fee must be a valid non-negative number.')
      return
    }

    if (isBelowPaid) {
      setError(`Actual fee cannot be less than the amount already paid (${formatINR(totalPaid)}).`)
      return
    }

    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to edit a membership.')
      return
    }

    setSubmitting(true)
    try {
      await updateMembership(token, membership!.id, {
        plan_id: planId,
        start_date: startDate,
        actual_fee: parsedFee,
        payment_due_date: paymentDueDate.trim() || null,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update membership.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-membership-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div>
            <h2 id="edit-membership-modal-title" className="text-lg font-bold text-white">
              Edit Membership
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Editing membership for <strong className="text-zinc-200">{memberName}</strong>
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

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-white/[.06] bg-white/[.02] p-3 text-xs text-zinc-400">
          <Info size={16} className="mt-0.5 shrink-0 text-zinc-400" />
          <p>
            The backend recalculates the inclusive expiry date and verifies that no active memberships
            overlap. Historical payment transactions are preserved.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Membership Plan <span className="text-brand">*</span>
            </label>
            {loadingPlans ? (
              <div className="py-2 text-xs text-zinc-500">Loading plans…</div>
            ) : (
              <select
                required
                value={planId}
                onChange={e => handlePlanChange(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand/70"
              >
                {plans.map(p => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={!p.is_active && p.id !== membership.plan_id}
                    className="bg-[#1C1C1F] text-white"
                  >
                    {p.name} ({p.duration_value} {p.duration_unit}) — ₹{p.default_fee}
                    {!p.is_active ? ' (Inactive)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Start Date <span className="text-brand">*</span>
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

          {/* Payment summary breakdown */}
          <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-1">
                <IndianRupee size={12} className="text-zinc-500" />
                Amount Already Paid:
              </span>
              <strong className="text-emerald-300 font-mono font-medium">
                {formatINR(totalPaid)}
              </strong>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Recalculated Due / Outstanding:</span>
              <strong className={`font-mono font-medium ${newPending > 0 ? 'text-brand' : 'text-zinc-400'}`}>
                {formatINR(newPending)}
              </strong>
            </div>

            {isBelowPaid && (
              <div className="mt-2 flex items-center gap-1.5 text-red-400 text-xs font-medium">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Actual fee cannot be less than total already paid ({formatINR(totalPaid)}).</span>
              </div>
            )}
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
            <Button
              type="submit"
              disabled={submitting || plans.length === 0 || isBelowPaid}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
