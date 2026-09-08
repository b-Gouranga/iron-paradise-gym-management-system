import { useState, useEffect, type FormEvent } from 'react'
import { Card } from '../Card'
import { Button } from '../Button'
import { Input } from '../Input'
import type { GymSettings, UpdateGymSettingsInput } from '../../types/settings'

interface OperationalDefaultsTabProps {
  settings: GymSettings
  isOwner: boolean
  onSave: (updates: UpdateGymSettingsInput) => Promise<void>
  saving: boolean
}

export function OperationalDefaultsTab({
  settings,
  isOwner,
  onSave,
  saving,
}: OperationalDefaultsTabProps) {
  const [formData, setFormData] = useState<{
    member_id_prefix: string
    payment_due_grace_days: number
    reminder_advance_days: number
  }>({
    member_id_prefix: settings.member_id_prefix,
    payment_due_grace_days: settings.payment_due_grace_days,
    reminder_advance_days: settings.reminder_advance_days,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setFormData({
      member_id_prefix: settings.member_id_prefix,
      payment_due_grace_days: settings.payment_due_grace_days,
      reminder_advance_days: settings.reminder_advance_days,
    })
  }, [settings])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isOwner) return

    setError(null)
    setSuccess(false)

    if (!formData.member_id_prefix.trim()) {
      setError('Member ID prefix is required.')
      return
    }

    const graceDays = Number(formData.payment_due_grace_days)
    if (isNaN(graceDays) || graceDays < 0 || graceDays > 365) {
      setError('Payment due grace period must be between 0 and 365 days.')
      return
    }

    const advanceDays = Number(formData.reminder_advance_days)
    if (isNaN(advanceDays) || advanceDays < 1 || advanceDays > 30) {
      setError('Reminder advance notification must be between 1 and 30 days.')
      return
    }

    try {
      await onSave({
        member_id_prefix: formData.member_id_prefix.trim().toUpperCase(),
        payment_due_grace_days: graceDays,
        reminder_advance_days: advanceDays,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to save operational defaults.')
    }
  }

  return (
    <div className="space-y-6">
      {!isOwner && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <div className="font-semibold">View Only (Staff Member)</div>
          <p className="mt-1 text-zinc-400">
            Operational defaults are configured by the gym owner. Staff members have read-only access to gym operating policies.
          </p>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          Operational defaults saved successfully!
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      <Card>
        <div className="border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold text-white">Operational & Membership Defaults</h2>
          <p className="mt-1 text-sm text-zinc-400">
            System defaults for Member ID generation, payment windows, and reminder timelines.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Member ID Sequential Prefix <span className="text-brand">*</span>
            </label>
            <Input
              disabled={!isOwner || saving}
              value={formData.member_id_prefix}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, member_id_prefix: e.target.value.toUpperCase() }))
              }
              placeholder="IP-"
              required
            />
            <p className="mt-1.5 text-xs text-zinc-400">
              Used when generating sequential member codes (e.g. <span className="font-mono text-zinc-300">IP-00001</span>). Existing historical member IDs are permanently preserved and never altered.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Payment Due Grace Period (Days)
              </label>
              <Input
                type="number"
                min="0"
                max="365"
                disabled={!isOwner || saving}
                value={formData.payment_due_grace_days}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, payment_due_grace_days: parseInt(e.target.value, 10) || 0 }))
                }
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                Standard window from membership start date before payment is flagged as overdue.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Reminder Advance Window (Days)
              </label>
              <Input
                type="number"
                min="1"
                max="30"
                disabled={!isOwner || saving}
                value={formData.reminder_advance_days}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, reminder_advance_days: parseInt(e.target.value, 10) || 7 }))
                }
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                Days in advance of membership expiry when pre-expiry reminders are queued.
              </p>
            </div>
          </div>

          {isOwner && (
            <div className="flex justify-end pt-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Defaults'}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}
