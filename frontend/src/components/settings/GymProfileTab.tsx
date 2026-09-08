import { useState, useEffect, type FormEvent } from 'react'
import { Card } from '../Card'
import { Button } from '../Button'
import { Input } from '../Input'
import type { GymSettings, UpdateGymSettingsInput } from '../../types/settings'

interface GymProfileTabProps {
  settings: GymSettings
  isOwner: boolean
  onSave: (updates: UpdateGymSettingsInput) => Promise<void>
  saving: boolean
}

export function GymProfileTab({ settings, isOwner, onSave, saving }: GymProfileTabProps) {
  const [formData, setFormData] = useState<UpdateGymSettingsInput>({
    gym_name: settings.gym_name,
    contact_phone: settings.contact_phone ?? '',
    contact_email: settings.contact_email ?? '',
    address: settings.address ?? '',
    currency_symbol: settings.currency_symbol,
    currency_code: settings.currency_code,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setFormData({
      gym_name: settings.gym_name,
      contact_phone: settings.contact_phone ?? '',
      contact_email: settings.contact_email ?? '',
      address: settings.address ?? '',
      currency_symbol: settings.currency_symbol,
      currency_code: settings.currency_code,
    })
  }, [settings])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isOwner) return

    setError(null)
    setSuccess(false)

    if (!formData.gym_name?.trim()) {
      setError('Gym name is required.')
      return
    }

    try {
      await onSave({
        gym_name: formData.gym_name.trim(),
        contact_phone: formData.contact_phone?.trim() || null,
        contact_email: formData.contact_email?.trim() || null,
        address: formData.address?.trim() || null,
        currency_symbol: formData.currency_symbol?.trim() || '₹',
        currency_code: formData.currency_code?.trim().toUpperCase() || 'INR',
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to save gym profile.')
    }
  }

  return (
    <div className="space-y-6">
      {!isOwner && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <div className="font-semibold">View Only (Staff Member)</div>
          <p className="mt-1 text-zinc-400">
            Gym profile information is managed by the owner. Staff members have read-only visibility for member inquiries.
          </p>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          Gym profile settings updated successfully!
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      <Card>
        <div className="border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Gym Profile & Branding</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Official gym business details used across messages, receipts, and system templates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Gym Name <span className="text-brand">*</span>
              </label>
              <Input
                disabled={!isOwner || saving}
                value={formData.gym_name ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, gym_name: e.target.value }))}
                placeholder="e.g. Iron Paradise Gym"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Primary Contact Phone
              </label>
              <Input
                disabled={!isOwner || saving}
                value={formData.contact_phone ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))}
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Official Email Address
              </label>
              <Input
                type="email"
                disabled={!isOwner || saving}
                value={formData.contact_email ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, contact_email: e.target.value }))}
                placeholder="e.g. contact@ironparadisegym.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Currency Symbol & Code
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  disabled={!isOwner || saving}
                  value={formData.currency_symbol ?? ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency_symbol: e.target.value }))}
                  placeholder="₹"
                />
                <Input
                  disabled={!isOwner || saving}
                  value={formData.currency_code ?? ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency_code: e.target.value.toUpperCase() }))}
                  placeholder="INR"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Physical Location / Address
            </label>
            <Input
              disabled={!isOwner || saving}
              value={formData.address ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="e.g. Main Road, Guwahati, Assam"
            />
          </div>

          {isOwner && (
            <div className="flex justify-end pt-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Gym Profile'}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}
