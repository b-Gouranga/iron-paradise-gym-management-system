import type { Request, Response } from 'express'
import {
  getMembershipReport,
  getPaymentReport,
  getRenewalReport,
  getReportsOverview,
  getRevenueReport,
} from '../services/reports/reportsService.js'
import type { ReportFilterParams, ReportPeriod } from '../types/reports.js'
import type { PaymentMethod, PaymentStatus } from '../types/payments.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDateString(val: unknown): val is string {
  if (typeof val !== 'string' || !DATE_RE.test(val)) return false
  const [y, m, d] = val.split('-').map(Number)
  if (!y || !m || !d) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const VALID_PERIODS: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'custom']
const VALID_METHODS: (PaymentMethod | 'all')[] = [
  'cash',
  'upi',
  'card',
  'bank_transfer',
  'other',
  'all',
]
const VALID_STATUSES: (PaymentStatus | 'all')[] = [
  'Paid',
  'Partially Paid',
  'Unpaid',
  'Overdue',
  'all',
]

function extractFilterParams(req: Request): {
  params: ReportFilterParams
  error?: string
} {
  const { date_from, date_to, period, plan_id, payment_method, payment_status } = req.query

  const params: ReportFilterParams = {}

  if (date_from) {
    if (!isValidDateString(date_from)) {
      return { params: {}, error: 'Invalid date_from format. Expected YYYY-MM-DD.' }
    }
    params.date_from = date_from
  }

  if (date_to) {
    if (!isValidDateString(date_to)) {
      return { params: {}, error: 'Invalid date_to format. Expected YYYY-MM-DD.' }
    }
    params.date_to = date_to
  }

  if (params.date_from && params.date_to && params.date_from > params.date_to) {
    return { params: {}, error: 'date_from cannot be after date_to.' }
  }

  if (period) {
    if (!VALID_PERIODS.includes(period as ReportPeriod)) {
      return {
        params: {},
        error: `Invalid period '${period}'. Must be one of: ${VALID_PERIODS.join(', ')}.`,
      }
    }
    params.period = period as ReportPeriod
  }

  if (plan_id && typeof plan_id === 'string' && plan_id !== 'all') {
    params.plan_id = plan_id.trim()
  }

  if (payment_method && typeof payment_method === 'string') {
    if (!VALID_METHODS.includes(payment_method as any)) {
      return {
        params: {},
        error: `Invalid payment_method '${payment_method}'. Must be one of: ${VALID_METHODS.join(', ')}.`,
      }
    }
    params.payment_method = payment_method as PaymentMethod | 'all'
  }

  if (payment_status && typeof payment_status === 'string') {
    if (!VALID_STATUSES.includes(payment_status as any)) {
      return {
        params: {},
        error: `Invalid payment_status '${payment_status}'. Must be one of: ${VALID_STATUSES.join(', ')}.`,
      }
    }
    params.payment_status = payment_status as PaymentStatus | 'all'
  }

  return { params }
}

/**
 * GET /api/reports/overview
 */
export async function getOverview(req: Request, res: Response): Promise<void> {
  const { params, error } = extractFilterParams(req)
  if (error) {
    res.status(400).json({ success: false, error })
    return
  }

  try {
    const data = await getReportsOverview(params)
    res.json({ success: true, data })
  } catch (err: any) {
    console.error('getOverview error:', err)
    res.status(500).json({ success: false, error: err.message || 'Internal server error' })
  }
}

/**
 * GET /api/reports/revenue
 */
export async function getRevenue(req: Request, res: Response): Promise<void> {
  const { params, error } = extractFilterParams(req)
  if (error) {
    res.status(400).json({ success: false, error })
    return
  }

  try {
    const data = await getRevenueReport(params)
    res.json({ success: true, data })
  } catch (err: any) {
    console.error('getRevenue error:', err)
    res.status(500).json({ success: false, error: err.message || 'Internal server error' })
  }
}

/**
 * GET /api/reports/payments
 */
export async function getPayments(req: Request, res: Response): Promise<void> {
  const { params, error } = extractFilterParams(req)
  if (error) {
    res.status(400).json({ success: false, error })
    return
  }

  try {
    const data = await getPaymentReport(params)
    res.json({ success: true, data })
  } catch (err: any) {
    console.error('getPayments error:', err)
    res.status(500).json({ success: false, error: err.message || 'Internal server error' })
  }
}

/**
 * GET /api/reports/memberships
 */
export async function getMemberships(req: Request, res: Response): Promise<void> {
  const { params, error } = extractFilterParams(req)
  if (error) {
    res.status(400).json({ success: false, error })
    return
  }

  try {
    const data = await getMembershipReport(params)
    res.json({ success: true, data })
  } catch (err: any) {
    console.error('getMemberships error:', err)
    res.status(500).json({ success: false, error: err.message || 'Internal server error' })
  }
}

/**
 * GET /api/reports/renewals
 */
export async function getRenewals(req: Request, res: Response): Promise<void> {
  const { params, error } = extractFilterParams(req)
  if (error) {
    res.status(400).json({ success: false, error })
    return
  }

  try {
    const data = await getRenewalReport(params)
    res.json({ success: true, data })
  } catch (err: any) {
    console.error('getRenewals error:', err)
    res.status(500).json({ success: false, error: err.message || 'Internal server error' })
  }
}
