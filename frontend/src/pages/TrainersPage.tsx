import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Info,
  KeyRound,
  Plus,
  Power,
  RefreshCw,
  Search,
  Shield,
  User,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import {
  ActivateTrainerModal,
  AddTrainerModal,
  DeactivateTrainerModal,
  EditTrainerModal,
  ResetPasswordModal,
} from '../components/trainers/TrainerModals'
import { useAuth } from '../hooks/useAuth'
import { useTrainers } from '../hooks/useTrainers'
import type { Trainer, TrainerStatusFilter } from '../types/trainer'

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return 'Never'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return 'Invalid date'
  }
}

function formatDateTime(isoStr?: string | null): string {
  if (!isoStr) return 'Never'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Never'
  }
}

export function TrainersPage() {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  const {
    trainers,
    summary,
    loading,
    error,
    search,
    setSearch,
    status,
    setStatus,
    refresh,
    addTrainer,
    editTrainer,
    activate,
    deactivate,
    resetPassword,
  } = useTrainers()

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null)
  const [deactivatingTrainer, setDeactivatingTrainer] = useState<Trainer | null>(null)
  const [activatingTrainer, setActivatingTrainer] = useState<Trainer | null>(null)
  const [resettingTrainer, setResettingTrainer] = useState<Trainer | null>(null)

  const tabs: { id: TrainerStatusFilter; label: string }[] = [
    { id: 'all', label: 'All Staff' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Trainers & Staff"
        description="Manage gym trainer accounts, operational access, and credentials."
      >
        {isOwner && (
          <Button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2">
            <Plus size={16} />
            <span>Add Trainer</span>
          </Button>
        )}
      </PageHeader>

      {/* Role Notice for Trainers */}
      {!isOwner && (
        <div className="flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-xs text-sky-300">
          <Info size={18} className="shrink-0 text-sky-400" />
          <div>
            <p className="font-semibold text-white">Trainer Staff Directory</p>
            <p className="text-zinc-400 mt-0.5">
              You are signed in as a Trainer. You have view access to the trainer roster. Management actions (creating, updating, activating/deactivating, and password resets) are restricted to the gym owner.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Trainers"
          value={String(summary.total_trainers)}
          detail="Registered staff profiles"
          tone="zinc"
        />
        <StatCard
          label="Active Trainers"
          value={String(summary.active_trainers)}
          detail="Active login access"
          tone="green"
        />
        <StatCard
          label="Inactive Trainers"
          value={String(summary.inactive_trainers)}
          detail="Access revoked"
          tone="amber"
        />
      </div>

      {/* Search & Status Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full rounded-xl border border-white/10 bg-white/[.03] pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.02] p-1 self-start sm:self-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatus(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  status === tab.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto rounded-lg border border-white/10 bg-white/[.05] px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-white/[.1] hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Trainers Table */}
      <Card className="overflow-hidden border border-white/[.07] bg-[#151517]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <RefreshCw size={24} className="animate-spin text-brand" />
            <p className="mt-3 text-xs">Loading trainer directory...</p>
          </div>
        ) : trainers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="rounded-full bg-white/[.03] p-4 text-zinc-500">
              <Users size={32} />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-white">No Trainers Found</h3>
            <p className="mt-1 max-w-sm text-xs text-zinc-500">
              {search || status !== 'all'
                ? 'No trainers match your search and filter criteria.'
                : 'No trainer accounts have been registered yet.'}
            </p>
            {isOwner && !search && status === 'all' && (
              <Button onClick={() => setIsAddOpen(true)} className="mt-4 text-xs">
                Add First Trainer
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[.07] bg-white/[.015] text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Trainer</th>
                  <th className="px-5 py-3.5 font-semibold">Contact</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Last Active</th>
                  <th className="px-5 py-3.5 font-semibold">Added On</th>
                  {isOwner && <th className="px-5 py-3.5 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.05] text-zinc-300">
                {trainers.map((trainer) => {
                  return (
                    <tr key={trainer.id} className="transition hover:bg-white/[.02]">
                      {/* Name & Avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-brand/10 text-brand">
                            <User size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{trainer.full_name}</span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/[.05] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                <Shield size={10} />
                                Trainer
                              </span>
                            </div>
                            {trainer.notes && (
                              <p className="mt-0.5 line-clamp-1 max-w-xs text-[11px] text-zinc-500">
                                {trainer.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-white">{trainer.email}</p>
                        <p className="text-[11px] text-zinc-500">{trainer.phone || 'No phone'}</p>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={trainer.is_active ? 'Active' : 'Inactive'} />
                      </td>

                      {/* Last Active */}
                      <td className="px-5 py-4 text-zinc-400">
                        {formatDateTime(trainer.last_sign_in_at)}
                      </td>

                      {/* Added On */}
                      <td className="px-5 py-4 text-zinc-400">
                        {formatDate(trainer.created_at)}
                      </td>

                      {/* Actions (Owner only) */}
                      {isOwner && (
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingTrainer(trainer)}
                              title="Edit trainer details"
                              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[.05] hover:text-white"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              onClick={() => setResettingTrainer(trainer)}
                              title="Reset trainer password"
                              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[.05] hover:text-amber-400"
                            >
                              <KeyRound size={14} />
                            </button>

                            {trainer.is_active ? (
                              <button
                                onClick={() => setDeactivatingTrainer(trainer)}
                                title="Deactivate trainer access"
                                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Power size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setActivatingTrainer(trainer)}
                                title="Reactivate trainer access"
                                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-emerald-500/10 hover:text-emerald-400"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddTrainerModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={addTrainer}
      />

      <EditTrainerModal
        isOpen={Boolean(editingTrainer)}
        trainer={editingTrainer}
        onClose={() => setEditingTrainer(null)}
        onSubmit={editTrainer}
      />

      <DeactivateTrainerModal
        isOpen={Boolean(deactivatingTrainer)}
        trainer={deactivatingTrainer}
        onClose={() => setDeactivatingTrainer(null)}
        onConfirm={deactivate}
      />

      <ActivateTrainerModal
        isOpen={Boolean(activatingTrainer)}
        trainer={activatingTrainer}
        onClose={() => setActivatingTrainer(null)}
        onConfirm={activate}
      />

      <ResetPasswordModal
        isOpen={Boolean(resettingTrainer)}
        trainer={resettingTrainer}
        onClose={() => setResettingTrainer(null)}
        onSubmit={resetPassword}
      />
    </div>
  )
}
