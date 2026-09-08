import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, DollarSign, PieChart, ShieldAlert } from 'lucide-react'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import type { PaymentReportData, PaymentStatus } from '../../types/reports'

interface PaymentReportTabProps {
  data: PaymentReportData | null
  loading?: boolean
  selectedStatus?: PaymentStatus | 'all'
  onStatusChange: (status: PaymentStatus | 'all') => void
}

function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(val)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function PaymentReportTab({
  data,
  loading,
  selectedStatus = 'all',
  onStatusChange,
}: PaymentReportTabProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.02]" />
        <div className="h-64 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.02]" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-xl bg-white/5 p-3 text-zinc-400">
          <PieChart size={28} />
        </div>
        <p className="mt-3 text-base font-semibold text-white">No Payment Data</p>
        <p className="mt-1 max-w-sm text-xs text-zinc-500">
          Could not find payment records for the selected filters.
        </p>
      </Card>
    )
  }

  const statuses: {
    status: PaymentStatus
    label: string
    count: number
    color: string
    bg: string
    border: string
    icon: typeof CheckCircle2
  }[] = [
    {
      status: 'Paid',
      label: 'Fully Paid',
      count: data.status_counts.paid,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/30',
      icon: CheckCircle2,
    },
    {
      status: 'Partially Paid',
      label: 'Partially Paid',
      count: data.status_counts.partially_paid,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/30',
      icon: Clock,
    },
    {
      status: 'Unpaid',
      label: 'Unpaid (Upcoming)',
      count: data.status_counts.unpaid,
      color: 'text-zinc-300',
      bg: 'bg-zinc-400/10',
      border: 'border-zinc-400/30',
      icon: AlertTriangle,
    },
    {
      status: 'Overdue',
      label: 'Overdue Balances',
      count: data.status_counts.overdue,
      color: 'text-red-400',
      bg: 'bg-red-400/10',
      border: 'border-red-400/30',
      icon: ShieldAlert,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Financial Health Summary Banner */}
      <Card className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <PieChart className="text-brand" size={20} />
              <h3 className="font-['Oswald'] text-lg font-medium text-white">
                Payment Collection & Dues Health
              </h3>
            </div>
            <p className="text-xs text-zinc-400">
              Overview of contracted receivables versus actual manually collected funds
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs sm:gap-8">
            <div>
              <p className="text-zinc-500">Contracted Value</p>
              <p className="mt-1 text-base font-bold text-white">
                ₹{formatINR(data.total_contracted)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Total Collected</p>
              <p className="mt-1 text-base font-bold text-emerald-400">
                ₹{formatINR(data.total_collected)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Pending Dues</p>
              <p className="mt-1 text-base font-bold text-amber-400">
                ₹{formatINR(data.total_pending)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Collection Rate</p>
              <p className="mt-1 text-base font-bold text-brand">
                {data.collection_rate}%
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Overall Collection Realization</span>
            <span className="font-semibold text-white">{data.collection_rate}% collected</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/[.06]">
            <div
              style={{ width: `${Math.min(100, data.collection_rate)}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-brand transition-all duration-700"
            />
          </div>
        </div>
      </Card>

      {/* Status Breakdown Cards (Clickable filter) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statuses.map((item) => {
          const Icon = item.icon
          const isSelected = selectedStatus === item.status

          return (
            <button
              key={item.status}
              type="button"
              onClick={() => onStatusChange(isSelected ? 'all' : item.status)}
              className={`text-left transition ${
                isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
              }`}
            >
              <Card
                className={`p-4 transition ${
                  isSelected
                    ? `border-brand ring-1 ring-brand`
                    : 'hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">{item.label}</span>
                  <div className={`rounded-lg p-1.5 ${item.bg}`}>
                    <Icon size={15} className={item.color} />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                  {item.count}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {isSelected ? '✓ Filter active' : 'Click to filter table'}
                </p>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Memberships Payment Details Table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[.07] px-6 py-4">
          <div>
            <h4 className="font-['Oswald'] text-base font-medium text-white">
              Membership Payment Status ({data.memberships.length})
            </h4>
            <p className="text-xs text-zinc-500">
              Contracted fees, payments received, and remaining dues
            </p>
          </div>
          {selectedStatus !== 'all' && (
            <button
              type="button"
              onClick={() => onStatusChange('all')}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10"
            >
              Reset filter ({selectedStatus})
            </button>
          )}
        </div>

        {data.memberships.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            No memberships match the selected payment status.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[.06] bg-white/[.02] text-zinc-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">Member</th>
                  <th className="px-6 py-3 font-semibold">Plan</th>
                  <th className="px-6 py-3 font-semibold">Due Date</th>
                  <th className="px-6 py-3 font-semibold text-right">Fee</th>
                  <th className="px-6 py-3 font-semibold text-right">Paid</th>
                  <th className="px-6 py-3 font-semibold text-right">Pending Due</th>
                  <th className="px-6 py-3 font-semibold text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.04]">
                {data.memberships.map((m) => (
                  <tr key={m.id} className="transition hover:bg-white/[.02]">
                    <td className="px-6 py-3.5">
                      <Link
                        to={`/members/${m.member_id}`}
                        className="font-medium text-white hover:text-brand"
                      >
                        {m.member_name}
                      </Link>
                      <span className="ml-2 font-mono text-[11px] text-zinc-500">
                        {m.member_code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-300">{m.plan_name}</td>
                    <td className="px-6 py-3.5 text-zinc-400">
                      {formatDate(m.payment_due_date)}
                    </td>
                    <td className="px-6 py-3.5 text-right text-zinc-300 font-mono">
                      ₹{formatINR(m.actual_fee)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-emerald-400">
                      ₹{formatINR(m.total_paid)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold">
                      {m.pending_balance > 0 ? (
                        <span className="text-amber-400">₹{formatINR(m.pending_balance)}</span>
                      ) : (
                        <span className="text-zinc-500">₹0</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <StatusBadge status={m.payment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
