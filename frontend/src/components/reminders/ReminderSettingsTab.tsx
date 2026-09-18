import { AlertTriangle, Bell, Check, MessageCircle, Shield, Zap } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { updateReminderSetting } from '../../services/remindersService'
import type { ReminderSetting, ReminderStage } from '../../types/reminders'
import { REMINDER_STAGE_LABELS } from '../../types/reminders'

interface ReminderSettingsTabProps {
  settings: ReminderSetting[]
  onUpdated: () => void
}

/**
 * Stages that the engine auto-generates (Part 17 policy).
 * membership_expired and payment_due are preserved for manual send only.
 */
const AUTO_GENERATE_STAGES = new Set<ReminderStage>([
  'membership_expiry_7_days',
  'membership_expiry_1_day',
  'payment_overdue',
])

const STAGE_DESCRIPTIONS: Record<ReminderStage, string> = {
  membership_expiry_7_days:
    'Notifies active members exactly 7 days before their membership plan expires.',
  membership_expiry_1_day:
    'Final reminder sent 1 day before membership expiry date.',
  membership_expired:
    'Follow-up message when membership status becomes expired. Auto-generation is disabled to reduce noise — use manual send when needed.',
  payment_due:
    'Alert when a partial fee balance is due on the scheduled payment due date. Auto-generation is disabled — send manually for individual cases.',
  payment_overdue:
    'Urgent reminder when an unpaid balance passes the payment due date.',
}

export function ReminderSettingsTab({ settings, onUpdated }: ReminderSettingsTabProps) {
  const { isOwner, session } = useAuth()
  const [savingStage, setSavingStage] = useState<string | null>(null)
  const [saveSuccessStage, setSaveSuccessStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Local draft for max_retries edits (keyed by stage)
  const [retriesDraft, setRetriesDraft] = useState<Record<string, string>>({})

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

  async function handleMaxRetriesSave(stage: ReminderStage, currentValue: number) {
    if (!isOwner || !session?.access_token) return
    const raw = retriesDraft[stage]
    if (raw === undefined) return // nothing changed
    const parsed = parseInt(raw, 10)
    if (isNaN(parsed) || parsed < 0 || parsed > 10) {
      setError('Max retries must be a number between 0 and 10.')
      return
    }
    if (parsed === currentValue) {
      // no change, clear draft
      setRetriesDraft(prev => { const n = { ...prev }; delete n[stage]; return n })
      return
    }
    setSavingStage(stage)
    setError(null)
    try {
      await updateReminderSetting(session.access_token, stage, { max_retries: parsed })
      setSaveSuccessStage(stage)
      setTimeout(() => setSaveSuccessStage(null), 2000)
      setRetriesDraft(prev => { const n = { ...prev }; delete n[stage]; return n })
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update max retries.')
    } finally {
      setSavingStage(null)
    }
  }

  // Sort: auto-generate stages first, then manual-only
  const sorted = [...settings].sort((a, b) => {
    const aAuto = AUTO_GENERATE_STAGES.has(a.reminder_stage) ? 0 : 1
    const bAuto = AUTO_GENERATE_STAGES.has(b.reminder_stage) ? 0 : 1
    return aAuto - bAuto
  })

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between rounded-xl border border-white/10 bg-white/[.02] p-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell size={16} className="text-brand" />
            Automated Reminder Stages
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 max-w-xl">
            Configure automated WhatsApp reminder rules. Three stages are auto-generated daily.
            Two stages are preserved for manual sending only and will not be auto-triggered.
          </p>
        </div>
        {!isOwner && (
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-zinc-400 shrink-0">
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
        {sorted.map(s => {
          const isSaving = savingStage === s.reminder_stage
          const isSuccess = saveSuccessStage === s.reminder_stage
          const label = REMINDER_STAGE_LABELS[s.reminder_stage] || s.reminder_stage
          const desc = STAGE_DESCRIPTIONS[s.reminder_stage] || ''
          // Use the DB value as ground truth; fall back to computed set if column not yet migrated
          const isAutoGenerate =
            typeof s.auto_generate === 'boolean'
              ? s.auto_generate
              : AUTO_GENERATE_STAGES.has(s.reminder_stage)
          const maxRetriesValue =
            retriesDraft[s.reminder_stage] !== undefined
              ? retriesDraft[s.reminder_stage]
              : String(s.max_retries ?? 1)

          return (
            <div
              key={s.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                isAutoGenerate
                  ? s.is_enabled
                    ? 'border-white/10 bg-white/[.03]'
                    : 'border-white/[.05] bg-white/[.01] opacity-70'
                  : 'border-amber-800/30 bg-amber-950/10'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-sm">{label}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {/* Enabled/Disabled badge */}
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                          s.is_enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {s.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>

                      {/* Auto-generate / Manual-only badge */}
                      {isAutoGenerate ? (
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-brand/10 text-brand border border-brand/20">
                          <Zap size={9} />
                          Auto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle size={9} />
                          Manual only
                        </span>
                      )}
                    </div>
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

              {/* Footer row */}
              <div className="mt-5 border-t border-white/[.06] pt-3 space-y-2">
                {/* Channel — WhatsApp only (SMS removed in Part 17) */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-400">Channel:</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <MessageCircle size={12} />
                    WhatsApp
                  </span>
                </div>

                {/* Max retries — editable by Owner */}
                {isAutoGenerate && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-zinc-400">Max auto-retries:</span>
                    {isOwner ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={maxRetriesValue}
                          disabled={isSaving}
                          onChange={e =>
                            setRetriesDraft(prev => ({
                              ...prev,
                              [s.reminder_stage]: e.target.value,
                            }))
                          }
                          onBlur={() => handleMaxRetriesSave(s.reminder_stage, s.max_retries ?? 1)}
                          className="w-14 rounded border border-white/10 bg-black/40 px-2 py-0.5 text-xs text-white text-center focus:outline-none focus:border-brand/60 disabled:opacity-50"
                          aria-label={`Max retries for ${label}`}
                        />
                        <span className="text-[10px] text-zinc-500">per day</span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-300">
                        {s.max_retries ?? 1} / day
                      </span>
                    )}
                  </div>
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

      {/* Legend */}
      <div className="rounded-xl border border-white/[.05] bg-white/[.01] p-4 text-xs text-zinc-500 space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-brand/10 text-brand border border-brand/20">
            <Zap size={9} /> Auto
          </span>
          <span>Automatically generated by the daily reminder engine.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle size={9} /> Manual only
          </span>
          <span>Not auto-generated. Send manually from the member detail page or Reminders queue.</span>
        </div>
      </div>
    </div>
  )
}
