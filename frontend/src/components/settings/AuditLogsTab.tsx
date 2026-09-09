import { useState, useEffect, useCallback } from 'react'
import { Card } from '../Card'
import { DataTable } from '../DataTable'
import { fetchAuditLogs } from '../../services/auditLogsService'
import type { AuditLogFilter, AuditLogItem, AuditLogPagination } from '../../types/audit'
import { Search, RotateCcw, ChevronDown, ChevronRight, ShieldAlert, FileText } from 'lucide-react'

interface AuditLogsTabProps {
  accessToken: string
}

function formatActionLabel(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getActionBadgeStyle(action: string): string {
  if (action.includes('created') || action.includes('activated') || action.includes('reactivated') || action === 'owner_setup') {
    return 'bg-emerald-400/10 text-emerald-300 border border-emerald-500/20'
  }
  if (action.includes('updated') || action.includes('changed') || action.includes('reset')) {
    return 'bg-amber-400/10 text-amber-300 border border-amber-500/20'
  }
  if (action.includes('deactivated') || action.includes('archived') || action.includes('cancelled')) {
    return 'bg-rose-400/10 text-rose-300 border border-rose-500/20'
  }
  return 'bg-zinc-500/15 text-zinc-300 border border-zinc-700/50'
}

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch {
    return isoString
  }
}

