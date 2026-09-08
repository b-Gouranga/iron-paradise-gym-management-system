import { AlertTriangle, Calendar, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { useAuth } from '../../hooks/useAuth'
import { fetchMembershipPlans } from '../../services/membershipPlansService'
import { createMembership } from '../../services/membershipsService'
import type { MembershipPlan } from '../../types/membershipPlans'

interface AddMembershipModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  memberId: string
  memberName: string
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
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

export function AddMembershipModal({
  isOpen,
  onClose,
  onSuccess,
  memberId,
  memberName,
}: AddMembershipModalProps) {
  const { session } = useAuth()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)

  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState(getTodayISO())
  const [actualFee, setActualFee] = useState('')
  const [paymentDueDate, setPaymentDueDate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load active plans when modal opens
  useEffect(() => {
    if (!isOpen) return
    const token = session?.access_token
    if (!token) return

    setLoadingPlans(true)
    fetchMembershipPlans(token, 'active')
      .then(activePlans => {
        setPlans(activePlans)
        if (activePlans.length > 0) {
          const first = activePlans[0]
          setPlanId(first.id)
          setActualFee(String(first.default_fee))
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load membership plans.')
      })
      .finally(() => setLoadingPlans(false))

    setStartDate(getTodayISO())
    setPaymentDueDate('')
    setError(null)
  }, [isOpen, session?.access_token])

  if (!isOpen) return null

  const selectedPlan = plans.find(p => p.id === planId)
  const previewExpiry = selectedPlan
    ? calculatePreviewExpiry(startDate, selectedPlan.duration_value, selectedPlan.duration_unit)
    : ''

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

    if (!planId) {
      setError('Please select a membership plan.')
      return
    }

    const parsedFee = parseFloat(actualFee)
    if (isNaN(parsedFee) || parsedFee < 0) {
      setError('Actual fee must be a non-negative number.')
      return
    }

    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to create a membership.')
      return
    }

    setSubmitting(true)
    try {
      await createMembership(token, memberId, {
        plan_id: planId,
        start_date: startDate,
        actual_fee: parsedFee,
        payment_due_date: paymentDueDate.trim() || null,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create membership.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-membership-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div>
            <h2 id="add-membership-modal-title" className="text-lg font-bold text-white">
              Assign Membership
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Assign a new membership plan to <strong className="text-zinc-200">{memberName}</strong>.
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
            The backend calculates the inclusive expiry date and verifies that no active memberships
            overlap. The actual fee agreed here is saved with the membership record and remains
            unchanged by future plan pricing edits.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Membership Plan <span className="text-brand">*</span>
            </label>
            {loadingPlans ? (
              <div className="py-2 text-xs text-zinc-500">Loading active plans…</div>
            ) : plans.length === 0 ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                No active membership plans available. Please create or activate a plan first.
              </div>
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
              {submitting ? 'Assigning...' : 'Assign Membership'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
