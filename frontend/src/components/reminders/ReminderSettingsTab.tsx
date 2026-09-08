import { Bell, Check, Clock, MessageCircle, Shield, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { updateReminderSetting } from '../../services/remindersService'
import type { ReminderChannel, ReminderSetting, ReminderStage } from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface ReminderSettingsTabProps {
  settings: ReminderSetting[]
  onUpdated: () => void
}

const STAGE_DESCRIPTIONS: Record<ReminderStage, string> = {
  membership_expiry_7_days: 'Notifies active members exactly 7 days before their membership plan expires.',
  membership_expiry_1_day: 'Final reminder sent 1 day before membership expiry date.',
  membership_expired: 'Follow-up message sent when membership status becomes expired.',
  payment_due: 'Alert sent when a partial fee balance is due on the scheduled payment due date.',
  payment_overdue: 'Urgent reminder sent when an unpaid balance passes the payment due date.',
}

export function ReminderSettingsTab({ settings, onUpdated }: ReminderSettingsTabProps) {
  const { isOwner, session } = useAuth()
  const [savingStage, setSavingStage] = useState<string | null>(null)
  const [saveSuccessStage, setSaveSuccessStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(stage: ReminderStage, currentVal: boolean) {
    if (!isOwner || !session?.access_token) return
    setSavingStage(stage)
    setError(null)
    try {
      await updateReminderSetting(session.access_token, stage, { is_enabled: !currentVal })
      setSaveSuccessStage(stage)
      setTimeout(() => setSaveSuccessStage(null), 2000)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting.')
    } finally {
      setSavingStage(null)
    }
  }

  async function handleChannelChange(stage: ReminderStage, newChannel: ReminderChannel) {
    if (!isOwner || !session?.access_token) return
    setSavingStage(stage)
    setError(null)
    try {
      await updateReminderSetting(session.access_token, stage, { channel: newChannel })
      setSaveSuccessStage(stage)
      setTimeout(() => setSaveSuccessStage(null), 2000)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change channel.')
    } finally {
      setSavingStage(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/10 bg-white/[.02] p-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell size={16} className="text-brand" />
            Automated Reminder Stages
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure automated message triggers. The server-side reminder engine scans active memberships and pending balances against these rules.
          </p>
        </div>
        {!isOwner && (
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-zinc-400">
            <Shield size={13} className="text-zinc-500" />
            <span>Read-only (Owner configuration)</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/40 bg-red-950/30 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Stage Cards */}
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {settings.map(s => {
          const isSaving = savingStage === s.reminder_stage
          const isSuccess = saveSuccessStage === s.reminder_stage
          const label = REMINDER_STAGE_LABELS[s.reminder_stage] || s.reminder_stage
          const desc = STAGE_DESCRIPTIONS[s.reminder_stage] || ''

          return (
            <div
              key={s.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                s.is_enabled
                  ? 'border-white/10 bg-white/[.03]'
                  : 'border-white/[.05] bg-white/[.01] opacity-70'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{label}</h4>
                    <span
                      className={`inline-block mt-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                        s.is_enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {s.is_enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  {/* Enable / Disable toggle button */}
                  {isOwner ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleToggle(s.reminder_stage, s.is_enabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        s.is_enabled ? 'bg-emerald-600' : 'bg-zinc-700'
                      }`}
                      aria-label={`Toggle ${label}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          s.is_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-500">Locked</span>
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-zinc-400">{desc}</p>
              </div>

              <div className="mt-5 border-t border-white/[.06] pt-3 flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-400">Preferred Channel:</span>

                {isOwner ? (
                  <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleChannelChange(s.reminder_stage, 'whatsapp')}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                        s.channel === 'whatsapp'
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <MessageCircle size={12} />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleChannelChange(s.reminder_stage, 'sms')}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                        s.channel === 'sms'
                          ? 'bg-blue-500/20 text-blue-300 font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Smartphone size={12} />
                      SMS
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-zinc-300 uppercase">{s.channel}</span>
                )}
              </div>

              {isSuccess && (
                <div className="mt-2 text-right text-[11px] font-medium text-emerald-400 flex items-center justify-end gap-1">
                  <Check size={12} />
                  Saved
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
