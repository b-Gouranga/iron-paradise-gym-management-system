import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../Card'
import { Button } from '../Button'
import { StatusBadge } from '../StatusBadge'
import { fetchReminderSettings, updateReminderSetting } from '../../services/remindersService'
import type { ReminderSetting, ReminderStage } from '../../types/reminders'

interface ReminderOverviewTabProps {
  isOwner: boolean
  accessToken: string
}

const STAGE_LABELS: Record<ReminderStage, { title: string; description: string }> = {
  membership_expiry_7_days: {
    title: '7 Days Before Expiry',
    description: 'Notifies members 7 days prior to their membership expiring to encourage early renewal.',
  },
  membership_expiry_1_day: {
    title: '1 Day Before Expiry',
    description: 'Urgent reminder sent the day before membership expires.',
  },
  membership_expired: {
    title: 'Membership Expired',
    description: 'Follow-up notification sent on or after membership has expired.',
  },
  payment_due: {
    title: 'Payment Due',
    description: 'Notification sent when membership actual fee has an upcoming payment due date.',
  },
  payment_overdue: {
    title: 'Payment Overdue',
    description: 'Reminder sent when membership pending fees have exceeded the grace period.',
  },
}

export function ReminderOverviewTab({ isOwner, accessToken }: ReminderOverviewTabProps) {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<ReminderSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!accessToken) return
      try {
        setLoading(true)
        setError(null)
        const data = await fetchReminderSettings(accessToken)
        if (mounted) setSettings(data)
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load reminder settings.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [accessToken])

  async function handleToggle(stage: ReminderStage, currentStatus: boolean) {
    if (!isOwner || !accessToken) return

    setToggling(stage)
    setError(null)
    setSuccess(null)

    try {
      const updated = await updateReminderSetting(accessToken, stage, {
        is_enabled: !currentStatus,
      })
      setSettings((prev) => prev.map((s) => (s.reminder_stage === stage ? updated : s)))
      setSuccess(`Reminder stage updated to ${!currentStatus ? 'enabled' : 'disabled'}.`)
      setTimeout(() => setSuccess(null), 3500)
    } catch (err: any) {
      setError(err.message || 'Failed to update reminder stage.')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-6">
      {!isOwner && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <div className="font-semibold">View Only (Staff Member)</div>
          <p className="mt-1 text-zinc-400">
            Reminder stage policies and triggers are configured by the gym owner.
          </p>
        </div>
      )}

      {/* Provider Status Banner */}
      <Card className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">Automated Reminder Engine</h3>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
              Mock Provider (Dev)
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Background reminder dispatcher sends WhatsApp messages via Meta Cloud API and logs an immutable delivery audit trail.
          </p>
        </div>
        <Button
          onClick={() => navigate('/reminders')}
          className="whitespace-nowrap bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          Manage Templates & History &rarr;
        </Button>
      </Card>

      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="py-12 text-center text-sm text-zinc-400">
          Loading reminder configuration...
        </Card>
      ) : (
        <div className="space-y-3">
          {(
            [
              'membership_expiry_7_days',
              'membership_expiry_1_day',
              'membership_expired',
              'payment_due',
              'payment_overdue',
            ] as ReminderStage[]
          ).map((stage) => {
            const currentSetting = settings.find((s) => s.reminder_stage === stage)
            const isEnabled = currentSetting?.is_enabled ?? true
            const channel = currentSetting?.channel ?? 'whatsapp'
            const info = STAGE_LABELS[stage]
            const isBusy = toggling === stage

            return (
              <Card
                key={stage}
                className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">{info.title}</span>
                    <span className="rounded bg-white/[.06] px-2 py-0.5 font-mono text-[11px] uppercase text-zinc-400">
                      {channel}
                    </span>
                    <StatusBadge
                      status={isEnabled ? 'Active' : 'Inactive'}
                    />
                  </div>
                  <p className="text-sm text-zinc-400">{info.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  {isOwner ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggle(stage, isEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-emerald-600' : 'bg-zinc-700'
                      } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-500">Owner Configured</span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
