import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { MemberFormModal } from '../components/members/MemberFormModal'
import { ArchiveConfirmDialog } from '../components/members/ArchiveConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { useMembersList } from '../hooks/useMembersList'
import type { MemberFilter, MemberListItem } from '../types/members'

const FILTERS: { id: MemberFilter; label: string }[] = [
  { id: 'all', label: 'All Members' },
  { id: 'active', label: 'Active' },
  { id: 'expiring_soon', label: 'Expiring Soon' },
  { id: 'expired', label: 'Expired' },
  { id: 'payment_pending', label: 'Payment Pending' },
  { id: 'payment_overdue', label: 'Payment Overdue' },
  { id: 'inactive', label: 'Inactive' },
]

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function MembersPage() {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  const {
    members,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    setPage,
    refresh,
  } = useMembersList()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<MemberListItem | null>(null)

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Members"
          description="Manage gym members, view membership status, and register new members."
        />
        <div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            Add Member
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-4 text-sm text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <p>{error}</p>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[.07] bg-[#151517] p-1.5">
          {FILTERS.map(f => {
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, ID…"
            aria-label="Search members"
            className="w-full rounded-lg border border-white/10 bg-white/[.04] py-2 pl-9 pr-3.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-brand/70"
          />
        </div>
      </div>

      {/* Members Table */}
      <Card className="mt-6 overflow-hidden">
        <DataTable
          headers={[
            'Member ID',
            'Full Name',
            'Phone',
            'Email',
            'Status',
            'Current Membership',
            'Joined',
            'Actions',
          ]}
        >
          {loading ? (
            <tr>
              <td colSpan={8} className="px-5 py-12 text-center text-sm text-zinc-500">
                Loading members…
              </td>
            </tr>
          ) : members.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-12 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <p className="text-sm font-semibold text-zinc-300">
                    {search || filter !== 'all'
                      ? 'No members match the current filter or search criteria.'
                      : 'No members registered yet.'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {search || filter !== 'all'
                      ? 'Try clearing the search query or selecting a different filter.'
                      : 'Get started by clicking the "Add Member" button above.'}
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            members.map(m => (
              <tr key={m.id} className="transition hover:bg-white/[.02]">
                <td className="table-cell font-mono text-xs font-semibold text-zinc-300">
                  {m.member_code}
                </td>
                <td className="table-cell font-semibold text-white">
                  <Link
                    to={`/members/${m.id}`}
                    className="hover:text-brand hover:underline"
                  >
                    {m.full_name}
                  </Link>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    <span>{m.phone}</span>
                    {m.whatsapp_opt_in && (
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" title="WhatsApp Opted In" />
                    )}
                  </div>
                </td>
                <td className="table-cell text-zinc-400">{m.email || '—'}</td>
                <td className="table-cell">
                  <StatusBadge status={m.status === 'active' ? 'Active' : 'Inactive'} />
                </td>
                <td className="table-cell">
                  {m.current_membership ? (
                    <div className="flex flex-col text-xs">
                      <span className="font-medium text-white">
                        {m.current_membership.plan_name}
                      </span>
                      <span className="text-zinc-500">
                        Exp: {formatDate(m.current_membership.expiry_date)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">No active plan</span>
                  )}
                </td>
                <td className="table-cell text-xs text-zinc-400">
                  {formatDate(m.joining_date)}
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/members/${m.id}`}
                      aria-label={`View details for ${m.full_name}`}
                      className="rounded p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </Link>

                    {isOwner && m.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => setArchiveTarget(m)}
                        aria-label={`Archive ${m.full_name}`}
                        className="rounded p-1 text-zinc-500 hover:bg-white/[.06] hover:text-amber-400"
                        title="Archive Member"
                      >
                        <UserX size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-white/[.07] px-5 py-3 text-xs text-zinc-400">
          <div>
            Showing{' '}
            <span className="font-semibold text-white">
              {total === 0 ? 0 : (page - 1) * 15 + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-white">
              {Math.min(page * 15, total)}
            </span>{' '}
            of <span className="font-semibold text-white">{total}</span> members
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[.06] disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="px-2 text-zinc-500">
              Page {page} of {totalPages || 1}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[.06] disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </Card>

      {/* Add Member Modal */}
      <MemberFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={refresh}
      />

      {/* Archive Confirmation Dialog (Owner Only) */}
      {archiveTarget && (
        <ArchiveConfirmDialog
          isOpen={Boolean(archiveTarget)}
          onClose={() => setArchiveTarget(null)}
          onSuccess={refresh}
          memberId={archiveTarget.id}
          memberName={archiveTarget.full_name}
          memberCode={archiveTarget.member_code}
        />
      )}
    </>
  )
}
