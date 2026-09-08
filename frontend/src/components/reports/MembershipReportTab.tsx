import { Link } from 'react-router-dom'
import { Calendar, CheckCircle, Clock, Layers, Users, XCircle } from 'lucide-react'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import type { MembershipReportData } from '../../types/reports'
import type { Status } from '../../types'

interface MembershipReportTabProps {
  data: MembershipReportData | null
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

export function MembershipReportTab({ data, loading }: MembershipReportTabProps) {
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
          <Layers size={28} />
        </div>
        <p className="mt-3 text-base font-semibold text-white">No Membership Data</p>
        <p className="mt-1 max-w-sm text-xs text-zinc-500">
          Could not find membership records for the selected filters.
        </p>
      </Card>
    )
  }

  const statusCards = [
    {
      label: 'Active Memberships',
      count: data.active_count,
      detail: 'Currently valid',
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      label: 'Expiring Soon',
      count: data.expiring_soon_count,
      detail: 'Next 7 days window',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
    },
    {
      label: 'Expired Memberships',
      count: data.expired_count,
      detail: 'Lapsed or past end date',
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-400/10',
    },
    {
      label: 'Future Memberships',
      count: data.future_count ?? 0,
      detail: 'Upcoming cycle',
      icon: Calendar,
      color: 'text-sky-400',
      bg: 'bg-sky-400/10',
    },
    {
      label: 'Total Filtered',
      count: data.total_memberships,
      detail: 'All evaluated cycles',
      icon: Users,
      color: 'text-brand',
      bg: 'bg-brand/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Lifecycle Status Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statusCards.map((card, i) => {
          const Icon = card.icon
          return (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">{card.label}</span>
                <div className={`rounded-lg p-1.5 ${card.bg}`}>
                  <Icon size={15} className={card.color} />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-white">{card.count}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{card.detail}</p>
            </Card>
          )
        })}
      </div>

      {/* Plan-wise Breakdown Cards & Comparison */}
      <Card className="p-6">
        <div className="flex items-center gap-2 border-b border-white/[.06] pb-4">
          <Layers className="text-brand" size={18} />
          <div>
            <h4 className="font-['Oswald'] text-base font-medium text-white">
              Plan-Wise Distribution & Contracted Value
            </h4>
            <p className="text-xs text-zinc-500">
              Breakdown of member distribution, contracted revenue, and average fee per plan
            </p>
          </div>
        </div>

        {data.by_plan.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            No membership plans available.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.by_plan.map((plan) => (
              <div
                key={plan.plan_id}
                className="rounded-xl border border-white/[.07] bg-white/[.015] p-4 transition hover:border-white/15"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{plan.plan_name}</p>
                    <p className="text-[11px] text-zinc-500">{plan.duration}</p>
                  </div>
                  <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                    {plan.percentage}%
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[.04] pt-3 text-xs">
                  <div>
                    <span className="text-zinc-500">Subscribers</span>
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      {plan.member_count} member{plan.member_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Avg. Fee</span>
                    <p className="mt-0.5 text-sm font-semibold text-zinc-300">
                      ₹{formatINR(plan.average_fee)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-white/[.04] pt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Total Contracted:</span>
                    <span className="font-semibold text-emerald-400">
                      ₹{formatINR(plan.total_contracted)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[.06]">
                    <div
                      style={{ width: `${Math.min(100, plan.percentage)}%` }}
                      className="h-full rounded-full bg-brand transition-all duration-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Memberships Catalog Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-white/[.07] px-6 py-4">
          <h4 className="font-['Oswald'] text-base font-medium text-white">
            Membership Records ({data.memberships.length})
          </h4>
          <p className="text-xs text-zinc-500">
            Chronological log of membership periods and active statuses
          </p>
        </div>

        {data.memberships.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            No memberships found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[.06] bg-white/[.02] text-zinc-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">Member</th>
                  <th className="px-6 py-3 font-semibold">Plan</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Start Date</th>
                  <th className="px-6 py-3 font-semibold">Expiry Date</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.04]">
                {data.memberships.map((m) => {
                  let displayStatus: Status = 'Active'
                  if (m.status === 'cancelled') displayStatus = 'Cancelled'
                  else if (m.status === 'future') displayStatus = 'Future'
                  else if (m.status === 'expired') displayStatus = 'Expired'
                  else if (m.status === 'expiring_soon') displayStatus = 'Expiring Soon'

                  return (
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
                      <td className="px-6 py-3.5">
                        {m.is_renewal ? (
                          <span className="inline-flex rounded bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                            Renewal
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-500">New Plan</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-400">{formatDate(m.start_date)}</td>
                      <td className="px-6 py-3.5 text-zinc-300 font-medium">
                        {formatDate(m.expiry_date)}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <StatusBadge status={displayStatus} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
