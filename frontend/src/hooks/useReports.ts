import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import {
  fetchMembershipReport,
  fetchOverview,
  fetchPaymentReport,
  fetchRenewalReport,
  fetchRevenueReport,
} from '../services/reportsService'
import { fetchMembershipPlans } from '../services/membershipPlansService'
import type {
  DatePreset,
  MembershipReportData,
  PaymentReportData,
  RenewalReportData,
  ReportFilters,
  ReportTab,
  ReportsOverviewData,
  RevenueReportData,
} from '../types/reports'
import type { MembershipPlan } from '../types/membershipPlans'

export function getPresetDates(preset: DatePreset): { date_from?: string; date_to?: string } {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  switch (preset) {
    case 'today':
      return { date_from: todayStr, date_to: todayStr }
    case 'this_week': {
      const day = now.getUTCDay()
      const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff))
      return { date_from: monday.toISOString().split('T')[0], date_to: todayStr }
    }
    case 'this_month': {
      const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      return { date_from: firstDay.toISOString().split('T')[0], date_to: todayStr }
    }
    case 'last_30_days': {
      const thirtyDaysAgo = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30),
      )
      return { date_from: thirtyDaysAgo.toISOString().split('T')[0], date_to: todayStr }
    }
    case 'this_year': {
      const firstDayOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
      return { date_from: firstDayOfYear.toISOString().split('T')[0], date_to: todayStr }
    }
    case 'all_time':
    case 'custom':
    default:
      return {}
  }
}

export function useReports() {
  const { session } = useAuth()
  const token = session?.access_token

  const [activeTab, setActiveTab] = useState<ReportTab>('revenue')
  const [filters, setFilters] = useState<ReportFilters>({
    preset: 'all_time',
    period: 'daily',
    plan_id: 'all',
    payment_method: 'all',
    payment_status: 'all',
  })

  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [overview, setOverview] = useState<ReportsOverviewData | null>(null)
  const [revenueData, setRevenueData] = useState<RevenueReportData | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentReportData | null>(null)
  const [membershipData, setMembershipData] = useState<MembershipReportData | null>(null)
  const [renewalData, setRenewalData] = useState<RenewalReportData | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch available membership plans for filter dropdown
  useEffect(() => {
    if (!token) return
    fetchMembershipPlans(token)
      .then(setPlans)
      .catch((err) => console.error('Failed to load membership plans for reports:', err))
  }, [token])

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    const presetRange = getPresetDates(filters.preset)
    const effectiveFilters = {
      ...filters,
      date_from: filters.preset === 'custom' ? filters.date_from : presetRange.date_from,
      date_to: filters.preset === 'custom' ? filters.date_to : presetRange.date_to,
    }

    try {
      // Always load Overview KPIs alongside tab-specific detailed data
      const [overviewRes, tabRes] = await Promise.all([
        fetchOverview(token, effectiveFilters),
        (async () => {
          switch (activeTab) {
            case 'revenue':
              return { type: 'revenue' as const, data: await fetchRevenueReport(token, effectiveFilters) }
            case 'payments':
              return { type: 'payments' as const, data: await fetchPaymentReport(token, effectiveFilters) }
            case 'memberships':
              return { type: 'memberships' as const, data: await fetchMembershipReport(token, effectiveFilters) }
            case 'renewals':
              return { type: 'renewals' as const, data: await fetchRenewalReport(token, effectiveFilters) }
          }
        })(),
      ])

      setOverview(overviewRes)

      if (tabRes.type === 'revenue') setRevenueData(tabRes.data)
      else if (tabRes.type === 'payments') setPaymentData(tabRes.data)
      else if (tabRes.type === 'memberships') setMembershipData(tabRes.data)
      else if (tabRes.type === 'renewals') setRenewalData(tabRes.data)
    } catch (err: any) {
      setError(err.message || 'Failed to load report data.')
    } finally {
      setLoading(false)
    }
  }, [token, activeTab, filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateFilters = (newFilters: Partial<ReportFilters>) => {
    setFilters((prev) => {
      const updated = { ...prev, ...newFilters }
      // If switching preset away from custom, sync preset dates
      if (newFilters.preset && newFilters.preset !== 'custom') {
        const dates = getPresetDates(newFilters.preset)
        updated.date_from = dates.date_from
        updated.date_to = dates.date_to
      }
      return updated
    })
  }

  return {
    activeTab,
    setActiveTab,
    filters,
    updateFilters,
    plans,
    overview,
    revenueData,
    paymentData,
    membershipData,
    renewalData,
    loading,
    error,
    refresh: loadData,
  }
}
