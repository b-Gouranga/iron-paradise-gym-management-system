import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CreditCard,
  Edit2,
  History,
  IndianRupee,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RotateCcw,
  UserX,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { ArchiveConfirmDialog } from '../components/members/ArchiveConfirmDialog'
import { MemberFormModal } from '../components/members/MemberFormModal'
import { AddMembershipModal } from '../components/memberships/AddMembershipModal'
import { RenewMembershipModal } from '../components/memberships/RenewMembershipModal'
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal'
import { MemberRemindersCard } from '../components/reminders/MemberRemindersCard'
import { useAuth } from '../hooks/useAuth'
import { useMemberDetail } from '../hooks/useMemberDetail'
import { useMemberMemberships } from '../hooks/useMemberMemberships'
import { useMemberPayments } from '../hooks/useMemberPayments'
import type { Membership } from '../types/memberships'
import type { PaymentMethod, PaymentStatus } from '../types/payments'
import type { Status } from '../types'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const [y, m, d] = dateOnly.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

function mapMembershipStatus(
  status: string,
  startDate?: string,
  expiryDate?: string,
): Status {
  if (status === 'cancelled') return 'Cancelled'
  const today = new Date().toISOString().split('T')[0]
  if (startDate && startDate > today) return 'Future'
  if (expiryDate && expiryDate < today) return 'Expired'
  if (startDate && expiryDate && startDate <= today && expiryDate >= today) {
    const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    if (expiryDate <= in7Days) return 'Expiring Soon'
    return 'Active'
  }
  if (status === 'future') return 'Future'
  if (status === 'expired') return 'Expired'
  if (status === 'active') return 'Active'
  return 'Inactive'
}

