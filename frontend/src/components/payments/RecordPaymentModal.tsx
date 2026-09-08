import { AlertTriangle, CheckCircle2, IndianRupee, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { useAuth } from '../../hooks/useAuth'
import { fetchMembershipPayments, recordPayment } from '../../services/paymentsService'
import type {
  MembershipPaymentSummary,
  PaymentMethod,
  PaymentPurpose,
} from '../../types/payments'

export interface MembershipOption {
  id: string
  plan_name: string
  actual_fee: number
  pending_amount?: number
  expiry_date?: string
  status: string
}

interface RecordPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  memberId: string
  memberName: string
  memberships: MembershipOption[]
  preselectedMembershipId?: string
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  memberId,
  memberName,
  memberships,
  preselectedMembershipId,
}: RecordPaymentModalProps) {
  const { session } = useAuth()

  const [selectedMembershipId, setSelectedMembershipId] = useState<string>('')
  const [membershipSummary, setMembershipSummary] = useState<MembershipPaymentSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [purpose, setPurpose] = useState<PaymentPurpose>('partial_payment')
  const [notes, setNotes] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize or update selected membership
  useEffect(() => {
    if (!isOpen) return

    const initialId =
      preselectedMembershipId && memberships.some(m => m.id === preselectedMembershipId)
        ? preselectedMembershipId
        : memberships[0]?.id ?? ''

    setSelectedMembershipId(initialId)
    setPaymentDate(new Date().toISOString().split('T')[0])
    setNotes('')
    setError(null)
  }, [isOpen, preselectedMembershipId, memberships])

  // Fetch real-time balance summary whenever selectedMembershipId changes
  useEffect(() => {
    if (!isOpen || !selectedMembershipId || !session?.access_token) {
      setMembershipSummary(null)
      return
    }

    let cancelled = false
    setLoadingSummary(true)

    fetchMembershipPayments(session.access_token, selectedMembershipId)
      .then(res => {
        if (!cancelled) {
          setMembershipSummary(res.summary)
          // Default amount to the pending amount (if > 0)
          if (res.summary.pending_amount > 0) {
            setAmount(String(res.summary.pending_amount))
            if (res.summary.total_paid === 0) {
              setPurpose('new_membership')
            } else {
              setPurpose('pending_fee')
            }
          } else {
            setAmount('0')
          }
          setLoadingSummary(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch membership financial details.')
          setLoadingSummary(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, selectedMembershipId, session?.access_token])

  if (!isOpen) return null

  const pendingAmount = membershipSummary?.pending_amount ?? 0
  const isFullyPaid = membershipSummary !== null && pendingAmount <= 0
  const numAmount = Number(amount)
  const isOverpaying = !isNaN(numAmount) && numAmount > pendingAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedMembershipId) {
      setError('Please select a membership.')
      return
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive payment amount.')
      return
    }

    if (membershipSummary && numAmount > membershipSummary.pending_amount) {
      setError(
        `Payment amount (₹${numAmount.toLocaleString('en-IN')}) cannot exceed the remaining pending balance of ₹${membershipSummary.pending_amount.toLocaleString('en-IN')}.`
      )
      return
    }

    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to record payments.')
      return
    }

    setSubmitting(true)
    try {
      await recordPayment(token, selectedMembershipId, {
        membership_id: selectedMembershipId,
        amount: Math.round(numAmount * 100) / 100,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        purpose,
        notes: notes.trim() || null,
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div>
            <h2 id="record-payment-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20 text-brand">
                <IndianRupee size={16} />
              </span>
              Record Manual Payment
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Record money collected manually for <strong className="text-zinc-200">{memberName}</strong>.
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Target Membership Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Target Membership <span className="text-brand">*</span>
            </label>
            {memberships.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[.03] p-3 text-xs text-zinc-400">
                No memberships found for this member. A membership must exist before recording payment.
              </div>
            ) : (
              <select
                required
                value={selectedMembershipId}
                onChange={e => setSelectedMembershipId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand/70"
              >
                {memberships.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#1C1C1F] text-white">
                    {m.plan_name} — Fee: ₹{m.actual_fee.toLocaleString('en-IN')} ({m.status.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Real-time Financial Balance Summary */}
          {membershipSummary && (
            <div className="rounded-xl border border-white/[.08] bg-white/[.03] p-3.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="font-semibold uppercase tracking-wider text-zinc-500">
                  Membership Balance
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold text-[10px] ${
                    isFullyPaid
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {isFullyPaid && <CheckCircle2 size={11} />}
                  {membershipSummary.payment_status}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/[.02] p-2">
                  <span className="text-[10px] text-zinc-500 uppercase block">Actual Fee</span>
                  <span className="font-semibold text-white">₹{membershipSummary.actual_fee.toLocaleString('en-IN')}</span>
                </div>
                <div className="rounded-lg bg-white/[.02] p-2">
                  <span className="text-[10px] text-zinc-500 uppercase block">Total Paid</span>
                  <span className="font-semibold text-emerald-400">₹{membershipSummary.total_paid.toLocaleString('en-IN')}</span>
                </div>
                <div className="rounded-lg bg-white/[.02] p-2">
                  <span className="text-[10px] text-zinc-500 uppercase block">Remaining Due</span>
                  <span className="font-semibold text-brand">₹{membershipSummary.pending_amount.toLocaleString('en-IN')}</span>
                </div>
              </div>
              {membershipSummary.payment_due_date && (
                <div className="mt-2 text-[11px] text-zinc-400">
                  Due Date: <span className="text-zinc-300 font-medium">{membershipSummary.payment_due_date}</span>
                </div>
              )}
            </div>
          )}

          {isFullyPaid && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-400">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
              <p>This membership is already completely paid. No further payments can be accepted for it.</p>
            </div>
          )}

          {/* Amount and Payment Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Amount Collected (₹) <span className="text-brand">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={membershipSummary ? membershipSummary.pending_amount : undefined}
                required
                disabled={isFullyPaid || loadingSummary}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 2000"
              />
              {isOverpaying && (
                <p className="mt-1 text-[11px] text-red-400">
                  Amount exceeds remaining balance of ₹{pendingAmount.toLocaleString('en-IN')}.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Payment Date <span className="text-brand">*</span>
              </label>
              <Input
                type="date"
                required
                disabled={isFullyPaid}
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Method and Purpose */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Payment Method <span className="text-brand">*</span>
              </label>
              <select
                required
                disabled={isFullyPaid}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand/70"
              >
                <option value="cash" className="bg-[#1C1C1F] text-white">Cash</option>
                <option value="upi" className="bg-[#1C1C1F] text-white">UPI / QR Code</option>
                <option value="card" className="bg-[#1C1C1F] text-white">Debit / Credit Card (POS)</option>
                <option value="bank_transfer" className="bg-[#1C1C1F] text-white">Bank Transfer / IMPS</option>
                <option value="other" className="bg-[#1C1C1F] text-white">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Purpose <span className="text-brand">*</span>
              </label>
              <select
                required
                disabled={isFullyPaid}
                value={purpose}
                onChange={e => setPurpose(e.target.value as PaymentPurpose)}
                className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand/70"
              >
                <option value="new_membership" className="bg-[#1C1C1F] text-white">New Membership</option>
                <option value="renewal" className="bg-[#1C1C1F] text-white">Renewal</option>
                <option value="partial_payment" className="bg-[#1C1C1F] text-white">Partial Payment</option>
                <option value="pending_fee" className="bg-[#1C1C1F] text-white">Pending Fee</option>
                <option value="other" className="bg-[#1C1C1F] text-white">Other</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Notes / Transaction Reference <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              disabled={isFullyPaid}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. UPI Ref #4029104812, Receipt #104, Paid in cash"
              className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand/70"
            />
          </div>

          {/* System note */}
          <div className="flex items-start gap-2 rounded-lg border border-white/[.06] bg-white/[.02] p-3 text-xs text-zinc-400">
            <Info size={15} className="mt-0.5 shrink-0 text-zinc-400" />
            <p>
              Manual transaction recording only. This record is permanently preserved in the gym's financial history and cannot be casually deleted.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-white/[.07] pt-4">
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
              disabled={submitting || isFullyPaid || isOverpaying || !selectedMembershipId || loadingSummary}
            >
              {submitting ? 'Recording…' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
