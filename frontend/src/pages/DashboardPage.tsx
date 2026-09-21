import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  CreditCard,
  MoreHorizontal,
  RefreshCw,
  User,
} from 'lucide-react'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import { useDashboardData } from '../hooks/useDashboardData'
import type { DashboardPendingPayment, DashboardRenewal } from '../types/dashboard'
import type { Status } from '../types'

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Time-aware greeting using the authenticated user's first name. */
function buildGreeting(fullName: string | undefined): string {
  const hour = new Date().getHours()
  const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const firstName = fullName?.split(' ')[0] ?? ''
  return firstName ? `Good ${period}, ${firstName}` : `Good ${period}`
}

/** Formats a number as Indian Rupees, no decimal places. */
const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

/** Formats a YYYY-MM-DD date string as "7 Sep 2026". */
const formatDate = (dateStr: string): string =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

/** Maps a DB payment_method value to a display label. */
function formatMethod(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    other: 'Other',
  }
  return map[method] ?? method
}

/** Derives the UI Status badge for an upcoming renewal row. */
function renewalStatus(r: DashboardRenewal): Status {
  if (r.daysLeft < 0) return 'Expired'
  if (r.daysLeft <= 7) return 'Expiring Soon'
  return 'Active'
}

/** Maps the backend payment status to the UI Status badge. */
function pendingStatus(s: DashboardPendingPayment['paymentStatus']): Status {
  if (s === 'overdue') return 'Overdue'
  if (s === 'partially_paid') return 'Partially Paid'
  return 'Unpaid'
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface RowActionMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
}

