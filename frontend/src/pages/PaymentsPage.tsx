import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  IndianRupee,
  Receipt,
  Search,
  Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../hooks/useAuth'
import { fetchPayments } from '../services/paymentsService'
import type {
  PaymentListFilters,
  PaymentMethod,
  PaymentPurpose,
  PaymentTransaction,
} from '../types/payments'

const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const [y, m, d] = dateOnly.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function getMethodBadge(method: PaymentMethod) {
  switch (method) {
    case 'cash':
      return {
        label: 'Cash',
        classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      }
    case 'upi':
      return {
        label: 'UPI / QR',
        classes: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      }
    case 'card':
      return {
        label: 'POS Card',
        classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      }
    case 'bank_transfer':
      return {
        label: 'Bank Transfer',
        classes: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      }
    default:
      return {
        label: 'Other',
        classes: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
      }
  }
}

function getPurposeLabel(purpose: PaymentPurpose): string {
  switch (purpose) {
    case 'new_membership':
      return 'New Membership'
    case 'renewal':
      return 'Renewal'
    case 'partial_payment':
      return 'Partial Payment'
    case 'pending_fee':
      return 'Pending Fee'
    default:
      return 'Other'
  }
}

export function PaymentsPage() {
  const { session } = useAuth()

  const [payments, setPayments] = useState<PaymentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [purposeFilter, setPurposeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Pagination & Summary
  const [page, setPage] = useState(1)
  const [limit] = useState(15)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalRecordedCount: 0,
    totalPendingEstimate: 0,
  })

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  useEffect(() => {
    const token = session?.access_token
    if (!token) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const filters: PaymentListFilters = {
      page,
      limit,
      search: debouncedSearch,
      payment_method: methodFilter,
      purpose: purposeFilter,
      date_from: dateFrom,
      date_to: dateTo,
    }

    fetchPayments(token, filters)
      .then(res => {
        if (!cancelled) {
          const list = res.payments ?? []
          const totalCount = res.pagination?.total ?? res.total ?? 0
          const pagesCount =
            res.pagination?.totalPages ??
            res.totalPages ??
            (totalCount > 0 ? Math.ceil(totalCount / limit) : 1)

          setPayments(list)
          setTotal(totalCount)
          setTotalPages(Math.max(1, pagesCount))
          setSummary(
            res.summary ?? {
              totalRevenue: 0,
              totalRecordedCount: 0,
              totalPendingEstimate: 0,
            },
          )
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load payments.')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    session?.access_token,
    page,
    limit,
    debouncedSearch,
    methodFilter,
    purposeFilter,
    dateFrom,
    dateTo,
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Payments & Revenue"
          description="Record manual payment collections, review transaction history, and verify member payment statuses."
        />
        <div className="flex items-center gap-2">
          <Link
            to="/members"
            className="rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[.08] hover:text-white"
          >
            Go to Members to Record Payment
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Total Revenue Collected
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-white">
                {formatINR(summary.totalRevenue)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <IndianRupee size={22} />
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Across all verified historical payments
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Total Transactions
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-white">
                {summary.totalRecordedCount}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <Receipt size={22} />
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Immutable staff-recorded receipts
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Estimated Pending Dues
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-brand">
                {formatINR(summary.totalPendingEstimate)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Wallet size={22} />
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Outstanding fees on active memberships
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search member name or code (IP-…)"
              className="w-full rounded-lg border border-white/10 bg-white/[.04] py-2 pl-10 pr-4 text-xs text-white placeholder-zinc-500 outline-none focus:border-brand/70"
            />
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={methodFilter}
              onChange={e => {
                setMethodFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white outline-none focus:border-brand/70"
            >
              <option value="all" className="bg-[#1C1C1F] text-white">
                All Methods
              </option>
              <option value="cash" className="bg-[#1C1C1F] text-white">
                Cash
              </option>
              <option value="upi" className="bg-[#1C1C1F] text-white">
                UPI / QR
              </option>
              <option value="card" className="bg-[#1C1C1F] text-white">
                Card (POS)
              </option>
              <option value="bank_transfer" className="bg-[#1C1C1F] text-white">
                Bank Transfer
              </option>
              <option value="other" className="bg-[#1C1C1F] text-white">
                Other
              </option>
            </select>
          </div>

          {/* Purpose Filter */}
          <div>
            <select
              value={purposeFilter}
              onChange={e => {
                setPurposeFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white outline-none focus:border-brand/70"
            >
              <option value="all" className="bg-[#1C1C1F] text-white">
                All Purposes
              </option>
              <option value="new_membership" className="bg-[#1C1C1F] text-white">
                New Membership
              </option>
              <option value="renewal" className="bg-[#1C1C1F] text-white">
                Renewal
              </option>
              <option value="partial_payment" className="bg-[#1C1C1F] text-white">
                Partial Payment
              </option>
              <option value="pending_fee" className="bg-[#1C1C1F] text-white">
                Pending Fee
              </option>
              <option value="other" className="bg-[#1C1C1F] text-white">
                Other
              </option>
            </select>
          </div>

          {/* Date Range Reset */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              aria-label="Filter from date"
              className="w-full rounded-lg border border-white/10 bg-white/[.04] px-2 py-2 text-xs text-white outline-none focus:border-brand/70"
            />
            {(dateFrom || dateTo || methodFilter !== 'all' || purposeFilter !== 'all' || search) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setMethodFilter('all')
                  setPurposeFilter('all')
                  setDateFrom('')
                  setDateTo('')
                  setPage(1)
                }}
                className="shrink-0 rounded-lg border border-white/10 bg-white/[.04] px-2 py-2 text-xs text-zinc-400 hover:text-white"
                title="Reset filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-4 text-sm text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <p>{error}</p>
        </div>
      )}

      {/* Payments Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-zinc-500">
            Loading payment transactions…
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-500">
            {debouncedSearch || methodFilter !== 'all' || purposeFilter !== 'all' || dateFrom || dateTo
              ? 'No payments match the current filter criteria.'
              : 'No payment records found yet. When membership fees are collected manually, record them from the Member Details page.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[.07] bg-white/[.02] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Member</th>
                  <th className="px-5 py-3.5">Plan</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5">Purpose</th>
                  <th className="px-5 py-3.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.05]">
                {payments.map(p => {
                  const badge = getMethodBadge(p.payment_method)
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-white/[.02]"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-white">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          to={`/members/${p.member_id}`}
                          className="font-medium text-white hover:text-brand hover:underline"
                        >
                          {p.member_name ?? 'Member'}
                        </Link>
                        <div className="font-mono text-[10px] text-zinc-500">
                          {p.member_code ?? '—'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-300">
                        {p.plan_name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-emerald-400">
                        {formatINR(p.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-300">
                        {getPurposeLabel(p.purpose)}
                      </td>
                      <td className="max-w-xs truncate px-5 py-4 text-zinc-400" title={p.notes ?? ''}>
                        {p.notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[.07] px-5 py-3 text-xs text-zinc-400">
            <div>
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} payments
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[.08] disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <span className="px-2 font-medium text-zinc-300">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[.08] disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
