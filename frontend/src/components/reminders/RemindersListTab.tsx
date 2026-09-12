import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Filter,
  MessageCircle,
  Play,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '../Button'
import { Card } from '../Card'
import { useAuth } from '../../hooks/useAuth'
import {
  cancelReminder,
  retryReminder,
  sendReminder,
  triggerGenerate,
  triggerProcess,
  triggerRun,
} from '../../services/remindersService'
import type {
  ReminderFilters,
  ReminderItem,
  ReminderStage,
  ReminderStatsSummary,
} from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface RemindersListTabProps {
  reminders: ReminderItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  stats: ReminderStatsSummary
  filters: ReminderFilters
  onFilterChange: (filters: Partial<ReminderFilters>) => void
  onRefresh: () => void
  loading: boolean
}

export function RemindersListTab({
  reminders,
  total,
  page,
  limit,
  totalPages,
  stats,
  filters,
  onFilterChange,
  onRefresh,
  loading,
}: RemindersListTabProps) {
  const { isOwner, session } = useAuth()
  const token = session?.access_token

  const [engineActionLoading, setEngineActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [itemActionId, setItemActionId] = useState<string | null>(null)

  function showMessage(msg: string) {
    setActionMessage(msg)
    setErrorMessage(null)
    setTimeout(() => setActionMessage(null), 5000)
  }

  function showError(err: unknown) {
    setErrorMessage(err instanceof Error ? err.message : 'Action failed.')
    setActionMessage(null)
  }

  async function handleGenerate() {
    if (!token || !isOwner) return
    setEngineActionLoading(true)
    try {
      const res = await triggerGenerate(token)
      showMessage(res.message)
      onRefresh()
    } catch (err) {
      showError(err)
    } finally {
      setEngineActionLoading(false)
    }
  }

  async function handleProcess() {
    if (!token || !isOwner) return
    setEngineActionLoading(true)
    try {
      const res = await triggerProcess(token)
      showMessage(res.message)
      onRefresh()
    } catch (err) {
      showError(err)
    } finally {
      setEngineActionLoading(false)
    }
  }

  async function handleRunCombined() {
    if (!token || !isOwner) return
    setEngineActionLoading(true)
    try {
      const res = await triggerRun(token)
      showMessage(res.message)
      onRefresh()
    } catch (err) {
      showError(err)
    } finally {
      setEngineActionLoading(false)
    }
  }

  async function handleSendItem(id: string) {
    if (!token) return
    setItemActionId(id)
    try {
      const res = await sendReminder(token, id)
      showMessage(res.message)
      onRefresh()
    } catch (err) {
      showError(err)
    } finally {
      setItemActionId(null)
    }
  }

  async function handleRetryItem(id: string) {
    if (!token) return
    setItemActionId(id)
    try {
      const res = await retryReminder(token, id)
      showMessage(res.message)
      onRefresh()
    } catch (err) {
      showError(err)
    } finally {
      setItemActionId(null)
    }
  }

  async function handleCancelItem(id: string) {
    if (!token || !isOwner) return
    if (!confirm('Are you sure you want to cancel this scheduled reminder?')) return
    setItemActionId(id)
    try {
      await cancelReminder(token, id)
      showMessage('Reminder cancelled.')
      onRefresh()
    } catch (err) {
      showError(err)
    } finally {
      setItemActionId(null)
    }
  }

  function formatDateTime(isoStr: string) {
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

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Scheduled Queue
            </span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{stats.scheduledCount}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Pending simulated dispatch</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Sent (Simulated)
            </span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{stats.sentCount}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Dispatched via mock provider</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Failed (Simulated)
            </span>
            <AlertCircle size={16} className="text-brand" />
          </div>
          <p className="mt-2 text-2xl font-bold text-brand">{stats.failedCount}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Invalid format or simulated error</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-zinc-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Total Generated
            </span>
            <Bell size={16} className="text-zinc-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{stats.totalCount}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Idempotent candidate records</p>
        </Card>
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-950/30 p-3 text-xs text-red-300">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Engine Controls & Filter Bar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
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

          {/* Engine Action Buttons (Owner Only) */}
          {isOwner && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={engineActionLoading}
                onClick={handleGenerate}
                className="flex items-center gap-1.5 text-xs py-2"
                title="Scans memberships for 7-day, 1-day, expired, due, overdue candidates"
              >
                <RefreshCw size={13} className={engineActionLoading ? 'animate-spin' : ''} />
                Scan & Generate
              </Button>

              <button
                type="button"
                disabled={engineActionLoading || stats.scheduledCount === 0}
                onClick={handleProcess}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white disabled:opacity-50"
                title="Dispatches scheduled reminders through simulated mock provider"
              >
                <Send size={13} />
                Process Queue ({stats.scheduledCount})
              </button>

              <button
                type="button"
                disabled={engineActionLoading}
                onClick={handleRunCombined}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.05] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[.09] hover:text-white disabled:opacity-50"
                title="Runs scan and processing in a single trigger"
              >
                <Play size={13} />
                Run Engine
              </button>
            </div>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="grid gap-2 sm:grid-cols-3 pt-2 border-t border-white/[.06]">
          {/* Stage Filter */}
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

          {/* Status Filter */}
          <select
            value={filters.status || 'all'}
            onChange={e => onFilterChange({ status: e.target.value, page: 1 })}
            className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-brand/70"
          >
            <option value="all" className="bg-[#1C1C1F]">All Statuses</option>
            <option value="scheduled" className="bg-[#1C1C1F]">Scheduled</option>
            <option value="sent" className="bg-[#1C1C1F]">Sent</option>
            <option value="delivered" className="bg-[#1C1C1F]">Delivered</option>
            <option value="read" className="bg-[#1C1C1F]">Read</option>
            <option value="failed" className="bg-[#1C1C1F]">Failed</option>
            <option value="cancelled" className="bg-[#1C1C1F]">Cancelled</option>
          </select>

          {/* Channel Filter */}
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

      {/* Reminders Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-white/[.07] bg-white/[.02] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Scheduled At</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.05]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading reminders…
                  </td>
                </tr>
              ) : reminders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No reminders matching criteria. Click &ldquo;Scan & Generate&rdquo; above to run candidate detection.
                  </td>
                </tr>
              ) : (
                reminders.map(r => {
                  const stageLabel = REMINDER_STAGE_LABELS[r.reminder_stage as ReminderStage] || r.reminder_stage
                  const isWhatsApp = r.channel === 'whatsapp'
                  const isActioning = itemActionId === r.id

                  return (
                    <tr key={r.id} className="transition hover:bg-white/[.02]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{r.member_name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {r.member_code} · {r.member_phone}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-zinc-200">
                        {stageLabel}
                        <div className="text-[11px] text-zinc-500">{r.plan_name}</div>
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
                          {r.channel.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-zinc-400">
                        {formatDateTime(r.scheduled_at)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            r.status === 'scheduled'
                              ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                              : r.status === 'sent'
                              ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                              : r.status === 'delivered'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                              : r.status === 'read'
                              ? 'border-teal-500/20 bg-teal-500/10 text-teal-300'
                              : r.status === 'failed'
                              ? 'border-red-800/40 bg-red-950/30 text-brand'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {r.status === 'sent' ? (
                            <>
                              <CheckCircle2 size={10} />
                              {r.is_simulated ? 'Sent (Simulated)' : 'Sent'}
                            </>
                          ) : r.status === 'delivered' ? (
                            <>
                              <CheckCircle2 size={10} />
                              Delivered
                            </>
                          ) : r.status === 'read' ? (
                            <>
                              <CheckCircle2 size={10} />
                              Read
                            </>
                          ) : r.status === 'failed' ? (
                            <>
                              <XCircle size={10} />
                              {r.is_simulated ? 'Failed (Simulated)' : 'Failed'}
                            </>
                          ) : r.status === 'scheduled' ? (
                            <>
                              <Clock size={10} />
                              Scheduled
                            </>
                          ) : (
                            'Cancelled'
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {r.status === 'scheduled' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleSendItem(r.id)}
                              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white disabled:opacity-50"
                              title="Send reminder"
                            >
                              {isActioning ? 'Sending…' : 'Send'}
                            </button>
                            {isOwner && (
                              <button
                                type="button"
                                disabled={isActioning}
                                onClick={() => handleCancelItem(r.id)}
                                className="rounded border border-white/10 bg-white/[.04] px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-white/[.08] hover:text-white disabled:opacity-50"
                                title="Cancel reminder"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ) : r.status === 'failed' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleRetryItem(r.id)}
                              className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/20 hover:text-white disabled:opacity-50"
                              title="Retry failed reminder"
                            >
                              {isActioning ? 'Retrying…' : 'Retry'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-600">—</span>
                        )}
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
              Showing {reminders.length} of {total} reminders
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
    </div>
  )
}
