import { Bell, History, Settings, Sliders } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { MessageHistoryTab } from '../components/reminders/MessageHistoryTab'
import { MessageTemplatesTab } from '../components/reminders/MessageTemplatesTab'
import { ReminderSettingsTab } from '../components/reminders/ReminderSettingsTab'
import { RemindersListTab } from '../components/reminders/RemindersListTab'
import { useReminders } from '../hooks/useReminders'
import type { HistoryFilters, ReminderFilters } from '../types/reminders'

type ActiveTab = 'reminders' | 'history' | 'settings'

export function RemindersPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('reminders')

  const [reminderFilters, setReminderFilters] = useState<ReminderFilters>({
    page: 1,
    limit: 20,
  })

  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    page: 1,
    limit: 20,
  })

  const {
    reminders,
    totalReminders,
    reminderPages,
    stats,
    history,
    totalHistory,
    historyPages,
    settings,
    templates,
    loading,
    error,
    refresh,
  } = useReminders(reminderFilters, historyFilters)

  return (
    <>
      <PageHeader
        title="Automated Reminders & History"
        description="Configure automated expiry and payment reminder rules, manage the scheduled queue, and view WhatsApp delivery audit history."
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-800/40 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex border-b border-white/[.07]">
        <button
          type="button"
          onClick={() => setActiveTab('reminders')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === 'reminders'
              ? 'border-brand text-brand'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Bell size={16} />
          Reminders Queue
          {stats.scheduledCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-bold">
              {stats.scheduledCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === 'history'
              ? 'border-brand text-brand'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <History size={16} />
          Message History
          {totalHistory > 0 && (
            <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[10px] text-zinc-400 font-mono">
              {totalHistory}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === 'settings'
              ? 'border-brand text-brand'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Sliders size={16} />
          Settings & Templates
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'reminders' && (
        <RemindersListTab
          reminders={reminders}
          total={totalReminders}
          page={reminderFilters.page || 1}
          limit={reminderFilters.limit || 20}
          totalPages={reminderPages}
          stats={stats}
          filters={reminderFilters}
          onFilterChange={f => setReminderFilters(prev => ({ ...prev, ...f }))}
          onRefresh={refresh}
          loading={loading}
        />
      )}

      {activeTab === 'history' && (
        <MessageHistoryTab
          history={history}
          total={totalHistory}
          page={historyFilters.page || 1}
          limit={historyFilters.limit || 20}
          totalPages={historyPages}
          filters={historyFilters}
          onFilterChange={f => setHistoryFilters(prev => ({ ...prev, ...f }))}
          loading={loading}
        />
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8">
          <ReminderSettingsTab settings={settings} onUpdated={refresh} />
          <MessageTemplatesTab templates={templates} onUpdated={refresh} />
        </div>
      )}
    </>
  )
}
