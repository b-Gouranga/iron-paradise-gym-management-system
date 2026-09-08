import { useState, type FormEvent } from 'react'
import { Card } from '../Card'
import { Button } from '../Button'
import { Input } from '../Input'
import { updateMyProfile, changePassword } from '../../services/settingsService'
import type { UserProfile } from '../../types/auth'

interface MyAccountTabProps {
  profile: (UserProfile & { last_sign_in_at?: string | null }) | null
  accessToken: string
  onProfileUpdated: () => Promise<void>
}

export function MyAccountTab({ profile, accessToken, onProfileUpdated }: MyAccountTabProps) {
  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accessToken) return

    setProfileError(null)
    setProfileSuccess(false)

    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty.')
      return
    }

    try {
      setProfileSaving(true)
      await updateMyProfile(accessToken, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      })
      await onProfileUpdated()
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 4000)
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accessToken) return

    setPasswordError(null)
    setPasswordSuccess(false)

    if (!currentPassword) {
      setPasswordError('Current password is required.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password cannot be identical to your current password.')
      return
    }

    try {
      setPasswordSaving(true)
      await changePassword(accessToken, {
        currentPassword,
        newPassword,
      })
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 4000)
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <div className="border-b border-white/10 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Personal Profile</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Your personal account details in the Iron Paradise system.
              </p>
            </div>
            {profile && (
              <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400">
                {profile.role === 'owner' ? 'Gym Owner' : 'Gym Trainer'}
              </span>
            )}
          </div>
        </div>

        {profileSuccess && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            Profile updated successfully!
          </div>
        )}

        {profileError && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
            {profileError}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Full Name <span className="text-brand">*</span>
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Gouranga Borah"
                required
                disabled={profileSaving}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Contact Phone
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                disabled={profileSaving}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Email Address (Verified)
              </label>
              <Input
                value={profile?.email ?? ''}
                disabled
                className="cursor-not-allowed opacity-60"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Email address is permanently bound to your authenticated account.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                System Role
              </label>
              <Input
                value={profile?.role === 'owner' ? 'Owner (Full Access)' : 'Trainer (Operational Access)'}
                disabled
                className="cursor-not-allowed font-medium uppercase tracking-wide opacity-60"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Permissions are enforced server-side and cannot be self-modified.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Update Profile'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Password Change Card */}
      <Card>
        <div className="border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Account Security & Password</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Change your account password. Requires verification of your current password.
          </p>
        </div>

        {passwordSuccess && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            Password changed successfully!
          </div>
        )}

        {passwordError && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Current Password <span className="text-brand">*</span>
            </label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
              disabled={passwordSaving}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                New Password <span className="text-brand">*</span>
              </label>
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                disabled={passwordSaving}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Confirm New Password <span className="text-brand">*</span>
              </label>
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                disabled={passwordSaving}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 hover:text-zinc-300">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand focus:ring-brand/40"
              />
              Show passwords
            </label>

            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
