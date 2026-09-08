import { AlertTriangle, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { useAuth } from '../../hooks/useAuth'
import { createMembershipPlan, updateMembershipPlan } from '../../services/membershipPlansService'
import type { DurationUnit, MembershipPlan } from '../../types/membershipPlans'

interface PlanFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  plan?: MembershipPlan | null
}

export function PlanFormModal({
  isOpen,
  onClose,
  onSuccess,
  plan,
}: PlanFormModalProps) {
  const { session } = useAuth()
  const isEdit = Boolean(plan)

  const [name, setName] = useState('')
  const [durationValue, setDurationValue] = useState('1')
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('months')
  const [defaultFee, setDefaultFee] = useState('')
  const [description, setDescription] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (plan) {
      setName(plan.name ?? '')
      setDurationValue(String(plan.duration_value ?? 1))
      setDurationUnit(plan.duration_unit ?? 'months')
      setDefaultFee(String(plan.default_fee ?? ''))
      setDescription(plan.description ?? '')
    } else {
      setName('')
      setDurationValue('1')
      setDurationUnit('months')
      setDefaultFee('')
      setDescription('')
    }
    setError(null)
    setSubmitting(false)
  }, [plan, isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const parsedDuration = parseInt(durationValue, 10)
    const parsedFee = parseFloat(defaultFee)

    if (!trimmedName) {
      setError('Plan name is required.')
      return
    }

    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      setError('Duration value must be a positive integer.')
      return
    }

    if (isNaN(parsedFee) || parsedFee < 0) {
      setError('Default fee must be a valid non-negative number.')
      return
    }

    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to perform this action.')
      return
    }

    setSubmitting(true)
    try {
      if (isEdit && plan) {
        await updateMembershipPlan(token, plan.id, {
          name: trimmedName,
          duration_value: parsedDuration,
          duration_unit: durationUnit,
          default_fee: parsedFee,
          description: description.trim() || null,
        })
      } else {
        await createMembershipPlan(token, {
          name: trimmedName,
          duration_value: parsedDuration,
          duration_unit: durationUnit,
          default_fee: parsedFee,
          description: description.trim() || null,
        })
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div>
            <h2 id="plan-modal-title" className="text-lg font-bold text-white">
              {isEdit ? 'Edit Membership Plan' : 'Add Membership Plan'}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {isEdit
                ? 'Update reusable plan template details and default pricing.'
                : 'Create a reusable plan template for memberships.'}
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

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}

        {/* Informational Banner */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-white/[.06] bg-white/[.02] p-3 text-xs text-zinc-400">
          <Info size={16} className="mt-0.5 shrink-0 text-zinc-400" />
          <p>
            {isEdit ? (
              <>
                <strong className="text-zinc-300">Historical Fee Protection:</strong> Modifying the
                default fee only applies to new memberships. Existing memberships retain their
                original actual fee.
              </>
            ) : (
              <>
                Plans serve as templates. When a member purchases a membership, the plan duration
                and default fee are copied to the membership record.
              </>
            )}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Plan Name <span className="text-brand">*</span>
            </label>
            <Input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Monthly, Quarterly, Annual"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Duration Value <span className="text-brand">*</span>
              </label>
              <Input
                required
                type="number"
                min="1"
                step="1"
                value={durationValue}
                onChange={e => setDurationValue(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Duration Unit <span className="text-brand">*</span>
              </label>
              <select
                value={durationUnit}
                onChange={e => setDurationUnit(e.target.value as DurationUnit)}
                className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand/70"
              >
                <option value="days" className="bg-[#1C1C1F] text-white">
                  Days
                </option>
                <option value="months" className="bg-[#1C1C1F] text-white">
                  Months
                </option>
                <option value="years" className="bg-[#1C1C1F] text-white">
                  Years
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Default Fee (₹) <span className="text-brand">*</span>
            </label>
            <Input
              required
              type="number"
              min="0"
              step="any"
              value={defaultFee}
              onChange={e => setDefaultFee(e.target.value)}
              placeholder="e.g. 1500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Plan benefits, equipment access, or terms..."
              className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-brand/70"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-white/[.07] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[.06] hover:text-white"
            >
              Cancel
            </button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
