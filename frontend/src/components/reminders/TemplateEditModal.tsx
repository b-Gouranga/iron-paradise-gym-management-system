import { AlertTriangle, Edit3, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { useAuth } from '../../hooks/useAuth'
import { updateMessageTemplate } from '../../services/remindersService'
import type { MessageTemplate, ReminderStage } from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface TemplateEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  template: MessageTemplate | null
}

const TEMPLATE_VARIABLES = [
  { tag: '{{member_name}}', desc: 'Member full name' },
  { tag: '{{membership_plan}}', desc: 'Plan name' },
  { tag: '{{expiry_date}}', desc: 'Membership expiry date' },
  { tag: '{{pending_amount}}', desc: 'Pending fee balance' },
  { tag: '{{payment_due_date}}', desc: 'Payment due date' },
  { tag: '{{gym_name}}', desc: 'Gym name' },
]

export function TemplateEditModal({
  isOpen,
  onClose,
  onSuccess,
  template,
}: TemplateEditModalProps) {
  const { session } = useAuth()
  const [body, setBody] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !template) return
    setBody(template.body)
    setError(null)
  }, [isOpen, template])

  if (!isOpen || !template) return null

  function insertVariable(tag: string) {
    setBody(prev => `${prev} ${tag}`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) {
      setError('Template body cannot be empty.')
      return
    }

    if (!session?.access_token) {
      setError('You must be logged in as Owner to update templates.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await updateMessageTemplate(session.access_token, template!.id, {
        body: body.trim(),
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template.')
    } finally {
      setSubmitting(false)
    }
  }

  const stageLabel = REMINDER_STAGE_LABELS[template.reminder_stage as ReminderStage] || template.reminder_stage

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/20 text-brand">
              <Edit3 size={18} />
            </span>
            <div>
              <h2 id="template-edit-title" className="text-base font-bold text-white">
                Edit Template ({template.channel.toUpperCase()})
              </h2>
              <p className="text-xs text-zinc-400">{stageLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit dialog"
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-xs text-red-300">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Quick Variable Insert Chips */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Available Variables (Click to insert)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map(v => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  title={v.desc}
                  className="rounded-md border border-white/10 bg-white/[.04] px-2 py-1 font-mono text-[11px] text-zinc-300 hover:border-brand/50 hover:bg-brand/10 hover:text-white transition"
                >
                  {v.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Template Body Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Template Message Body <span className="text-brand">*</span>
              </label>
              <span className="text-[11px] text-zinc-500">{body.length} characters</span>
            </div>
            <textarea
              rows={5}
              required
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Type your message template here. Use {{variable_name}} placeholders."
              className="w-full rounded-lg border border-white/10 bg-white/[.04] p-3 text-sm text-white outline-none transition focus:border-brand/70 font-sans leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[.07]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[.08] hover:text-white"
            >
              Cancel
            </button>
            <Button type="submit" disabled={submitting} className="text-xs">
              {submitting ? 'Saving…' : 'Save Template'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
