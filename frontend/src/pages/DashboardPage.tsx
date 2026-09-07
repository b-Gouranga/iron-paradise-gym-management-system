import { AlertTriangle, ArrowRight, Clock, MoreHorizontal } from 'lucide-react'
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

function Action() {
  return (
    <button
      aria-label="More actions"
      className="rounded p-1 text-zinc-500 hover:bg-white/[.06] hover:text-white"
    >
      <MoreHorizontal size={18} />
    </button>
  )
}

function SectionTitle({ title, action = 'View all' }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <button className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-red-400">
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map(sc => (
          <StatCard key={sc.label} {...sc} />
        ))}
      </div>

      {/* ── Upcoming Renewals + Reminder Summary ────────────────────────────── */}
      <div className="mt-7 grid gap-7 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Upcoming Renewals" />
          <DataTable
            headers={['Member', 'Membership Plan', 'Expiry Date', 'Days Left', 'Fee', 'Status', '']}
          >
            {!loading && (data?.renewals.length ?? 0) === 0 ? (
              <EmptyTableRow
                colSpan={7}
                message="No memberships expiring in the next 14 days."
              />
            ) : (
              (data?.renewals ?? []).map(r => (
                <tr key={r.membershipId}>
                  <td className="table-cell font-semibold text-white">{r.memberName}</td>
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
                    <Action />
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>

        {/* Reminder Summary — not yet available (Part 9) */}
        <Card>
          <SectionTitle title="Reminder Summary" action="Manage" />
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
            <div className="rounded-xl bg-zinc-800/60 p-3 text-zinc-500">
              <Clock size={24} />
            </div>
            <p className="text-sm font-medium text-zinc-300">Automated Reminders</p>
            <p className="max-w-[200px] text-xs leading-5 text-zinc-500">
              Reminder data will appear here once the automated reminder engine
              is configured.
            </p>
          </div>
        </Card>
      </div>

      {/* ── Pending Payments + Recent Payments ──────────────────────────────── */}
      <div className="mt-7 grid gap-7 xl:grid-cols-2">
        <Card>
          <SectionTitle title="Pending Payments" />
          <DataTable
            headers={['Member', 'Membership', 'Pending', 'Due Date', 'Status', '']}
          >
            {!loading && (data?.pendingPayments.length ?? 0) === 0 ? (
              <EmptyTableRow
                colSpan={6}
                message="No pending payments — all memberships are settled."
              />
            ) : (
              (data?.pendingPayments ?? []).map(p => (
                <tr key={p.membershipId}>
                  <td className="table-cell font-semibold text-white">{p.memberName}</td>
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
                    <Action />
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>

        <Card>
          <SectionTitle title="Recent Payments" />
          <DataTable headers={['Member', 'Amount', 'Date', 'Method', 'Status']}>
            {!loading && (data?.recentPayments.length ?? 0) === 0 ? (
              <EmptyTableRow
                colSpan={5}
                message="No payments recorded yet."
              />
            ) : (
              (data?.recentPayments ?? []).map(p => (
                <tr key={p.paymentId}>
                  <td className="table-cell font-semibold text-white">{p.memberName}</td>
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
