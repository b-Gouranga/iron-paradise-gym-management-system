import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, History, RefreshCw, Zap } from 'lucide-react'
import { Card } from '../Card'
import type { RenewalReportData } from '../../types/reports'

interface RenewalReportTabProps {
  data: RenewalReportData | null
  loading?: boolean
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

export function RenewalReportTab({ data, loading }: RenewalReportTabProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.02]"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.02]" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-xl bg-white/5 p-3 text-zinc-400">
          <RefreshCw size={28} />
        </div>
        <p className="mt-3 text-base font-semibold text-white">No Renewal Data</p>
        <p className="mt-1 max-w-sm text-xs text-zinc-500">
          Could not find renewal records for the selected filters.
        </p>
      </Card>
    )
  }

  const kpis = [
    {
      label: 'Total Renewals',
      value: data.total_renewals,
      detail: 'Extended memberships',
      icon: RefreshCw,
      color: 'text-brand',
      bg: 'bg-brand/10',
    },
    {
      label: 'On-Time Renewals',
      value: data.on_time_renewals,
      detail: '≤ 1 day gap from expiry',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      label: 'Late Renewals',
      value: data.late_renewals,
      detail: '> 1 day renewal gap',
      icon: Clock,
      color: data.late_renewals > 0 ? 'text-amber-400' : 'text-zinc-400',
      bg: data.late_renewals > 0 ? 'bg-amber-400/10' : 'bg-zinc-400/10',
    },
    {
      label: 'Avg Renewal Delay',
      value: `${data.average_delay_days}d`,
      detail: 'Average gap across renewals',
      icon: Zap,
      color: 'text-sky-400',
      bg: 'bg-sky-400/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Renewal KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          return (
            <Card key={idx} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">{kpi.label}</span>
                <div className={`rounded-lg p-1.5 ${kpi.bg}`}>
                  <Icon size={15} className={kpi.color} />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-white">{kpi.value}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{kpi.detail}</p>
            </Card>
          )
        })}
      </div>

      {/* Delay Distribution Buckets */}
      <Card className="p-6">
        <div className="flex items-center gap-2 border-b border-white/[.06] pb-4">
          <History className="text-brand" size={18} />
          <div>
            <h4 className="font-['Oswald'] text-base font-medium text-white">
              Renewal Delay Interval Analysis
            </h4>
            <p className="text-xs text-zinc-500">
              Breakdown of lapse between previous membership expiration and renewal inception
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {data.delay_distribution.map((bucket, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200">{bucket.range}</span>
                <div className="text-right">
                  <span className="font-semibold text-white">{bucket.count} member{bucket.count === 1 ? '' : 's'}</span>
                  <span className="ml-2 font-medium text-zinc-400">{bucket.percentage}%</span>
                </div>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[.06]">
                <div
                  style={{ width: `${Math.min(100, bucket.percentage)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    i === 0
                      ? 'bg-emerald-500'
                      : i === 1
                      ? 'bg-amber-500'
                      : i === 2
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Renewal Events Log Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-white/[.07] px-6 py-4">
          <h4 className="font-['Oswald'] text-base font-medium text-white">
            Renewal Transactions Log ({data.renewals.length})
          </h4>
          <p className="text-xs text-zinc-500">
            Audit history of membership renewals and transition delays
          </p>
        </div>

        {data.renewals.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            No renewal events recorded for the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[.06] bg-white/[.02] text-zinc-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">Member</th>
                  <th className="px-6 py-3 font-semibold">Plan</th>
                  <th className="px-6 py-3 font-semibold">Previous Expiry</th>
                  <th className="px-6 py-3 font-semibold">New Start Date</th>
                  <th className="px-6 py-3 font-semibold">Transition Delay</th>
                  <th className="px-6 py-3 font-semibold text-center">Timeliness</th>
                  <th className="px-6 py-3 font-semibold text-right">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.04]">
                {data.renewals.map((r) => (
                  <tr key={r.id} className="transition hover:bg-white/[.02]">
                    <td className="px-6 py-3.5">
                      <Link
                        to={`/members/${r.member_id}`}
                        className="font-medium text-white hover:text-brand"
                      >
                        {r.member_name}
                      </Link>
                      <span className="ml-2 font-mono text-[11px] text-zinc-500">
                        {r.member_code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-300">{r.plan_name}</td>
                    <td className="px-6 py-3.5 text-zinc-400">
                      {formatDate(r.previous_expiry_date)}
                    </td>
                    <td className="px-6 py-3.5 text-zinc-300 font-medium">
                      {formatDate(r.new_start_date)}
                    </td>
                    <td className="px-6 py-3.5">
                      {r.renewal_delay_days <= 1 ? (
                        <span className="text-emerald-400">
                          {r.renewal_delay_days <= 0 ? '0d (early)' : '1d (seamless)'}
                        </span>
                      ) : (
                        <span className="text-amber-400">
                          +{r.renewal_delay_days} days gap
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {r.is_late ? (
                        <span className="inline-flex rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                          Late Renewal
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                          On-Time
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-white">
                      ₹{formatINR(r.actual_fee)}
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