export function AuditLogsTab({ accessToken }: AuditLogsTabProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [pagination, setPagination] = useState<AuditLogPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters state
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const loadLogs = useCallback(
    async (pageToLoad = 1) => {
      if (!accessToken) return
      try {
        setLoading(true)
        setError(null)

        const filter: AuditLogFilter = {
          page: pageToLoad,
          limit: 20,
          search: search.trim() || undefined,
          action: action || undefined,
          entity_type: entityType || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }

        const res = await fetchAuditLogs(accessToken, filter)
        setLogs(res.data)
        setPagination(res.pagination)
      } catch (err: any) {
        setError(err.message || 'Failed to load audit logs.')
      } finally {
        setLoading(false)
      }
    },
    [accessToken, search, action, entityType, startDate, endDate],
  )

  useEffect(() => {
    loadLogs(1)
  }, [loadLogs])

  const handleReset = () => {
    setSearch('')
    setAction('')
    setEntityType('')
    setStartDate('')
    setEndDate('')
  }

  const headers = ['Timestamp', 'Staff Actor', 'Action', 'Entity', 'Details']

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-zinc-300">
        <div className="flex items-center gap-2 font-semibold text-brand">
          <ShieldAlert className="h-4 w-4" />
          <span>Immutable Audit Log Trail</span>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          All administrative, financial, member, and staff operations are permanently recorded with
          strict immutability guarantees. Passwords, tokens, and authorization secrets are scrubbed.
        </p>
      </div>

      {/* Filters Card */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Staff Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search staff name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900/60 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              aria-label="Filter by action"
              className="w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
            >
              <option value="">All Actions</option>
              <optgroup label="Members">
                <option value="member_created">Member Created</option>
                <option value="member_updated">Member Updated</option>
                <option value="member_archived">Member Archived</option>
              </optgroup>
              <optgroup label="Memberships">
                <option value="membership_created">Membership Created</option>
                <option value="membership_renewed">Membership Renewed</option>
                <option value="membership_cancelled">Membership Cancelled</option>
              </optgroup>
              <optgroup label="Payments">
                <option value="payment_recorded">Payment Recorded</option>
              </optgroup>
              <optgroup label="Membership Plans">
                <option value="membership_plan_created">Plan Created</option>
                <option value="membership_plan_updated">Plan Updated</option>
                <option value="membership_plan_archived">Plan Deactivated</option>
                <option value="membership_plan_reactivated">Plan Reactivated</option>
              </optgroup>
              <optgroup label="Trainers">
                <option value="trainer_created">Trainer Created</option>
                <option value="trainer_updated">Trainer Updated</option>
                <option value="trainer_activated">Trainer Activated</option>
                <option value="trainer_deactivated">Trainer Deactivated</option>
                <option value="trainer_password_reset">Trainer Password Reset</option>
              </optgroup>
              <optgroup label="Settings & Reminders">
                <option value="settings_updated">Settings Updated</option>
                <option value="reminder_setting_updated">Reminder Setting Updated</option>
                <option value="message_template_updated">Message Template Updated</option>
                <option value="profile_updated">Profile Updated</option>
                <option value="password_changed">Password Changed</option>
                <option value="owner_setup">Owner Setup</option>
              </optgroup>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              aria-label="Filter by entity type"
              className="w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
            >
              <option value="">All Entity Types</option>
              <option value="member">Member</option>
              <option value="membership">Membership</option>
              <option value="payment">Payment</option>
              <option value="membership_plan">Membership Plan</option>
              <option value="trainer">Trainer</option>
              <option value="reminder_setting">Reminder Setting</option>
              <option value="message_template">Message Template</option>
              <option value="settings">Settings</option>
              <option value="profile">Profile</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
              title="Start Date"
            />
          </div>

          {/* Date Range End & Reset */}
          <div className="flex gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
              title="End Date"
            />
            <button
              onClick={handleReset}
              title="Reset Filters"
              className="flex items-center justify-center rounded-lg border border-white/10 bg-zinc-800 px-3 text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Audit Logs Table Card */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-400">Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            <FileText className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
            No audit logs found matching your filters.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <DataTable headers={headers}>
              {logs.map((log) => {
                const isExpanded = expandedRows.has(log.id)
                return (
                  <tr
                    key={log.id}
                    className="hover:bg-white/[.02] transition cursor-pointer"
                    onClick={() => toggleRow(log.id)}
                  >
                    {/* Timestamp */}
                    <td className="table-cell whitespace-nowrap text-xs text-zinc-300">
                      {formatTimestamp(log.created_at)}
                    </td>

                    {/* Staff Actor */}
                    <td className="table-cell whitespace-nowrap text-xs">
                      {log.actor ? (
                        <div>
                          <div className="font-semibold text-white">{log.actor.full_name}</div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                            <span>{log.actor.email}</span>
                            <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-300 uppercase">
                              {log.actor.role}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-500 italic">System</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="table-cell whitespace-nowrap text-xs">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getActionBadgeStyle(
                          log.action,
                        )}`}
                      >
                        {formatActionLabel(log.action)}
                      </span>
                    </td>

                    {/* Entity */}
                    <td className="table-cell whitespace-nowrap text-xs text-zinc-300">
                      <span className="font-medium text-zinc-200 capitalize">
                        {log.entity_type.replace('_', ' ')}
                      </span>
                      {log.entity_id && (
                        <div className="text-[10px] font-mono text-zinc-500">
                          {log.entity_id.slice(0, 8)}...
                        </div>
                      )}
                    </td>

                    {/* Details Action Button */}
                    <td className="table-cell whitespace-nowrap text-xs text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleRow(log.id)
                        }}
                        className="inline-flex items-center gap-1 rounded border border-white/10 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
                      >
                        <span>{isExpanded ? 'Hide' : 'View'}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </DataTable>

            {/* Expanded Row Detail Cards */}
            {logs.map((log) => {
              if (!expandedRows.has(log.id)) return null
              return (
                <div
                  key={`detail-${log.id}`}
                  className="bg-zinc-950/70 p-4 border-t border-white/5 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <div>
                      <span className="font-semibold text-white">Log ID: </span>
                      <span className="font-mono text-zinc-400">{log.id}</span>
                    </div>
                    {log.entity_id && (
                      <div>
                        <span className="font-semibold text-white">Target Entity ID: </span>
                        <span className="font-mono text-zinc-400">{log.entity_id}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
                    {/* Previous Data */}
                    {log.previous_data && (
                      <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-3">
                        <div className="font-semibold text-zinc-300 mb-2 text-[11px] uppercase tracking-wider">
                          Previous State
                        </div>
                        <pre className="overflow-x-auto text-[11px] font-mono text-zinc-400 max-h-48">
                          {JSON.stringify(log.previous_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* New Data */}
                    {log.new_data && (
                      <div
                        className={`rounded-lg border border-white/10 bg-zinc-900/70 p-3 ${
                          !log.previous_data ? 'md:col-span-2' : ''
                        }`}
                      >
                        <div className="font-semibold text-brand mb-2 text-[11px] uppercase tracking-wider">
                          New / Updated State
                        </div>
                        <pre className="overflow-x-auto text-[11px] font-mono text-zinc-300 max-h-48">
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {!log.previous_data && !log.new_data && (
                      <div className="text-zinc-500 italic md:col-span-2">
                        No additional payload details recorded for this action.
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-zinc-400">
            <div>
              Showing{' '}
              <span className="text-white font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="text-white font-medium">
                {Math.min(pagination.total, pagination.page * pagination.limit)}
              </span>{' '}
              of <span className="text-white font-medium">{pagination.total}</span> logs
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadLogs(pagination.page - 1)}
                className="rounded border border-white/10 bg-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <span className="text-zinc-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadLogs(pagination.page + 1)}
                className="rounded border border-white/10 bg-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
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
