import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CreditCard,
  Edit2,
  History,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  User,
  UserX,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { ArchiveConfirmDialog } from '../components/members/ArchiveConfirmDialog'
import { MemberFormModal } from '../components/members/MemberFormModal'
import { useAuth } from '../hooks/useAuth'
import { useMemberDetail } from '../hooks/useMemberDetail'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  const { member, loading, error, refresh } = useMemberDetail(id)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">
        Loading member details…
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="space-y-4">
        <Link
          to="/members"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to Members
        </Link>
        <div className="flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-4 text-sm text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <p>{error ?? 'Member not found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Back button */}
      <div className="mb-4">
        <Link
          to="/members"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to Members
        </Link>
      </div>

      {/* Header with actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-800 text-lg font-bold text-white">
            {member.full_name
              .split(' ')
              .slice(0, 2)
              .map(w => w[0]?.toUpperCase() ?? '')
              .join('')}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-['Oswald'] text-2xl font-bold uppercase tracking-wide text-white">
                {member.full_name}
              </h1>
              <span className="font-mono text-xs font-semibold text-zinc-400">
                {member.member_code}
              </span>
              <StatusBadge
                status={member.status === 'active' ? 'Active' : 'Inactive'}
              />
            </div>
            <p className="text-xs text-zinc-500">
              Joined on {formatDate(member.joining_date)} · Member since{' '}
              {formatDate(member.created_at)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Edit2 size={15} />
            Edit Profile
          </Button>

          {isOwner && member.status === 'active' && (
            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[.08] hover:text-amber-400"
            >
              <UserX size={15} />
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="mt-8 grid gap-7 lg:grid-cols-3">
        {/* Left 2 Columns: Personal Details & Current Membership */}
        <div className="space-y-7 lg:col-span-2">
          {/* Personal Information */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-white">
              Personal Information
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <div className="flex items-start gap-3 rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                <Phone size={16} className="mt-0.5 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Phone</p>
                  <p className="font-medium text-white">{member.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                <Mail size={16} className="mt-0.5 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Email</p>
                  <p className="font-medium text-white">{member.email || '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                <Calendar size={16} className="mt-0.5 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Date of Birth</p>
                  <p className="font-medium text-white">
                    {formatDate(member.date_of_birth)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                <MapPin size={16} className="mt-0.5 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Address</p>
                  <p className="font-medium text-white">{member.address || '—'}</p>
                </div>
              </div>
            </div>

            {member.notes && (
              <div className="mt-4 rounded-lg border border-white/[.05] bg-white/[.02] p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Notes
                </p>
                <p className="mt-1 text-zinc-300">{member.notes}</p>
              </div>
            )}
          </Card>

          {/* Current Membership */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-white">
              Current Membership
            </h2>
            {member.current_membership ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
                <div className="rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                  <p className="text-xs text-zinc-500">Plan</p>
                  <p className="mt-0.5 font-semibold text-white">
                    {member.current_membership.plan_name}
                  </p>
                </div>

                <div className="rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                  <p className="text-xs text-zinc-500">Valid Until</p>
                  <p className="mt-0.5 font-semibold text-white">
                    {formatDate(member.current_membership.expiry_date)}
                  </p>
                </div>

                <div className="rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                  <p className="text-xs text-zinc-500">Fee</p>
                  <p className="mt-0.5 font-semibold text-white">
                    {formatINR(member.current_membership.actual_fee)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-white/[.06] bg-white/[.02] p-6 text-center text-xs text-zinc-500">
                No active membership on record for this member.
              </div>
            )}
          </Card>

          {/* Membership History Placeholder (Part 7) */}
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">
                  Membership & Renewal History
                </h3>
              </div>
              <span className="rounded bg-white/[.06] px-2 py-0.5 text-[10px] uppercase font-semibold text-zinc-400">
                Part 7
              </span>
            </div>
            <div className="py-8 text-center text-xs text-zinc-500">
              Detailed renewal history, plan changes, and renewal delay tracking
              will appear here once the Membership & Renewal System is integrated (Part 7).
            </div>
          </Card>
        </div>

        {/* Right Column: Payments & Reminders History Placeholders */}
        <div className="space-y-7">
          {/* Payment History Placeholder (Part 8) */}
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">
                  Payment History
                </h3>
              </div>
              <span className="rounded bg-white/[.06] px-2 py-0.5 text-[10px] uppercase font-semibold text-zinc-400">
                Part 8
              </span>
            </div>
            <div className="py-8 text-center text-xs text-zinc-500">
              Transaction records, partial payment splits, and receipts will be
              managed here once the Payment Management module is integrated (Part 8).
            </div>
          </Card>

          {/* Reminder History Placeholder (Part 9) */}
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">
                  Automated Reminders
                </h3>
              </div>
              <span className="rounded bg-white/[.06] px-2 py-0.5 text-[10px] uppercase font-semibold text-zinc-400">
                Part 9
              </span>
            </div>
            <div className="py-8 text-center text-xs text-zinc-500">
              WhatsApp and SMS notification delivery status and schedule will be
              viewable here once the Automated Reminders module is integrated (Part 9).
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Member Modal */}
      <MemberFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={refresh}
        member={member}
      />

      {/* Archive Confirm Dialog */}
      <ArchiveConfirmDialog
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        onSuccess={refresh}
        memberId={member.id}
        memberName={member.full_name}
        memberCode={member.member_code}
      />
    </>
  )
}
