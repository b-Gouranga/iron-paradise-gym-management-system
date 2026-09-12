import { AlertTriangle, CheckCircle2, Loader2, MessageCircle, Smartphone, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '../Button'
import { useAuth } from '../../hooks/useAuth'
import { manualSendReminder } from '../../services/remindersService'
import type { ReminderStage } from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface SendManualReminderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  memberId: string
  memberName: string
  memberCode: string
  memberPhone: string
  whatsappOptIn?: boolean
}

export function SendManualReminderModal({
  isOpen,
  onClose,
  onSuccess,
  memberId,
  memberName,
  memberCode,
  memberPhone,
  whatsappOptIn,
}: SendManualReminderModalProps) {
  const { session } = useAuth()
  const [stage, setStage] = useState<ReminderStage>('membership_expiry_7_days')
  const [loading, setLoading] = useState(false)
  const isSubmittingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleSend() {
    if (isSubmittingRef.current || loading) {
      return
    }

    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to perform this action.')
      return
    }

    if (!whatsappOptIn) {
      setError('Member has not opted in to WhatsApp reminders. Consent is required before dispatching.')
      return
    }

    isSubmittingRef.current = true
    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await manualSendReminder(token, {
        memberId,
        reminderStage: stage,
        channel: 'whatsapp',
      })
      setSuccessMsg(res.message || 'WhatsApp reminder dispatched successfully.')
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err) {
      isSubmittingRef.current = false
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to send manual WhatsApp reminder.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-reminder-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={loading ? undefined : onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <MessageCircle size={20} />
            <h2 id="manual-reminder-title" className="text-base font-bold text-white">
              Send WhatsApp Reminder
            </h2>
          </div>
          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Member summary */}
        <div className="mt-4 rounded-xl border border-white/[.06] bg-white/[.02] p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white text-sm">{memberName}</span>
            <span className="font-mono text-zinc-400">{memberCode}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Smartphone size={12} /> {memberPhone}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                whatsappOptIn
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {whatsappOptIn ? 'Opted In' : 'Not Opted In'}
            </span>
          </div>
        </div>

        {!whatsappOptIn && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <p className="font-semibold">Consent Notice:</p>
            <p className="mt-0.5 text-zinc-300">
              This member has not opted in to WhatsApp reminders. To comply with Meta policies, please edit the member profile and enable WhatsApp Opt-In with their consent before dispatching.
            </p>
          </div>
        )}

        {/* Form */}
        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Select Reminder Stage
            </label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value as ReminderStage)}
              className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/70"
            >
              {(Object.keys(REMINDER_STAGE_LABELS) as ReminderStage[]).map(key => (
                <option key={key} value={key} className="bg-[#1C1C1F]">
                  {REMINDER_STAGE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-zinc-500">
            Dispatches via the active WhatsApp provider (Meta WhatsApp Cloud API in production, mock provider in development/test).
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/[.07] pt-4">
          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[.06] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={loading || !whatsappOptIn}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageCircle size={15} />
                Send WhatsApp Message
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
