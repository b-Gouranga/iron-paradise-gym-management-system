import { Link } from 'react-router-dom'
import {
  Banknote,
  CreditCard,
  QrCode,
  Building2,
  HelpCircle,
  TrendingUp,
  Calendar,
} from 'lucide-react'
import { Card } from '../Card'
import type { PaymentMethod, RevenueReportData, ReportPeriod } from '../../types/reports'

interface RevenueReportTabProps {
  data: RevenueReportData | null
  loading?: boolean
  period: ReportPeriod
  onPeriodChange: (p: ReportPeriod) => void
}

function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(val)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const methodIcons: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  upi: QrCode,
  card: CreditCard,
  bank_transfer: Building2,
  other: HelpCircle,
}

const methodColors: Record<PaymentMethod, { text: string; bg: string; bar: string }> = {
  cash: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', bar: 'bg-emerald-500' },
  upi: { text: 'text-cyan-400', bg: 'bg-cyan-400/10', bar: 'bg-cyan-500' },
  card: { text: 'text-purple-400', bg: 'bg-purple-400/10', bar: 'bg-purple-500' },
  bank_transfer: { text: 'text-blue-400', bg: 'bg-blue-400/10', bar: 'bg-blue-500' },
  other: { text: 'text-zinc-400', bg: 'bg-zinc-400/10', bar: 'bg-zinc-500' },
}

export function RevenueReportTab({
  data,
  loading,
  period,
  onPeriodChange,
}: RevenueReportTabProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-64 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.02]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.02]" />
          <div className="h-48 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.02]" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-xl bg-white/5 p-3 text-zinc-400">
          <TrendingUp size={28} />
        </div>
        <p className="mt-3 text-base font-semibold text-white">No Revenue Data</p>
        <p className="mt-1 max-w-sm text-xs text-zinc-500">
          Could not find any revenue transactions for the selected filters.
        </p>
      </Card>
    )
  }

  const maxSeriesAmount = Math.max(...data.time_series.map((p) => p.amount), 1)

  return (
    <div className="space-y-6">
      {/* Top summary & Period selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-brand" size={20} />
          <div>
            <h3 className="font-['Oswald'] text-lg font-medium text-white">Revenue Analysis</h3>
            <p className="text-xs text-zinc-400">
              Total ₹{formatINR(data.total_revenue)} from {data.transaction_count} transaction
              {data.transaction_count === 1 ? '' : 's'} (Avg: ₹{formatINR(data.average_transaction_value)}/txn)
            </p>
          </div>
        </div>

        {/* Grouping switcher */}
        <div className="inline-flex rounded-xl border border-white/[.08] bg-black/40 p-1">
          {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                period === p
                  ? 'bg-brand text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Bar Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between border-b border-white/[.06] pb-4">
          <div>
            <p className="text-sm font-semibold text-white">Revenue Timeline</p>
            <p className="text-xs text-zinc-500">
              Aggregated {period} collections
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="inline-block h-2 w-2 rounded-full bg-brand" />
            Collections (₹)
          </div>
        </div>

        {data.time_series.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="mx-auto mb-2 text-zinc-600" size={32} />
            <p className="text-sm text-zinc-400">No payment data recorded in this period.</p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2 pt-6">
              {data.time_series.map((point, idx) => {
                const heightPercent = Math.max(
                  6,
                  Math.round((point.amount / maxSeriesAmount) * 100),
                )
                return (
                  <div
                    key={idx}
                    className="group relative flex flex-1 min-w-[50px] max-w-[90px] flex-col items-center gap-2"
                  >
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute -top-12 z-20 hidden whitespace-nowrap rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-center shadow-xl group-hover:block">
                      <p className="text-xs font-bold text-white">₹{formatINR(point.amount)}</p>
                      <p className="text-[10px] text-zinc-400">
                        {point.count} txn{point.count === 1 ? '' : 's'}
                      </p>
                    </div>

                    {/* Bar */}
                    <div className="flex h-44 w-full items-end justify-center rounded-lg bg-white/[.02] p-1">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full rounded-md bg-gradient-to-t from-brand/80 to-brand transition-all duration-300 group-hover:brightness-125"
                      />
                    </div>

                    {/* Label */}
                    <span className="text-[11px] font-medium text-zinc-400 truncate max-w-full">
                      {point.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Breakdowns Grid: Payment Method & Purpose */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Payment Method Breakdown */}
        <Card className="p-6">
          <h4 className="font-['Oswald'] text-base font-medium text-white">
            Collections by Payment Method
          </h4>
          <p className="text-xs text-zinc-500">Distribution across accepted manual modes</p>

          <div className="mt-5 space-y-4">
            {data.by_method.map((item) => {
              const Icon = methodIcons[item.method] ?? HelpCircle
              const color = methodColors[item.method] ?? methodColors.other

              return (
                <div key={item.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-md p-1 ${color.bg}`}>
                        <Icon size={14} className={color.text} />
                      </div>
                      <span className="font-medium text-zinc-200">{item.label}</span>
                      <span className="text-zinc-500">
                        ({item.count} txn{item.count === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-white">₹{formatINR(item.amount)}</span>
                      <span className="ml-2 font-medium text-zinc-400">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[.06]">
                    <div
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Payment Purpose Breakdown */}
        <Card className="p-6">
          <h4 className="font-['Oswald'] text-base font-medium text-white">
            Collections by Purpose
          </h4>
          <p className="text-xs text-zinc-500">Revenue attribution by transaction reason</p>

          <div className="mt-5 space-y-4">
            {data.by_purpose.map((item) => (
              <div key={item.purpose} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-zinc-200">{item.label}</span>
                    <span className="ml-2 text-zinc-500">
                      ({item.count} txn{item.count === 1 ? '' : 's'})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-white">₹{formatINR(item.amount)}</span>
                    <span className="ml-2 font-medium text-zinc-400">
                      {item.percentage}%
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[.06]">
                  <div
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                    className="h-full rounded-full bg-brand transition-all duration-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Transactions List Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-white/[.07] px-6 py-4">
          <h4 className="font-['Oswald'] text-base font-medium text-white">
            Recorded Transactions Log ({data.transactions.length})
          </h4>
          <p className="text-xs text-zinc-500">
            Itemized manual receipts for the selected period
          </p>
        </div>

        {data.transactions.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            No transactions found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[.06] bg-white/[.02] text-zinc-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Member</th>
                  <th className="px-6 py-3 font-semibold">Plan</th>
                  <th className="px-6 py-3 font-semibold">Method</th>
                  <th className="px-6 py-3 font-semibold">Purpose</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.04]">
                {data.transactions.map((tx) => (
                  <tr key={tx.id} className="transition hover:bg-white/[.02]">
                    <td className="px-6 py-3.5 text-zinc-300">
                      {formatDate(tx.payment_date)}
                    </td>
                    <td className="px-6 py-3.5">
                      <Link
                        to={`/members/${tx.member_id}`}
                        className="font-medium text-white hover:text-brand"
                      >
                        {tx.member_name}
                      </Link>
                      <span className="ml-2 font-mono text-[11px] text-zinc-500">
                        {tx.member_code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-300">{tx.plan_name}</td>
                    <td className="px-6 py-3.5 capitalize text-zinc-300">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {tx.payment_method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 capitalize text-zinc-400">
                      {tx.purpose.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-emerald-400">
                      ₹{formatINR(tx.amount)}
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
