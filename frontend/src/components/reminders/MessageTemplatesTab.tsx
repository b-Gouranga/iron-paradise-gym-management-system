import { Edit3, Eye, FileText, MessageCircle, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { TemplateEditModal } from './TemplateEditModal'
import { TemplatePreviewModal } from './TemplatePreviewModal'
import type { MessageTemplate, ReminderStage } from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface MessageTemplatesTabProps {
  templates: MessageTemplate[]
  onUpdated: () => void
}

export function MessageTemplatesTab({ templates, onUpdated }: MessageTemplatesTabProps) {
  const { isOwner } = useAuth()
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null)
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/10 bg-white/[.02] p-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText size={16} className="text-brand" />
            Database-Backed Message Templates
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Templates support dynamic placeholders: <code className="text-zinc-300">{'{{member_name}}'}</code>, <code className="text-zinc-300">{'{{membership_plan}}'}</code>, <code className="text-zinc-300">{'{{expiry_date}}'}</code>, <code className="text-zinc-300">{'{{pending_amount}}'}</code>, <code className="text-zinc-300">{'{{payment_due_date}}'}</code>, and <code className="text-zinc-300">{'{{gym_name}}'}</code>.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map(t => {
          const isWhatsApp = t.channel === 'whatsapp'
          const stageLabel = REMINDER_STAGE_LABELS[t.reminder_stage as ReminderStage] || t.reminder_stage

          return (
            <div
              key={t.id}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[.03] p-4 transition hover:border-white/20"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">{stageLabel}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${
                      isWhatsApp
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    {isWhatsApp ? <MessageCircle size={11} /> : <Smartphone size={11} />}
                    {t.channel.toUpperCase()}
                  </span>
                </div>

                <div className="mt-3 rounded-lg border border-white/[.05] bg-black/40 p-3">
                  <p className="text-xs leading-relaxed text-zinc-300 font-sans whitespace-pre-wrap line-clamp-4">
                    {t.body}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/[.06] pt-3">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(t)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[.08] hover:text-white"
                >
                  <Eye size={13} />
                  Preview
                </button>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setEditTemplate(t)}
                    className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-brand/20 hover:text-white"
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Preview Modal */}
      <TemplatePreviewModal
        isOpen={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        template={previewTemplate}
      />

      {/* Edit Modal */}
      <TemplateEditModal
        isOpen={Boolean(editTemplate)}
        onClose={() => setEditTemplate(null)}
        onSuccess={onUpdated}
        template={editTemplate}
      />
    </div>
  )
}
