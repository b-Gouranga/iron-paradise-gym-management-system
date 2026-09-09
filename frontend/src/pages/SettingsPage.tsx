import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { useAuth } from '../hooks/useAuth'
import { GymProfileTab } from '../components/settings/GymProfileTab'
import { OperationalDefaultsTab } from '../components/settings/OperationalDefaultsTab'
import { ReminderOverviewTab } from '../components/settings/ReminderOverviewTab'
import { MyAccountTab } from '../components/settings/MyAccountTab'
import { AuditLogsTab } from '../components/settings/AuditLogsTab'
import { fetchGymSettings, updateGymSettings, fetchMyProfile } from '../services/settingsService'
import type { GymSettings, SettingsTab, UpdateGymSettingsInput } from '../types/settings'
import type { UserProfile } from '../types/auth'

export function SettingsPage() {
  const { session, isOwner } = useAuth()
  const accessToken = session?.access_token ?? ''

  const [activeTab, setActiveTab] = useState<SettingsTab>('gym')
  const [gymSettings, setGymSettings] = useState<GymSettings | null>(null)
  const [myProfile, setMyProfile] = useState<(UserProfile & { last_sign_in_at?: string | null }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      setError(null)
      const [settingsData, profileData] = await Promise.all([
        fetchGymSettings(accessToken),
        fetchMyProfile(accessToken).catch(() => null),
      ])
      setGymSettings(settingsData)
      setMyProfile(profileData)
    } catch (err: any) {
      setError(err.message || 'Failed to load settings data.')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSaveGymSettings(updates: UpdateGymSettingsInput) {
    if (!accessToken) return
    try {
      setSaving(true)
      const updated = await updateGymSettings(accessToken, updates)
      setGymSettings(updated)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!isOwner && activeTab === 'audit') {
      setActiveTab('gym')
    }
  }, [isOwner, activeTab])

  const tabs: Array<{ id: SettingsTab; label: string; ownerOnlyBadge?: boolean }> = [
    { id: 'gym', label: 'Gym Profile' },
    { id: 'defaults', label: 'Operational Defaults' },
    { id: 'reminders', label: 'Reminders' },
    { id: 'account', label: 'My Account' },
    ...(isOwner ? [{ id: 'audit' as SettingsTab, label: 'Audit Logs', ownerOnlyBadge: true }] : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage gym business details, operational defaults, reminder triggers, and account security."
      />

      {/* Tabs Navigation */}
      <div className="flex border-b border-white/10">
        <nav className="flex space-x-2" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? 'border-brand text-white'
                    : 'border-transparent text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.ownerOnlyBadge && (
                  <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand border border-brand/20">
                    Owner
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="py-16 text-center text-sm text-zinc-400">
          Loading system settings...
        </Card>
      ) : (
        <div>
          {activeTab === 'gym' && gymSettings && (
            <GymProfileTab
              settings={gymSettings}
              isOwner={isOwner}
              onSave={handleSaveGymSettings}
              saving={saving}
            />
          )}

          {activeTab === 'defaults' && gymSettings && (
            <OperationalDefaultsTab
              settings={gymSettings}
              isOwner={isOwner}
              onSave={handleSaveGymSettings}
              saving={saving}
            />
          )}

          {activeTab === 'reminders' && (
            <ReminderOverviewTab
              isOwner={isOwner}
              accessToken={accessToken}
            />
          )}

          {activeTab === 'account' && (
            <MyAccountTab
              profile={myProfile}
              accessToken={accessToken}
              onProfileUpdated={loadData}
            />
          )}

          {activeTab === 'audit' && isOwner && (
            <AuditLogsTab accessToken={accessToken} />
          )}
        </div>
      )}
    </div>
  )
}
