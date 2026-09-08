import { MessageCircle, Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { previewTemplate } from '../../services/remindersService'
import type { MessageTemplate, ReminderStage } from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface TemplatePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  template: MessageTemplate | null
  memberId?: string
}

export function TemplatePreviewModal({
  isOpen,
  onClose,
  template,
  memberId,
}: TemplatePreviewModalProps) {
  const { session } = useAuth()
  const [rendered, setRendered] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !template || !session?.access_token) return
    setLoading(true)
    setError(null)

    previewTemplate(session.access_token, template.body, memberId)
      .then(res => {
        setRendered(res.rendered)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to preview template.')
        setLoading(false)
      })
  }, [isOpen, template, memberId, session?.access_token])

  if (!isOpen || !template) return null

  const isWhatsApp = template.channel === 'whatsapp'
  const stageLabel = REMINDER_STAGE_LABELS[template.reminder_stage as ReminderStage] || template.reminder_stage

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" />

      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                isWhatsApp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {isWhatsApp ? <MessageCircle size={18} /> : <Smartphone size={18} />}
            </span>
            <div>
              <h2 id="template-preview-title" className="text-base font-bold text-white">
                {isWhatsApp ? 'WhatsApp Preview' : 'SMS Preview'}
              </h2>
              <p className="text-xs text-zinc-400">{stageLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-center">
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
            Simulated Preview (Development Mock Provider)
          </span>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Variables are interpolated with sample member and gym information.
          </p>
        </div>

        {/* Message Bubble Preview */}
        <div className="mt-5">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500">Rendering preview…</div>
          ) : error ? (
            <div className="rounded-lg border border-red-800/40 bg-red-950/30 p-3 text-xs text-red-300">
              {error}
            </div>
          ) : isWhatsApp ? (
            // WhatsApp Styled Bubble
            <div className="rounded-xl border border-emerald-500/20 bg-[#0B141A] p-4 text-sm shadow-inner">
              <div className="mb-2 flex items-center justify-between border-b border-emerald-500/10 pb-2 text-[11px] text-emerald-400/80">
                <span className="font-semibold tracking-wide">Iron Paradise Gym</span>
                <span>Verified Business</span>
              </div>
              <div className="rounded-lg bg-[#202C33] p-3 text-zinc-100 shadow-md whitespace-pre-wrap leading-relaxed">
                {rendered}
                <div className="mt-2 text-right text-[10px] text-zinc-400">10:30 AM · ✓✓</div>
              </div>
            </div>
          ) : (
            // SMS Styled Bubble
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 text-sm shadow-inner">
              <div className="mb-2 text-center text-[10px] text-zinc-500 font-medium">
                Today 10:30 AM · SMS from IRONPD
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-zinc-800 p-3 text-zinc-100 shadow whitespace-pre-wrap leading-relaxed">
                {rendered}
              </div>
            </div>
          )}
        </div>

        {/* Raw Template Source */}
        <div className="mt-5 rounded-lg border border-white/[.06] bg-white/[.02] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Raw Template Template Body
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-400 break-words">{template.body}</p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[.08] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