function RowActionMenu({ items }: { items: RowActionMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        aria-label="Row actions"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[.08] hover:text-white transition min-h-[32px] min-w-[32px] inline-flex items-center justify-center"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-white/10 bg-[#161619] py-1 shadow-2xl ring-1 ring-black/50 focus:outline-none">
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                item.onClick()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-white/[.07] hover:text-white transition"
            >
              {item.icon && <span className="text-zinc-400">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionTitle({
  title,
  action = 'View all',
  onClick,
}: {
  title: string
  action?: string
  onClick?: () => void
}) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/[.07]">
      <h2 className="text-sm sm:text-base font-semibold text-white">{title}</h2>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[36px] items-center gap-1 text-xs font-semibold text-brand hover:text-red-400 transition py-1 px-2 rounded hover:bg-white/[.04]"
      >
        {action}
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

/** Renders a single, full-width empty row inside a DataTable. */
function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-5 py-8 text-center text-sm text-zinc-500"
      >
        {message}
      </td>
    </tr>
  )
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, loading, error } = useDashboardData()

  const s = data?.stats

  // ── Stat card definitions ────────────────────────────────────────────────
  // While loading, value shows '—' so no fake number is ever displayed.

  const statCards = [
    {
      label: 'Total Members',
      value: loading ? '—' : String(s?.totalMembers ?? 0),
      detail: loading
        ? ' '
        : `${s?.totalMembers ?? 0} ${(s?.totalMembers ?? 0) === 1 ? 'member' : 'members'} registered`,
      tone: 'red',
    },
    {
      label: 'Active Members',
      value: loading ? '—' : String(s?.activeMembers ?? 0),
      detail: loading
        ? ' '
        : (s?.totalMembers ?? 0) > 0
          ? `${Math.round(((s?.activeMembers ?? 0) / (s?.totalMembers ?? 1)) * 100)}% of all members`
          : 'No members yet',
      tone: 'green',
    },
    {
      label: 'Expiring Soon',
      value: loading ? '—' : String(s?.expiringSoon ?? 0),
      detail: 'Within 7 days',
      tone: 'amber',
    },
    {
      label: 'Expired',
      value: loading ? '—' : String(s?.expired ?? 0),
      detail: loading
        ? ' '
        : (s?.expired ?? 0) > 0
          ? 'Needs attention'
          : 'All clear',
      tone: 'red',
    },
    {
      label: 'Pending Payments',
      value: loading ? '—' : formatINR(s?.pendingPaymentsAmount ?? 0),
      detail: loading
        ? ' '
        : `Across ${s?.pendingPaymentsCount ?? 0} ${
            (s?.pendingPaymentsCount ?? 0) === 1 ? 'membership' : 'memberships'
          }`,
      tone: 'amber',
    },
    {
      label: 'Revenue This Month',
      value: loading ? '—' : formatINR(s?.revenueThisMonth ?? 0),
      detail: 'Current calendar month',
      tone: 'green',
    },
  ]

  return (
    <>
      {/* Page header with real authenticated user's name */}
      <PageHeader
        title={buildGreeting(profile?.full_name)}
        description="Here's what's happening at Iron Paradise today."
      />

      {/* Error banner — shown if the backend call failed */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {statCards.map(sc => (
          <StatCard key={sc.label} {...sc} />
        ))}
      </div>

      {/* ── Upcoming Renewals + Reminder Summary ────────────────────────────── */}
      <div className="mt-6 sm:mt-7 grid gap-6 sm:gap-7 xl:grid-cols-3">
        <Card className="xl:col-span-2 overflow-hidden min-w-0">
          <SectionTitle
            title="Upcoming Renewals"
            action="View all"
            onClick={() => navigate('/renewals')}
          />
          <DataTable
            headers={['Member', 'Membership Plan', 'Expiry Date', 'Days Left', 'Fee', 'Status', '']}
            minWidth="min-w-[650px]"
          >
            {!loading && (data?.renewals.length ?? 0) === 0 ? (
              <EmptyTableRow
                colSpan={7}
                message="No memberships expiring in the next 14 days."
              />
            ) : (
              (data?.renewals ?? []).map(r => (
                <tr key={r.membershipId}>
                  <td className="table-cell">
                    <Link
                      to={r.memberId ? `/members/${r.memberId}` : '/renewals'}
                      className="font-semibold text-white hover:text-brand transition"
                    >
                      {r.memberName}
                    </Link>
                  </td>
                  <td className="table-cell">{r.planName}</td>
                  <td className="table-cell">{formatDate(r.expiryDate)}</td>
                  <td
                    className={`table-cell font-medium ${
                      r.daysLeft < 0
                        ? 'text-red-300'
                        : r.daysLeft <= 5
                          ? 'text-amber-300'
                          : 'text-zinc-300'
                    }`}
                  >
                    {r.daysLeft < 0
                      ? `${Math.abs(r.daysLeft)} days ago`
                      : `${r.daysLeft} days`}
                  </td>
                  <td className="table-cell">{formatINR(r.actualFee)}</td>
                  <td className="table-cell">
                    <StatusBadge status={renewalStatus(r)} />
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/renewals')}
                        className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 transition min-h-[32px] inline-flex items-center justify-center"
                        title="Renew membership in Renewals Workbench"
                      >
                        Renew
                      </button>
                      <RowActionMenu
                        items={[
                          {
                            label: 'Renew Membership',
                            icon: <RefreshCw size={13} />,
                            onClick: () => navigate('/renewals'),
                          },
                          {
                            label: 'View Member Details',
                            icon: <User size={13} />,
                            onClick: () => navigate(r.memberId ? `/members/${r.memberId}` : '/members'),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>

        {/* Reminder Summary — live real data (Part 9) */}
        <Card className="flex flex-col overflow-hidden min-w-0">
          <SectionTitle
            title="Reminder Summary"
            action="Manage"
            onClick={() => navigate('/reminders')}
          />
          <div className="flex-1 p-4 sm:p-5">
            {loading ? (
              <div className="py-10 text-center text-xs text-zinc-500">Loading reminders…</div>
            ) : (
              <div className="space-y-4">
                {/* Metrics Pill Row */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[.08] bg-white/[.02] p-2.5 sm:p-3 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                      Scheduled
                    </p>
                    <p className="mt-0.5 text-base font-bold text-amber-400">
                      {data?.remindersSummary?.scheduledCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                      Sent
                    </p>
                    <p className="mt-0.5 text-base font-bold text-emerald-400">
                      {data?.remindersSummary?.sentCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                      Failed
                    </p>
                    <p className="mt-0.5 text-base font-bold text-brand">
                      {data?.remindersSummary?.failedCount ?? 0}
                    </p>
                  </div>
                </div>

                {/* Recent reminders list */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Recent Activity (Simulated)
                  </p>
                  {(!data?.remindersSummary?.recentReminders ||
                    data.remindersSummary.recentReminders.length === 0) ? (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No automated reminders logged yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.remindersSummary.recentReminders.slice(0, 4).map(rem => (
                        <div
                          key={rem.id}
                          onClick={() => navigate('/reminders')}
                          className="flex items-center justify-between rounded-lg border border-white/[.05] bg-white/[.02] p-2 text-xs hover:bg-white/[.06] hover:border-white/10 cursor-pointer transition"
                          title="View in Reminders Workbench"
                        >
                          <div className="truncate mr-2">
                            <p className="font-semibold text-white truncate">{rem.memberName}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">
                              {rem.reminderStage.replace(/_/g, ' ')} · {rem.channel}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              rem.status === 'scheduled'
                                ? 'bg-amber-500/10 text-amber-300'
                                : rem.status === 'sent' || rem.status === 'delivered'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-950/30 text-brand'
                            }`}
                          >
                            {rem.status === 'sent' ? 'Sent (Sim)' : rem.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Pending Payments + Recent Payments ──────────────────────────────── */}
      <div className="mt-6 sm:mt-7 grid gap-6 sm:gap-7 xl:grid-cols-2">
        <Card className="overflow-hidden min-w-0">
          <SectionTitle
            title="Pending Payments"
            action="View all"
            onClick={() => navigate('/payments')}
          />
          <DataTable
            headers={['Member', 'Membership', 'Pending', 'Due Date', 'Status', '']}
            minWidth="min-w-[580px]"
          >
            {!loading && (data?.pendingPayments.length ?? 0) === 0 ? (
              <EmptyTableRow
                colSpan={6}
                message="No pending payments — all memberships are settled."
              />
            ) : (
              (data?.pendingPayments ?? []).map(p => (
                <tr key={p.membershipId}>
                  <td className="table-cell">
                    <Link
                      to={p.memberId ? `/members/${p.memberId}` : '/payments'}
                      className="font-semibold text-white hover:text-brand transition"
                    >
                      {p.memberName}
                    </Link>
                  </td>
                  <td className="table-cell">{p.planName}</td>
                  <td className="table-cell font-semibold">
                    {formatINR(p.pendingAmount)}
                  </td>
                  <td className="table-cell">
                    {p.paymentDueDate ? formatDate(p.paymentDueDate) : '—'}
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={pendingStatus(p.paymentStatus)} />
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(p.memberId ? `/members/${p.memberId}` : '/payments')}
                        className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition min-h-[32px] inline-flex items-center justify-center"
                        title="View member or record payment"
                      >
                        View
                      </button>
                      <RowActionMenu
                        items={[
                          {
                            label: 'Record Payment',
                            icon: <CreditCard size={13} />,
                            onClick: () => navigate(p.memberId ? `/members/${p.memberId}` : '/payments'),
                          },
                          {
                            label: 'View Member Details',
                            icon: <User size={13} />,
                            onClick: () => navigate(p.memberId ? `/members/${p.memberId}` : '/members'),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>

        <Card className="overflow-hidden min-w-0">
          <SectionTitle
            title="Recent Payments"
            action="View all"
            onClick={() => navigate('/payments')}
          />
          <DataTable
            headers={['Member', 'Amount', 'Date', 'Method', 'Status']}
            minWidth="min-w-[500px]"
          >
            {!loading && (data?.recentPayments.length ?? 0) === 0 ? (
              <EmptyTableRow
                colSpan={5}
                message="No payments recorded yet."
              />
            ) : (
              (data?.recentPayments ?? []).map(p => (
                <tr key={p.paymentId}>
                  <td className="table-cell">
                    <Link
                      to={p.memberId ? `/members/${p.memberId}` : '/payments'}
                      className="font-semibold text-white hover:text-brand transition"
                    >
                      {p.memberName}
                    </Link>
                  </td>
                  <td className="table-cell font-semibold text-emerald-300">
                    {formatINR(p.amount)}
                  </td>
                  <td className="table-cell">{formatDate(p.paymentDate)}</td>
                  <td className="table-cell">{formatMethod(p.paymentMethod)}</td>
                  <td className="table-cell">
                    <StatusBadge status="Paid" />
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      </div>
    </>
  )
}
