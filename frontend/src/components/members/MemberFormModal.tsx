import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { useAuth } from '../../hooks/useAuth'
import { createMember, updateMember } from '../../services/membersService'
import type { MemberDetail, MemberStatus } from '../../types/members'

interface MemberFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  member?: MemberDetail | null
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function MemberFormModal({
  isOpen,
  onClose,
  onSuccess,
  member,
}: MemberFormModalProps) {
  const { session } = useAuth()
  const isEdit = Boolean(member)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [joiningDate, setJoiningDate] = useState(getTodayISO())
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<MemberStatus>('active')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Populate form when opened or when member changes
  useEffect(() => {
    if (member) {
      setFullName(member.full_name ?? '')
      setPhone(member.phone ?? '')
      setEmail(member.email ?? '')
      setAddress(member.address ?? '')
      setDateOfBirth(member.date_of_birth ?? '')
      setJoiningDate(member.joining_date ?? getTodayISO())
      setNotes(member.notes ?? '')
      setStatus(member.status ?? 'active')
    } else {
      setFullName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setDateOfBirth('')
      setJoiningDate(getTodayISO())
      setNotes('')
      setStatus('active')
    }
    setError(null)
    setSubmitting(false)
  }, [member, isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = fullName.trim()
    const trimmedPhone = phone.trim()
    const trimmedJoiningDate = joiningDate.trim()

    if (!trimmedName) {
      setError('Full name is required.')
      return
    }
    if (!trimmedPhone) {
      setError('Phone number is required.')
      return
    }
    if (!trimmedJoiningDate) {
      setError('Joining date is required.')
      return
    }

    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to perform this action.')
      return
    }

    setSubmitting(true)
    try {
      if (isEdit && member) {
        await updateMember(token, member.id, {
          full_name: trimmedName,
          phone: trimmedPhone,
          email: email.trim() || null,
          address: address.trim() || null,
          date_of_birth: dateOfBirth.trim() || null,
          joining_date: trimmedJoiningDate,
          notes: notes.trim() || null,
          status,
        })
      } else {
        await createMember(token, {
          full_name: trimmedName,
          phone: trimmedPhone,
          email: email.trim() || null,
          address: address.trim() || null,
          date_of_birth: dateOfBirth.trim() || null,
          joining_date: trimmedJoiningDate,
          notes: notes.trim() || null,
        })
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div>
            <h2 id="member-modal-title" className="text-lg font-bold text-white">
              {isEdit ? 'Edit Member' : 'Add New Member'}
            </h2>
            {isEdit && member && (
              <p className="mt-0.5 text-xs font-mono text-zinc-400">
                {member.member_code}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Note about member_code on Add */}
          {!isEdit && (
            <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-3 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Member ID:</span> Will be
              automatically generated in sequence (e.g. <span className="font-mono text-white">IP-00001</span>).
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Full Name <span className="text-brand">*</span>
              </label>
              <Input
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Phone Number <span className="text-brand">*</span>
              </label>
              <Input
                required
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. rahul@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Joining Date <span className="text-brand">*</span>
              </label>
              <Input
                required
                type="date"
                value={joiningDate}
                onChange={e => setJoiningDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Date of Birth
              </label>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
              />
            </div>

            {isEdit ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Status
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as MemberStatus)}
                  className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand/70"
                >
                  <option value="active" className="bg-[#1C1C1F] text-white">
                    Active
                  </option>
                  <option value="inactive" className="bg-[#1C1C1F] text-white">
                    Inactive
                  </option>
                </select>
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Address
            </label>
            <Input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Street, locality, city"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Medical notes, fitness goals, or references..."
              className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-brand/70"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-white/[.07] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[.06] hover:text-white"
            >
              Cancel
            </button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
