import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, Phone, User, X } from 'lucide-react'
import { useState } from 'react'
import { Input } from '../Input'
import type { CreateTrainerInput, Trainer, UpdateTrainerInput } from '../../types/trainer'

// ============================================================================
// 1. ADD TRAINER MODAL
// ============================================================================

interface AddTrainerModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateTrainerInput) => Promise<unknown>
}

export function AddTrainerModal({ isOpen, onClose, onSubmit }: AddTrainerModalProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('A valid email address is required.')
      return
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      onClose()
      setFullName('')
      setEmail('')
      setPassword('')
      setPhone('')
      setNotes('')
    } catch (err: any) {
      setError(err.message || 'Failed to create trainer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1a1c] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Add New Trainer</h3>
            <p className="text-xs text-zinc-400">Create trainer credentials and staff profile.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.05] hover:text-white">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400">Full Name *</label>
            <div className="mt-1 relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Email Address *</label>
            <div className="mt-1 relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trainer@ironparadise.com"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Initial Password * (min 8 characters)</label>
            <div className="mt-1 relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Phone Number (optional)</label>
            <div className="mt-1 relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specializations, shifts, certifications..."
              rows={2}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[.07]">
            <button type="button" className="rounded-lg border border-white/10 bg-white/[.05] px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[.1] hover:text-white disabled:opacity-50" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none disabled:opacity-50" disabled={loading}>
              {loading ? 'Creating...' : 'Create Trainer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// 2. EDIT TRAINER MODAL
// ============================================================================

interface EditTrainerModalProps {
  isOpen: boolean
  trainer: Trainer | null
  onClose: () => void
  onSubmit: (id: string, data: UpdateTrainerInput) => Promise<unknown>
}

export function EditTrainerModal({ isOpen, trainer, onClose, onSubmit }: EditTrainerModalProps) {
  const [fullName, setFullName] = useState(trainer?.full_name || '')
  const [phone, setPhone] = useState(trainer?.phone || '')
  const [notes, setNotes] = useState(trainer?.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync state when trainer changes
  if (trainer && fullName === '' && trainer.full_name !== '') {
    setFullName(trainer.full_name)
    setPhone(trainer.phone || '')
    setNotes(trainer.notes || '')
  }

  if (!isOpen || !trainer) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit(trainer.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update trainer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1a1c] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Edit Trainer Profile</h3>
            <p className="text-xs text-zinc-400">Update personal and contact details for {trainer.full_name}.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.05] hover:text-white">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400">Email Address</label>
            <p className="mt-1 text-xs text-zinc-400 bg-white/[.03] px-3 py-2 rounded-xl border border-white/[.07]">
              {trainer.email} (Email login cannot be changed directly)
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Full Name *</label>
            <div className="mt-1 relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Phone Number</label>
            <div className="mt-1 relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specializations, shifts, certifications..."
              rows={2}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[.07]">
            <button type="button" className="rounded-lg border border-white/10 bg-white/[.05] px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[.1] hover:text-white disabled:opacity-50" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// 3. DEACTIVATE CONFIRMATION MODAL
// ============================================================================

interface DeactivateTrainerModalProps {
  isOpen: boolean
  trainer: Trainer | null
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
}

export function DeactivateTrainerModal({
  isOpen,
  trainer,
  onClose,
  onConfirm,
}: DeactivateTrainerModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !trainer) return null

  const handleDeactivate = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm(trainer.id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate trainer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#1a1a1c] p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-red-400">
          <div className="rounded-xl bg-red-500/10 p-2.5">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Deactivate Trainer Account?</h3>
            <p className="text-xs text-zinc-400">{trainer.full_name}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/[.07] bg-white/[.02] p-3 text-xs leading-relaxed text-zinc-300">
          Deactivating this trainer account will:
          <ul className="mt-2 list-disc pl-4 space-y-1 text-zinc-400">
            <li>Immediately revoke application login and API access.</li>
            <li>Retain all historical transactions, payments, and member records.</li>
            <li>Allow the account to be reactivated at any time by the owner.</li>
          </ul>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" className="rounded-lg border border-white/10 bg-white/[.05] px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[.1] hover:text-white disabled:opacity-50" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={loading}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Deactivating...' : 'Confirm Deactivation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 4. ACTIVATE CONFIRMATION MODAL
// ============================================================================

interface ActivateTrainerModalProps {
  isOpen: boolean
  trainer: Trainer | null
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
}

export function ActivateTrainerModal({
  isOpen,
  trainer,
  onClose,
  onConfirm,
}: ActivateTrainerModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !trainer) return null

  const handleActivate = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm(trainer.id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to activate trainer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[#1a1a1c] p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-emerald-400">
          <div className="rounded-xl bg-emerald-500/10 p-2.5">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Reactivate Trainer Account</h3>
            <p className="text-xs text-zinc-400">{trainer.full_name}</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-zinc-300">
          Reactivating will immediately restore {trainer.full_name}&apos;s ability to log in and perform trainer duties.
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" className="rounded-lg border border-white/10 bg-white/[.05] px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[.1] hover:text-white disabled:opacity-50" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleActivate}
            disabled={loading}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Activating...' : 'Reactivate Trainer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 5. RESET PASSWORD MODAL
// ============================================================================

interface ResetPasswordModalProps {
  isOpen: boolean
  trainer: Trainer | null
  onClose: () => void
  onSubmit: (id: string, pass: string) => Promise<void>
}

export function ResetPasswordModal({
  isOpen,
  trainer,
  onClose,
  onSubmit,
}: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen || !trainer) return null

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onSubmit(trainer.id, password)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setPassword('')
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a1c] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Reset Trainer Password</h3>
              <p className="text-xs text-zinc-400">{trainer.full_name} ({trainer.email})</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.05] hover:text-white">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <CheckCircle2 size={16} />
            <span>Password updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleReset} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400">New Password * (min 8 characters)</label>
            <div className="mt-1 relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="pl-9 pr-10"
                required
                minLength={8}
                disabled={success}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[.07]">
            <button type="button" className="rounded-lg border border-white/10 bg-white/[.05] px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[.1] hover:text-white disabled:opacity-50" onClick={onClose} disabled={loading || success}>
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none disabled:opacity-50" disabled={loading || success}>
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
