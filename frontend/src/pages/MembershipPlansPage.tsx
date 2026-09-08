import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit2,
  Plus,
  Power,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { PlanFormModal } from '../components/plans/PlanFormModal'
import { PlanStatusDialog } from '../components/plans/PlanStatusDialog'
import { useAuth } from '../hooks/useAuth'
import { useMembershipPlans } from '../hooks/useMembershipPlans'
import type { MembershipPlan, MembershipPlanFilter } from '../types/membershipPlans'

const FILTERS: { id: MembershipPlanFilter; label: string }[] = [
  { id: 'all', label: 'All Plans' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
]

function formatDuration(val: number, unit: string): string {
  const singularMap: Record<string, string> = {
    days: 'Day',
    months: 'Month',
    years: 'Year',
  }
  const pluralMap: Record<string, string> = {
    days: 'Days',
    months: 'Months',
    years: 'Years',
  }
  const label = val === 1 ? singularMap[unit] ?? unit : pluralMap[unit] ?? unit
  return `${val} ${label}`
}

const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

export function MembershipPlansPage() {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  const { plans, loading, error, filter, setFilter, refresh } = useMembershipPlans()

  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null)
  const [statusDialogTarget, setStatusDialogTarget] = useState<MembershipPlan | null>(null)

  function handleOpenAdd() {
    setEditingPlan(null)
    setIsFormModalOpen(true)
  }

  function handleOpenEdit(plan: MembershipPlan) {
    setEditingPlan(plan)
    setIsFormModalOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Membership Plans"
          description="Manage reusable membership plans, durations, and pricing templates."
        />
        <div>
          <Button onClick={handleOpenAdd} className="flex items-center gap-2">
            <Plus size={16} />
            Add Plan
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-4 text-sm text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <p>{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-xl border border-white/[.07] bg-[#151517] p-1.5">
          {FILTERS.map(f => {
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-zinc-400 hover:bg-white/[.06] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <p className="hidden text-xs text-zinc-500 sm:block">
          Plans serve as templates for member purchases
        </p>
      </div>

      {/* Plans Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 w-1/3 rounded bg-white/10" />
                  <div className="h-8 w-1/2 rounded bg-white/10" />
                  <div className="h-3 w-3/4 rounded bg-white/5" />
                  <div className="h-8 w-full rounded bg-white/5" />
                </div>
              </Card>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-zinc-500">
                <Calendar size={28} />
              </div>
              <p className="text-base font-semibold text-white">
                {filter === 'all'
                  ? 'No membership plans created yet'
                  : `No ${filter} membership plans found`}
              </p>
              <p className="max-w-md text-xs leading-5 text-zinc-400">
                {filter === 'all'
                  ? 'Create your gym membership plan templates (e.g. Monthly, Quarterly, Annual) to start enrolling members.'
                  : `Try switching to "All Plans" to view all available templates.`}
              </p>
              {filter === 'all' && (
                <Button onClick={handleOpenAdd} className="mt-2 flex items-center gap-2">
                  <Plus size={16} />
                  Create First Plan
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map(plan => (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between p-6 transition hover:border-white/20 ${
                  !plan.is_active ? 'opacity-70' : ''
                }`}
              >
                <div>
                  {/* Top Bar: Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-['Oswald'] text-xl font-bold uppercase tracking-wide text-white">
                      {plan.name}
                    </h3>
                    <StatusBadge status={plan.is_active ? 'Active' : 'Inactive'} />
                  </div>

                  {/* Pricing and Duration */}
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight text-white">
                      {formatINR(plan.default_fee)}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      / {formatDuration(plan.duration_value, plan.duration_unit)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mt-3 min-h-[40px] text-xs leading-5 text-zinc-400">
                    {plan.description || (
                      <span className="italic text-zinc-600">No description provided</span>
                    )}
                  </p>
                </div>

                {/* Footer Controls */}
                <div className="mt-6 flex items-center justify-between border-t border-white/[.07] pt-4">
                  <span className="text-[11px] text-zinc-500">
                    Duration: {formatDuration(plan.duration_value, plan.duration_unit)}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Edit button (Owner & Trainer) */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(plan)}
                      aria-label={`Edit ${plan.name}`}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[.08] hover:text-white"
                      title="Edit Plan Template"
                    >
                      <Edit2 size={13} />
                      Edit
                    </button>

                    {/* Deactivate / Reactivate button (Owner Only) */}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setStatusDialogTarget(plan)}
                        aria-label={
                          plan.is_active
                            ? `Deactivate ${plan.name}`
                            : `Reactivate ${plan.name}`
                        }
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                          plan.is_active
                            ? 'border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                            : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                        }`}
                        title={plan.is_active ? 'Deactivate Plan' : 'Reactivate Plan'}
                      >
                        {plan.is_active ? (
                          <>
                            <Power size={13} />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <RotateCcw size={13} />
                            Reactivate
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Plan Form Modal (Add / Edit) */}
      <PlanFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={refresh}
        plan={editingPlan}
      />

      {/* Plan Status Confirmation Dialog (Owner Only) */}
      <PlanStatusDialog
        isOpen={Boolean(statusDialogTarget)}
        onClose={() => setStatusDialogTarget(null)}
        onSuccess={refresh}
        plan={statusDialogTarget}
      />
    </>
  )
}
