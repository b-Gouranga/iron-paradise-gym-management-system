import {
  AlertCircle,
  CheckCircle2,
  Eye,
  History,
  MessageCircle,
  Search,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Card } from '../Card'
import type {
  HistoryFilters,
  MessageHistoryItem,
  ReminderStage,
} from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface MessageHistoryTabProps {
  history: MessageHistoryItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  filters: HistoryFilters
  onFilterChange: (filters: Partial<HistoryFilters>) => void
  loading: boolean
}

export function MessageHistoryTab({
  history,
  total,
  page,
  limit,
  totalPages,
  filters,
  onFilterChange,
  loading,
}: MessageHistoryTabProps) {
  const [selectedMessage, setSelectedMessage] = useState<MessageHistoryItem | null>(null)

  function formatDateTime(isoStr: string | null) {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search member name or member code…"
              value={filters.q || ''}
              onChange={e => onFilterChange({ q: e.target.value, page: 1 })}
              className="w-full rounded-lg border border-white/10 bg-white/[.04] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-brand/70"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              Total Logged: <strong className="text-zinc-200">{total}</strong>
            </span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 pt-2 border-t border-white/[.06]">
          {/* Stage filter */}
          <select
            value={filters.stage || 'all'}
            onChange={e => onFilterChange({ stage: e.target.value, page: 1 })}
            className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-brand/70"
          >
            <option value="all" className="bg-[#1C1C1F]">All Stages</option>
            <option value="membership_expiry_7_days" className="bg-[#1C1C1F]">7 Days Before Expiry</option>
            <option value="membership_expiry_1_day" className="bg-[#1C1C1F]">1 Day Before Expiry</option>
            <option value="membership_expired" className="bg-[#1C1C1F]">After Expiry</option>
            <option value="payment_due" className="bg-[#1C1C1F]">Payment Due</option>
            <option value="payment_overdue" className="bg-[#1C1C1F]">Payment Overdue</option>
          </select>

          {/* Status filter */}
          <select
            value={filters.status || 'all'}
            onChange={e => onFilterChange({ status: e.target.value, page: 1 })}
            className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-brand/70"
          >
            <option value="all" className="bg-[#1C1C1F]">All Statuses</option>
            <option value="sent" className="bg-[#1C1C1F]">Sent</option>
            <option value="delivered" className="bg-[#1C1C1F]">Delivered</option>
            <option value="read" className="bg-[#1C1C1F]">Read</option>
            <option value="failed" className="bg-[#1C1C1F]">Failed</option>
          </select>

          {/* Channel filter */}
          <select
            value={filters.channel || 'all'}
            onChange={e => onFilterChange({ channel: e.target.value, page: 1 })}
            className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-brand/70"
          >
            <option value="all" className="bg-[#1C1C1F]">All Channels</option>
            <option value="whatsapp" className="bg-[#1C1C1F]">WhatsApp</option>
          </select>
        </div>
      </Card>

      {/* History Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-white/[.07] bg-white/[.02] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Stage & Plan</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Message Preview</th>
                <th className="px-4 py-3">Sent At</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provider ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.05]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    Loading message history…
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No message history recorded yet. Messages dispatched by the reminder engine will appear here.
                  </td>
                </tr>
              ) : (
                history.map(h => {
                  const stageLabel = REMINDER_STAGE_LABELS[h.reminder_stage as ReminderStage] || h.reminder_stage
                  const isWhatsApp = h.channel === 'whatsapp'
                  const isFailed = h.status === 'failed'

                  return (
                    <tr key={h.id} className="transition hover:bg-white/[.02]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{h.member_name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {h.member_code} · {h.member_phone}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-zinc-200">
                        {stageLabel}
                        <div className="text-[11px] text-zinc-500">{h.plan_name}</div>
                      </td>

                      <td className="px-4 py-3">
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
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs text-zinc-400">{h.message}</p>
                          <button
                            type="button"
                            onClick={() => setSelectedMessage(h)}
                            className="rounded p-1 text-zinc-500 hover:text-white"
                            title="View full message"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                        {formatDateTime(h.sent_at)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            h.status === 'failed'
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
                          {h.status === 'failed' ? (
                            <>
                              <XCircle size={10} />
                              {h.is_simulated ? 'Failed (Simulated)' : 'Failed'}
                            </>
                          ) : h.status === 'sent' ? (
                            <>
                              <CheckCircle2 size={10} />
                              {h.is_simulated ? 'Sent (Simulated)' : 'Sent'}
                            </>
                          ) : h.status === 'delivered' ? (
                            <>
                              <CheckCircle2 size={10} />
                              Delivered
                            </>
                          ) : h.status === 'read' ? (
                            <>
                              <CheckCircle2 size={10} />
                              Read
                            </>
                          ) : (
                            h.status
                          )}
                        </span>
                        {h.failure_reason && (
                          <div className="mt-1 text-[10px] text-red-400 truncate max-w-[160px]" title={h.failure_reason}>
                            {h.failure_reason}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 truncate max-w-[140px]" title={h.provider_message_id || ''}>
                        {h.provider_message_id ?? '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[.07] px-4 py-3 text-xs text-zinc-400">
            <span>
              Showing {history.length} of {total} history entries
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onFilterChange({ page: page - 1 })}
                className="rounded border border-white/10 bg-white/[.04] px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-mono text-[11px]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onFilterChange({ page: page + 1 })}
                className="rounded border border-white/10 bg-white/[.04] px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Message Inspect Modal */}
      {selectedMessage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={() => setSelectedMessage(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Dispatched Message Detail</h3>
                <p className="text-xs text-zinc-400">{selectedMessage.member_name} ({selectedMessage.channel.toUpperCase()})</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {selectedMessage.message}
            </div>

            <div className="mt-4 space-y-1.5 text-[11px] text-zinc-400">
              <div>Sent At: <span className="text-white">{formatDateTime(selectedMessage.sent_at)}</span></div>
              <div>Provider Message ID: <span className="font-mono text-zinc-300">{selectedMessage.provider_message_id}</span></div>
              <div>Delivery: <span className="text-amber-400 font-semibold">Simulated (Mock Provider)</span></div>
              {selectedMessage.failure_reason && (
                <div className="text-red-400">Failure Reason: {selectedMessage.failure_reason}</div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="rounded-lg border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
