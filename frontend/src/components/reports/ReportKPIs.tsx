import { ArrowUpRight, CheckCircle2, Clock, CreditCard, DollarSign, RefreshCw, Users } from 'lucide-react'
import { Card } from '../Card'
import type { ReportsOverviewData } from '../../types/reports'

interface ReportKPIsProps {
  overview: ReportsOverviewData | null
  loading?: boolean
}

function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(val)
}

export function ReportKPIs({ overview, loading }: ReportKPIsProps) {
  if (loading && !overview) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse p-4">
            <div className="h-4 w-20 rounded bg-white/5" />
            <div className="mt-3 h-7 w-24 rounded bg-white/10" />
            <div className="mt-2 h-3 w-16 rounded bg-white/5" />
          </Card>
        ))}
      </div>
    )
  }

  const kpis = [
    {
      label: 'Total Revenue',
      value: overview ? `₹${formatINR(overview.total_revenue)}` : '₹0',
      detail: overview ? `${overview.total_transactions} transactions` : '0 transactions',
      icon: DollarSign,
      tone: 'emerald',
    },
    {
      label: 'Transactions',
      value: overview ? overview.total_transactions.toLocaleString('en-IN') : '0',
      detail: 'Recorded payments',
      icon: CreditCard,
      tone: 'brand',
    },
    {
      label: 'Pending Dues',
      value: overview ? `₹${formatINR(overview.pending_dues)}` : '₹0',
      detail: 'Outstanding balance',
      icon: Clock,
      tone: overview && overview.pending_dues > 0 ? 'amber' : 'zinc',
    },
    {
      label: 'Active Members',
      value: overview ? overview.active_members.toLocaleString('en-IN') : '0',
      detail: 'Current active roster',
      icon: Users,
      tone: 'emerald',
    },
    {
      label: 'Expired Members',
      value: overview ? overview.expired_members.toLocaleString('en-IN') : '0',
      detail: 'Lapsed memberships',
      icon: CheckCircle2,
      tone: overview && overview.expired_members > 0 ? 'red' : 'zinc',
    },
    {
      label: 'Total Renewals',
      value: overview ? overview.total_renewals.toLocaleString('en-IN') : '0',
      detail: 'Historical renewals',
      icon: RefreshCw,
      tone: 'sky',
    },
  ]

  const toneStyles: Record<string, { text: string; bg: string }> = {
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    brand: { text: 'text-brand', bg: 'bg-brand/10' },
    amber: { text: 'text-amber-400', bg: 'bg-amber-400/10' },
    red: { text: 'text-red-400', bg: 'bg-red-400/10' },
    sky: { text: 'text-sky-400', bg: 'bg-sky-400/10' },
    zinc: { text: 'text-zinc-400', bg: 'bg-zinc-400/10' },
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon
        const style = toneStyles[kpi.tone] ?? toneStyles.zinc
        return (
          <Card key={idx} className="p-4 transition hover:border-white/15">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">{kpi.label}</span>
              <div className={`rounded-lg p-1.5 ${style.bg}`}>
                <Icon size={14} className={style.text} />
              </div>
            </div>
            <p className="mt-3 text-xl font-bold tracking-tight text-white">{kpi.value}</p>
            <p className="mt-1 text-[11px] text-zinc-500">{kpi.detail}</p>
          </Card>
        )
      })}
    </div>
  )
}
