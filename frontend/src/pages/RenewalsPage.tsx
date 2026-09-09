import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { StatusBadge } from '../components/StatusBadge'
import { RenewMembershipModal } from '../components/memberships/RenewMembershipModal'
import { useAuth } from '../hooks/useAuth'
import {
  fetchExpiredRenewals,
  fetchRenewalHistory,
  fetchUpcomingRenewals,
} from '../services/renewalsService'
import type {
  ExpiredRenewalItem,
  RenewalHistoryResponse,
  UpcomingRenewalItem,
  UpcomingRenewalsResponse,
} from '../types/renewals'
import type { Membership } from '../types/memberships'

type TabMode = 'upcoming' | 'expired' | 'history'

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

export function RenewalsPage() {
  const { session } = useAuth()
  const token = session?.access_token

  const [activeTab, setActiveTab] = useState<TabMode>('upcoming')
  const [windowDays, setWindowDays] = useState<string>('30')
  const [searchQuery, setSearchQuery] = useState('')

  const [upcomingData, setUpcomingData] = useState<UpcomingRenewalsResponse | null>(null)
  const [expiredList, setExpiredList] = useState<ExpiredRenewalItem[]>([])
  const [historyData, setHistoryData] = useState<RenewalHistoryResponse | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Renew Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMembership, setSelectedMembership] = useState<Membership | null>(null)
  const [selectedMemberName, setSelectedMemberName] = useState('')
  const [successToast, setSuccessToast] = useState<string | null>(null)

  async function loadData(isRefresh = false) {
    if (!token) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const [upRes, expRes, histRes] = await Promise.all([
        fetchUpcomingRenewals(token, windowDays, searchQuery),
        fetchExpiredRenewals(token, 60, searchQuery),
        fetchRenewalHistory(token),
      ])

      setUpcomingData(upRes)
      setExpiredList(expRes.expired)
      setHistoryData(histRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load renewals data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [token, windowDays, searchQuery])

  function handleOpenRenew(membership: Membership, memberName: string) {
    setSelectedMembership(membership)
    setSelectedMemberName(memberName)
    setModalOpen(true)
  }

  function handleRenewalSuccess() {
    setSuccessToast(`Renewal membership successfully created for ${selectedMemberName}!`)
    setTimeout(() => setSuccessToast(null), 5000)
    loadData(true)
  }

  const upcomingCount = upcomingData?.total ?? 0
  const expiredCount = expiredList.length
  const historyCount = historyData?.total_renewals ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Renewals"
        description="Centralized renewal workbench for tracking upcoming expirations, processing renewals, and viewing renewal history."
      >
        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 hover:border-white/20 disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </PageHeader>

      {/* Success Notification */}
      {successToast && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400 shadow-lg">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Expiring in 7 Days
            </p>
            <p className="mt-0.5 text-2xl font-black text-white">
              {upcomingData?.summary.expiring_7_days ?? 0}
            </p>
            <p className="text-[11px] text-zinc-500">Immediate action needed</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-brand/10 p-3 text-brand">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Expiring in 30 Days
            </p>
            <p className="mt-0.5 text-2xl font-black text-white">
              {upcomingData?.summary.expiring_30_days ?? 0}
            </p>
            <p className="text-[11px] text-zinc-500">Upcoming renewals</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-red-500/10 p-3 text-red-400">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Expired / Lapsed
            </p>
            <p className="mt-0.5 text-2xl font-black text-white">
              {expiredCount}
            </p>
            <p className="text-[11px] text-zinc-500">Pending renewal</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
            <History size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Renewals Completed
            </p>
            <p className="mt-0.5 text-2xl font-black text-white">
              {historyCount}
            </p>
            <p className="text-[11px] text-zinc-500">
              {historyData?.on_time_renewals ?? 0} on-time ({historyData ? Math.round(((historyData.on_time_renewals / Math.max(1, historyData.total_renewals)) * 100)) : 0}%)
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs & Filter Toolbar */}
      <div className="flex flex-col gap-4 border-b border-white/[.07] pb-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 rounded-xl bg-white/[.03] p-1 border border-white/[.07]">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-brand text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Upcoming Renewals</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                activeTab === 'upcoming'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/[.07] text-zinc-400'
              }`}
            >
              {upcomingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expired')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'expired'
                ? 'bg-brand text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Expired / Lapsed</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                activeTab === 'expired'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/[.07] text-zinc-400'
              }`}
            >
              {expiredCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-brand text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Renewal History</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                activeTab === 'history'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/[.07] text-zinc-400'
              }`}
            >
              {historyCount}
            </span>
          </button>
        </div>

        {/* Filters */}
        {activeTab !== 'history' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search member, ID, plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {activeTab === 'upcoming' && (
              <select
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#161618] px-3 py-2 text-xs font-medium text-zinc-300 outline-none transition hover:border-white/20 focus:border-brand"
              >
                <option value="7">Next 7 Days</option>
                <option value="14">Next 14 Days</option>
                <option value="30">Next 30 Days</option>
                <option value="60">Next 60 Days</option>
                <option value="all">All Active</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Tab 1: Upcoming Renewals */}
      {activeTab === 'upcoming' && (
        <Card className="overflow-hidden p-0">
          {loading && !upcomingData ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl border border-white/[.05] bg-white/[.02]"
                />
              ))}
            </div>
          ) : !upcomingData || upcomingData.upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-xl bg-white/5 p-4 text-zinc-400">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">No Upcoming Expirations</h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-400">
                All active memberships are healthy. There are no active memberships expiring in the selected timeframe.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[.07] bg-white/[.015] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-3.5 pl-6 pr-4">Member</th>
                    <th className="px-4 py-3.5">Contact</th>
                    <th className="px-4 py-3.5">Current Plan</th>
                    <th className="px-4 py-3.5">Expiry Date</th>
                    <th className="px-4 py-3.5">Days Left</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.04]">
                  {upcomingData.upcoming.map((item) => {
                    const daysLeft = item.days_left
                    let daysBadgeClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    if (daysLeft <= 3) {
                      daysBadgeClass = 'text-red-400 bg-red-500/10 border-red-500/20 font-bold animate-pulse'
                    } else if (daysLeft <= 7) {
                      daysBadgeClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20 font-semibold'
                    }

                    return (
                      <tr
                        key={item.id}
                        className="transition hover:bg-white/[.02]"
                      >
                        <td className="py-4 pl-6 pr-4">
                          <Link
                            to={`/members/${item.member_id}`}
                            className="group flex flex-col font-medium text-white hover:text-brand"
                          >
                            <span className="font-semibold text-zinc-200 group-hover:text-brand">
                              {item.member_name}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">
                              {item.member_code}
                            </span>
                          </Link>
                        </td>

                        <td className="px-4 py-4 font-mono text-zinc-400">
                          {item.member_phone || '—'}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-200">
                              {item.plan_name}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              ₹{formatINR(item.actual_fee)} · {item.duration_value} {item.duration_unit}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 font-mono text-zinc-300">
                          {formatDate(item.expiry_date)}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] ${daysBadgeClass}`}
                          >
                            {daysLeft === 0
                              ? 'Expires Today'
                              : daysLeft === 1
                              ? '1 day remaining'
                              : `${daysLeft} days remaining`}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {item.already_renewed ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-400">
                              <CheckCircle2 size={10} /> Already Renewed
                            </span>
                          ) : item.status === 'expiring_soon' ? (
                            <StatusBadge status="Expiring Soon" />
                          ) : (
                            <StatusBadge status="Active" />
                          )}
                        </td>

                        <td className="py-4 pl-4 pr-6 text-right">
                          {item.already_renewed ? (
                            <button
                              type="button"
                              disabled
                              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-1.5 text-xs font-medium text-zinc-500"
                              title="A renewal membership has already been created for this member"
                            >
                              <CheckCircle2 size={12} className="text-zinc-500" />
                              <span>Renewed</span>
                            </button>
                          ) : (
                            <Button
                              onClick={() => handleOpenRenew(item.membership, item.member_name)}
                              className="px-3 py-1.5 text-xs font-semibold"
                            >
                              Renew
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Expired / Lapsed */}
      {activeTab === 'expired' && (
        <Card className="overflow-hidden p-0">
          {loading && expiredList.length === 0 ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl border border-white/[.05] bg-white/[.02]"
                />
              ))}
            </div>
          ) : expiredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-xl bg-white/5 p-4 text-zinc-400">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">No Lapsed Memberships</h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-400">
                There are no lapsed memberships requiring renewal at this time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[.07] bg-white/[.015] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-3.5 pl-6 pr-4">Member</th>
                    <th className="px-4 py-3.5">Contact</th>
                    <th className="px-4 py-3.5">Expired Plan</th>
                    <th className="px-4 py-3.5">Expired On</th>
                    <th className="px-4 py-3.5">Lapsed Time</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.04]">
                  {expiredList.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-white/[.02]"
                    >
                      <td className="py-4 pl-6 pr-4">
                        <Link
                          to={`/members/${item.member_id}`}
                          className="group flex flex-col font-medium text-white hover:text-brand"
                        >
                          <span className="font-semibold text-zinc-200 group-hover:text-brand">
                            {item.member_name}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-500">
                            {item.member_code}
                          </span>
                        </Link>
                      </td>

                      <td className="px-4 py-4 font-mono text-zinc-400">
                        {item.member_phone || '—'}
                      </td>

                      <td className="px-4 py-4">
                        <span className="font-medium text-zinc-200">
                          {item.plan_name}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-mono text-zinc-400">
                        {formatDate(item.expiry_date)}
                      </td>

                      <td className="px-4 py-4 font-mono text-zinc-400">
                        <span className="inline-flex rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                          {item.days_expired}d ago
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status="Expired" />
                      </td>

                      <td className="py-4 pl-4 pr-6 text-right">
                        <Button
                          onClick={() => handleOpenRenew(item.membership, item.member_name)}
                          className="px-3 py-1.5 text-xs font-semibold"
                        >
                          Renew
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Renewal History */}
      {activeTab === 'history' && (
        <Card className="overflow-hidden p-0">
          {!historyData || historyData.renewals.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-xl bg-white/5 p-4 text-zinc-400">
                <History size={32} />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">No Renewal History</h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-400">
                Completed membership renewals will appear here with delay analysis and timeliness metrics.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[.07] bg-white/[.015] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-3.5 pl-6 pr-4">Member</th>
                    <th className="px-4 py-3.5">Plan</th>
                    <th className="px-4 py-3.5">Previous Expiry</th>
                    <th className="px-4 py-3.5">Renewal Start</th>
                    <th className="px-4 py-3.5">Delay Gap</th>
                    <th className="px-4 py-3.5">Timeliness</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Contracted Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.04]">
                  {historyData.renewals.map((r) => (
                    <tr key={r.id} className="transition hover:bg-white/[.02]">
                      <td className="py-4 pl-6 pr-4">
                        <Link
                          to={`/members/${r.member_id}`}
                          className="group flex flex-col font-medium text-white hover:text-brand"
                        >
                          <span className="font-semibold text-zinc-200 group-hover:text-brand">
                            {r.member_name}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-500">
                            {r.member_code}
                          </span>
                        </Link>
                      </td>

                      <td className="px-4 py-4 font-medium text-zinc-200">
                        {r.plan_name}
                      </td>

                      <td className="px-4 py-4 font-mono text-zinc-400">
                        {formatDate(r.previous_expiry_date)}
                      </td>

                      <td className="px-4 py-4 font-mono text-zinc-300">
                        {formatDate(r.new_start_date)}
                      </td>

                      <td className="px-4 py-4 font-mono text-zinc-400">
                        {r.renewal_delay_days === 1
                          ? 'Seamless (1d)'
                          : `${r.renewal_delay_days} days`}
                      </td>

                      <td className="px-4 py-4">
                        {r.is_late ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                            <Clock size={11} /> Late ({r.renewal_delay_days}d delay)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                            <CheckCircle2 size={11} /> On Time
                          </span>
                        )}
                      </td>

                      <td className="py-4 pl-4 pr-6 text-right font-mono font-semibold text-white">
                        ₹{formatINR(r.actual_fee)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Reuse existing RenewMembershipModal directly */}
      <RenewMembershipModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleRenewalSuccess}
        previousMembership={selectedMembership}
        memberName={selectedMemberName}
      />
    </div>
  )
}
