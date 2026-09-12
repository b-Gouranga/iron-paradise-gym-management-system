import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  History,
  MessageCircle,
  RotateCcw,
  Smartphone,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Card } from '../Card'
import { useAuth } from '../../hooks/useAuth'
import { useMemberReminders } from '../../hooks/useMemberReminders'
import { retryReminder } from '../../services/remindersService'
import type { ReminderStage } from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface MemberRemindersCardProps {
  memberId: string
  memberName: string
}

export function MemberRemindersCard({ memberId, memberName }: MemberRemindersCardProps) {
  const { session } = useAuth()
  const token = session?.access_token
  const { reminders, history, loading, error, refresh } = useMemberReminders(memberId)
  const [activeTab, setActiveTab] = useState<'reminders' | 'history'>('reminders')
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function formatDate(isoStr: string | null) {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return isoStr
    }
  }

  async function handleRetry(reminderId: string) {
    if (!token) return
    setRetryingId(reminderId)
    setActionError(null)
    try {
      await retryReminder(token, reminderId)
      refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to retry reminder.')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">Automated Reminders</h3>
        </div>

        {/* Tab switch */}
        <div className="flex items-center rounded-lg border border-white/10 bg-white/[.03] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('reminders')}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              activeTab === 'reminders'
                ? 'bg-brand/20 text-brand font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Reminders ({reminders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              activeTab === 'history'
                ? 'bg-brand/20 text-brand font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            History ({history.length})
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className="mt-3 rounded-lg border border-red-800/40 bg-red-950/30 p-2.5 text-xs text-red-300">
          {error || actionError}
        </div>
      )}

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-500">Loading reminder records…</div>
        ) : activeTab === 'reminders' ? (
          reminders.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No reminders currently scheduled or generated for {memberName}.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {reminders.map(r => {
                const stageLabel = REMINDER_STAGE_LABELS[r.reminder_stage as ReminderStage] || r.reminder_stage
                const isWhatsApp = r.channel === 'whatsapp'

                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-white/[.06] bg-white/[.02] p-3 transition hover:border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs">{stageLabel}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${
                          isWhatsApp
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {isWhatsApp ? <MessageCircle size={10} /> : <Smartphone size={10} />}
                        {r.channel.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Scheduled: {formatDate(r.scheduled_at)}</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            r.status === 'scheduled'
                              ? 'bg-amber-500/10 text-amber-300'
                              : r.status === 'sent'
                              ? 'bg-blue-500/10 text-blue-400'
                              : r.status === 'delivered'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : r.status === 'read'
                              ? 'bg-teal-500/10 text-teal-300'
                              : r.status === 'failed'
                              ? 'bg-red-950/30 text-brand'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {r.status === 'scheduled' && <Clock size={9} />}
                          {r.status === 'sent' && <CheckCircle2 size={9} />}
                          {r.status === 'delivered' && <CheckCircle2 size={9} />}
                          {r.status === 'read' && <CheckCircle2 size={9} />}
                          {r.status === 'failed' && <XCircle size={9} />}
                          {r.status === 'sent'
                            ? r.is_simulated ? 'Sent (Simulated)' : 'Sent'
                            : r.status === 'delivered'
                            ? 'Delivered'
                            : r.status === 'read'
                            ? 'Read'
                            : r.status === 'failed'
                            ? r.is_simulated ? 'Failed (Simulated)' : 'Failed'
                            : r.status === 'scheduled'
                            ? 'Scheduled'
                            : 'Cancelled'}
                        </span>
                        {r.status === 'failed' && (
                          <button
                            type="button"
                            disabled={retryingId === r.id}
                            onClick={() => handleRetry(r.id)}
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50"
                          >
                            <RotateCcw size={9} />
                            {retryingId === r.id ? 'Retrying…' : 'Retry'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            No message history recorded yet for {memberName}.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {history.map(h => {
              const isWhatsApp = h.channel === 'whatsapp'
              const isFailed = h.status === 'failed'

              return (
                <div
                  key={h.id}
                  className="rounded-xl border border-white/[.06] bg-white/[.02] p-3 transition hover:border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${
                        isWhatsApp
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {isWhatsApp ? <MessageCircle size={10} /> : <Smartphone size={10} />}
                      {h.channel.toUpperCase()}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                        isFailed
                          ? 'border-red-800/40 bg-red-950/30 text-brand'
                          : h.status === 'sent'
                          ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                          : h.status === 'delivered'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : h.status === 'read'
                          ? 'border-teal-500/20 bg-teal-500/10 text-teal-300'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isFailed ? <XCircle size={9} /> : <CheckCircle2 size={9} />}
                      {isFailed
                        ? h.is_simulated ? 'Failed (Simulated)' : 'Failed'
                        : h.status === 'sent'
                        ? h.is_simulated ? 'Sent (Simulated)' : 'Sent'
                        : h.status === 'delivered'
                        ? 'Delivered'
                        : h.status === 'read'
                        ? 'Read'
                        : h.status}
                    </span>
                  </div>

                  <p className="mt-2 rounded bg-black/40 p-2 text-[11px] text-zinc-300 line-clamp-3 leading-relaxed">
                    {h.message}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Sent: {formatDate(h.sent_at)}</span>
                    <span className="font-mono">{h.provider_message_id}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
