import { useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CreditCard,
  Filter,
  History,
  Layers,
  PieChart,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { ReportKPIs } from '../components/reports/ReportKPIs'
import { RevenueReportTab } from '../components/reports/RevenueReportTab'
import { PaymentReportTab } from '../components/reports/PaymentReportTab'
import { MembershipReportTab } from '../components/reports/MembershipReportTab'
import { RenewalReportTab } from '../components/reports/RenewalReportTab'
import { useReports } from '../hooks/useReports'
import type { DatePreset, ReportPeriod, ReportTab, PaymentStatus } from '../types/reports'

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all_time', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

export function ReportsPage() {
  const {
    activeTab,
    setActiveTab,
    filters,
    updateFilters,
    plans,
    overview,
    revenueData,
    paymentData,
    membershipData,
    renewalData,
    loading,
    error,
    refresh,
  } = useReports()

  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'all'>('all')

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive insights across revenue, payment collection, membership lifecycles, and renewal performance."
      >
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-brand' : ''} />
          Refresh
        </button>
      </PageHeader>

      {/* Global Filter Bar */}
      <div className="rounded-2xl border border-white/[.07] bg-[#151517] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Calendar size={13} />
              Period:
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => updateFilters({ preset: preset.value })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filters.preset === preset.value
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-white/[.03] text-zinc-400 hover:bg-white/[.07] hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Secondary Filters: Plan dropdown & Custom Dates */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Custom Date Inputs */}
            {filters.preset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.date_from ?? ''}
                  onChange={(e) => updateFilters({ date_from: e.target.value })}
                  className="rounded-lg border border-white/[.1] bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
                <span className="text-xs text-zinc-500">to</span>
                <input
                  type="date"
                  value={filters.date_to ?? ''}
                  onChange={(e) => updateFilters({ date_to: e.target.value })}
                  className="rounded-lg border border-white/[.1] bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
            )}

            {/* Plan Filter */}
            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-zinc-500" />
              <select
                value={filters.plan_id ?? 'all'}
                onChange={(e) => updateFilters({ plan_id: e.target.value })}
                className="rounded-lg border border-white/[.1] bg-black/40 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-brand"
              >
                <option value="all">All Membership Plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded bg-red-500/20 px-2.5 py-1 font-semibold text-red-300 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Executive Summary / KPI Cards */}
      <ReportKPIs overview={overview} loading={loading} />

      {/* Tab Navigation */}
      <div className="border-b border-white/[.07]">
        <div className="flex space-x-1 sm:space-x-4">
          <button
            type="button"
            onClick={() => setActiveTab('revenue')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'revenue'
                ? 'border-brand text-brand'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingUp size={16} />
            Revenue Report
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'payments'
                ? 'border-brand text-brand'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <CreditCard size={16} />
            Payments & Dues
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('memberships')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'memberships'
                ? 'border-brand text-brand'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Layers size={16} />
            Membership Lifecycle
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('renewals')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'renewals'
                ? 'border-brand text-brand'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <History size={16} />
            Renewal Analysis
          </button>
        </div>
      </div>

      {/* Active Tab View */}
      <div>
        {activeTab === 'revenue' && (
          <RevenueReportTab
            data={revenueData}
            loading={loading}
            period={filters.period ?? 'daily'}
            onPeriodChange={(p: ReportPeriod) => updateFilters({ period: p })}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentReportTab
            data={paymentData}
            loading={loading}
            selectedStatus={paymentStatusFilter}
            onStatusChange={(status) => {
              setPaymentStatusFilter(status)
              updateFilters({ payment_status: status })
            }}
          />
        )}

        {activeTab === 'memberships' && (
          <MembershipReportTab data={membershipData} loading={loading} />
        )}

        {activeTab === 'renewals' && (
          <RenewalReportTab data={renewalData} loading={loading} />
        )}
      </div>
    </div>
  )
}