function getPaymentMethodBadge(method: PaymentMethod) {
  switch (method) {
    case 'cash':
      return { label: 'Cash', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
    case 'upi':
      return { label: 'UPI', classes: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
    case 'card':
      return { label: 'Card', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'bank_transfer':
      return { label: 'Bank', classes: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' }
    default:
      return { label: 'Other', classes: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' }
  }
}

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  const { member, loading, error, refresh } = useMemberDetail(id)
  const {
    memberships,
    currentMembership,
    loading: loadingMemberships,
    refresh: refreshMemberships,
  } = useMemberMemberships(id)
  const {
    summary: paymentSummary,
    loading: loadingPayments,
    refresh: refreshPayments,
  } = useMemberPayments(id)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [isAddMembershipOpen, setIsAddMembershipOpen] = useState(false)
  const [renewTarget, setRenewTarget] = useState<Membership | null>(null)
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
  const [recordPaymentMembershipId, setRecordPaymentMembershipId] = useState<string | undefined>(undefined)

  function handleMembershipSuccess() {
    refresh()
    refreshMemberships()
    refreshPayments()
  }

  function handlePaymentSuccess() {
    refresh()
    refreshMemberships()
    refreshPayments()
  }

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
        {/* Left 2 Columns: Personal Details & Memberships */}
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
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Current Membership
              </h2>
              <div className="flex items-center gap-2">
                {currentMembership && (() => {
                  const currPay = paymentSummary?.memberships_summary.find(s => s.membership_id === currentMembership.id)
                  if (!currPay || currPay.pending_amount <= 0) return null
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setRecordPaymentMembershipId(currentMembership.id)
                        setIsRecordPaymentOpen(true)
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                    >
                      <IndianRupee size={13} />
                      Collect Payment
                    </button>
                  )
                })()}
                {currentMembership && (
                  <button
                    type="button"
                    onClick={() => setRenewTarget(currentMembership)}
                    className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-brand/20 hover:text-white"
                  >
                    <RotateCcw size={13} />
                    Renew Plan
                  </button>
                )}
              </div>
            </div>

            {loadingMemberships ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                Loading membership status…
              </div>
            ) : currentMembership ? (
              (() => {
                const currPay = paymentSummary?.memberships_summary.find(s => s.membership_id === currentMembership.id)
                const totalPaid = currPay?.total_paid ?? 0
                const pendingAmt = currPay?.pending_amount ?? 0
                const payStatus = currPay?.payment_status ?? null

                return (
                  <div className="mt-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
                      <div className="rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                        <p className="text-xs text-zinc-500">Plan</p>
                        <p className="mt-0.5 font-semibold text-white">
                          {currentMembership.plan_name}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {currentMembership.duration_value} {currentMembership.duration_unit}
                        </p>
                      </div>

                      <div className="rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                        <p className="text-xs text-zinc-500">Validity</p>
                        <p className="mt-0.5 font-semibold text-white">
                          {formatDate(currentMembership.start_date)}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          to {formatDate(currentMembership.expiry_date)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                        <p className="text-xs text-zinc-500">Actual Fee</p>
                        <p className="mt-0.5 font-semibold text-white">
                          {formatINR(currentMembership.actual_fee)}
                        </p>
                        <p className="text-[11px] text-zinc-500">Contracted price</p>
                      </div>

                      <div className="rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                        <p className="text-xs text-zinc-500">Payment Status</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {payStatus ? (
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${
                                payStatus === 'Paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : payStatus === 'Partially Paid'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-brand/10 text-brand border-brand/20'
                              }`}
                            >
                              {payStatus}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500">—</span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          Paid: <span className="text-emerald-400 font-medium">{formatINR(totalPaid)}</span>
                        </p>
                      </div>

                      <div className="rounded-lg border border-white/[.05] bg-white/[.02] p-3">
                        <p className="text-xs text-zinc-500">Remaining Due</p>
                        <p className={`mt-0.5 font-semibold ${pendingAmt > 0 ? 'text-brand' : 'text-zinc-400'}`}>
                          {formatINR(pendingAmt)}
                        </p>
                        {currentMembership.payment_due_date ? (
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Due: {formatDate(currentMembership.payment_due_date)}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Status: {currentMembership.status.toUpperCase()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-white/[.06] bg-white/[.02] p-6 text-center">
                <p className="text-xs text-zinc-400">
                  No active membership on record for this member.
                </p>
                <Button
                  onClick={() => setIsAddMembershipOpen(true)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Plus size={14} />
                  Assign Membership
                </Button>
              </div>
            )}
          </Card>

          {/* Membership & Renewal History */}
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">
                  Membership & Renewal History
                </h3>
                <span className="rounded bg-white/[.06] px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                  {memberships.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMembershipOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-red-400"
              >
                <Plus size={14} />
                New Membership
              </button>
            </div>

            <div className="mt-4">
              {loadingMemberships ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  Loading membership history…
                </div>
              ) : memberships.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  No membership history recorded yet. Click &ldquo;New Membership&rdquo; above to assign a plan.
                </div>
              ) : (
                <div className="space-y-3">
                  {memberships.map((m, idx) => {
                    const mPayment = paymentSummary?.memberships_summary.find(s => s.membership_id === m.id)
                    const isDue = mPayment && mPayment.pending_amount > 0

                    return (
                      <div
                        key={m.id}
                        className="flex flex-col gap-3 rounded-xl border border-white/[.06] bg-white/[.02] p-4 transition hover:border-white/10 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-white">{m.plan_name}</span>
                            <span className="text-xs text-zinc-500">
                              ({m.duration_value} {m.duration_unit})
                            </span>
                            <StatusBadge
                              status={mapMembershipStatus(m.status, m.start_date, m.expiry_date)}
                            />
                            {mPayment && (
                              <span
                                className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                  mPayment.payment_status === 'Paid'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : mPayment.payment_status === 'Partially Paid'
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    : 'bg-brand/10 text-brand border border-brand/20'
                                }`}
                              >
                                {mPayment.payment_status}
                              </span>
                            )}
                            {m.renewal_delay_days != null && (
                              <span
                                className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                  m.renewal_delay_days <= 1
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-amber-500/10 text-amber-300'
                                }`}
                                title={`Gap between previous expiry and new start: ${m.renewal_delay_days} days`}
                              >
                                {m.renewal_delay_days <= 1
                                  ? 'continuous'
                                  : `+${m.renewal_delay_days}d gap`}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                            <span>
                              {formatDate(m.start_date)} → {formatDate(m.expiry_date)}
                            </span>
                            <span className="font-medium text-white">
                              Fee: {formatINR(m.actual_fee)}
                            </span>
                            {mPayment && (
                              <span>
                                Paid:{' '}
                                <strong className="text-emerald-300 font-semibold">
                                  {formatINR(mPayment.total_paid)}
                                </strong>{' '}
                                / Due:{' '}
                                <strong className={mPayment.pending_amount > 0 ? 'text-brand font-semibold' : 'text-zinc-400'}>
                                  {formatINR(mPayment.pending_amount)}
                                </strong>
                              </span>
                            )}
                            {m.payment_due_date && (
                              <span className="text-zinc-500">
                                Due: {formatDate(m.payment_due_date)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          {isDue && (
                            <button
                              type="button"
                              onClick={() => {
                                setRecordPaymentMembershipId(m.id)
                                setIsRecordPaymentOpen(true)
                              }}
                              className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                              title="Record payment for this membership"
                            >
                              <IndianRupee size={12} />
                              Pay Due
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setRenewTarget(m)}
                            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[.08] hover:text-white"
                            title="Renew from this membership"
                          >
                            <RotateCcw size={12} />
                            Renew
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Payments & Reminders History Placeholders */}
        <div className="space-y-7">
          {/* Payment History & Balance */}
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">
                  Payment History
                </h3>
                <span className="rounded bg-white/[.06] px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                  {paymentSummary?.payments.length ?? 0}
                </span>
              </div>
              {memberships.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRecordPaymentMembershipId(currentMembership?.id ?? memberships[0]?.id)
                    setIsRecordPaymentOpen(true)
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  <Plus size={14} />
                  Record Payment
                </button>
              )}
            </div>

            {/* Financial Balance Summary */}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/[.08] bg-white/[.02] p-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Contracted</p>
                <p className="mt-0.5 font-semibold text-white text-xs sm:text-sm">
                  {formatINR(paymentSummary?.total_contracted_fee ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total Paid</p>
                <p className="mt-0.5 font-semibold text-emerald-400 text-xs sm:text-sm">
                  {formatINR(paymentSummary?.total_paid ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Balance Due</p>
                <p className={`mt-0.5 font-semibold text-xs sm:text-sm ${
                  (paymentSummary?.total_pending ?? 0) > 0 ? 'text-brand' : 'text-zinc-400'
                }`}>
                  {formatINR(paymentSummary?.total_pending ?? 0)}
                </p>
              </div>
            </div>

            {/* Transactions List */}
            <div className="mt-4">
              {loadingPayments ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  Loading payment records…
                </div>
              ) : !paymentSummary || paymentSummary.payments.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  No payment records found. Use &ldquo;Record Payment&rdquo; above to record money collected manually.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {paymentSummary.payments.map(p => {
                    const mBadge = getPaymentMethodBadge(p.payment_method)
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-white/[.06] bg-white/[.02] p-3 transition hover:border-white/10"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-400 text-sm">
                            {formatINR(p.amount)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${mBadge.classes}`}
                          >
                            {mBadge.label}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-400">
                          <span className="capitalize">{p.purpose.replace(/_/g, ' ')}</span>
                          <span className="text-[11px] text-zinc-500">{formatDate(p.payment_date)}</span>
                        </div>
                        {p.plan_name && (
                          <div className="mt-1 text-[11px] text-zinc-500">
                            Plan: <span className="text-zinc-400">{p.plan_name}</span>
                          </div>
                        )}
                        {p.notes && (
                          <p className="mt-1 rounded bg-white/[.02] px-2 py-1 text-[11px] text-zinc-400 italic">
                            &ldquo;{p.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Automated Reminders & Message History (Part 9) */}
          <MemberRemindersCard memberId={member.id} memberName={member.full_name} />
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

      {/* Add Membership Modal */}
      <AddMembershipModal
        isOpen={isAddMembershipOpen}
        onClose={() => setIsAddMembershipOpen(false)}
        onSuccess={handleMembershipSuccess}
        memberId={member.id}
        memberName={member.full_name}
      />

      {/* Renew Membership Modal */}
      <RenewMembershipModal
        isOpen={Boolean(renewTarget)}
        onClose={() => setRenewTarget(null)}
        onSuccess={handleMembershipSuccess}
        previousMembership={renewTarget}
        memberName={member.full_name}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => {
          setIsRecordPaymentOpen(false)
          setRecordPaymentMembershipId(undefined)
        }}
        onSuccess={handlePaymentSuccess}
        memberId={member.id}
        memberName={member.full_name}
        memberships={memberships.map(m => {
          const ms = paymentSummary?.memberships_summary.find(s => s.membership_id === m.id)
          return {
            id: m.id,
            plan_name: m.plan_name,
            actual_fee: m.actual_fee,
            pending_amount: ms?.pending_amount,
            expiry_date: m.expiry_date,
            status: m.status,
          }
        })}
        preselectedMembershipId={recordPaymentMembershipId}
      />
    </>
  )
}
