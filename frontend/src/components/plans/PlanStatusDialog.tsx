import { AlertTriangle, CheckCircle, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  archiveMembershipPlan,
  reactivateMembershipPlan,
} from '../../services/membershipPlansService'
import type { MembershipPlan } from '../../types/membershipPlans'

interface PlanStatusDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  plan: MembershipPlan | null
}

export function PlanStatusDialog({
  isOpen,
  onClose,
  onSuccess,
  plan,
}: PlanStatusDialogProps) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !plan) return null

  const isDeactivating = plan.is_active

  async function handleToggleStatus() {
    if (!plan) return
    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to perform this action.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (isDeactivating) {
        await archiveMembershipPlan(token, plan.id)
      } else {
        await reactivateMembershipPlan(token, plan.id)
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isDeactivating ? 'deactivate' : 'reactivate'} plan.`,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-status-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div className="flex items-center gap-2">
            {isDeactivating ? (
              <div className="text-amber-400">
                <AlertTriangle size={20} />
              </div>
            ) : (
              <div className="text-emerald-400">
                <CheckCircle size={20} />
              </div>
            )}
            <h2 id="plan-status-dialog-title" className="text-base font-bold text-white">
              {isDeactivating ? 'Deactivate Plan' : 'Reactivate Plan'}
            </h2>
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

        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>
            Are you sure you want to {isDeactivating ? 'deactivate' : 'reactivate'}{' '}
            <strong className="text-white">{plan.name}</strong>?
          </p>
          <p className="text-xs text-zinc-500">
            {isDeactivating
              ? 'This plan will be hidden from new membership selections. All existing and historical memberships referencing this plan remain completely intact and unaltered.'
              : 'This plan will once again be available when issuing or renewing memberships.'}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/[.07] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[.06] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 ${
              isDeactivating
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 focus:ring-amber-500/50'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 focus:ring-emerald-500/50'
            }`}
          >
            {loading
              ? isDeactivating
                ? 'Deactivating...'
                : 'Reactivating...'
              : isDeactivating
                ? 'Deactivate Plan'
                : 'Reactivate Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
