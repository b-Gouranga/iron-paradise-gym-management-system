import type { PendingPayment, RecentPayment, Renewal } from '../types'

export const stats = [
  { label: 'Total Members', value: '248', detail: '+12 this month', tone: 'red' },
  { label: 'Active Members', value: '193', detail: '77.8% of all members', tone: 'green' },
  { label: 'Expiring Soon', value: '17', detail: 'Within 7 days', tone: 'amber' },
  { label: 'Expired', value: '23', detail: 'Needs attention', tone: 'red' },
  { label: 'Pending Payments', value: '₹42,500', detail: 'Across 14 members', tone: 'amber' },
  { label: 'Revenue This Month', value: '₹1,84,000', detail: '+18.2% from last month', tone: 'green' },
]
export const renewals: Renewal[] = [
  { member: 'Arjun Mehta', plan: 'Elite Annual', expiry: 'Sep 10, 2026', days: 3, fee: '₹18,000', status: 'Expiring Soon' },
  { member: 'Nisha Sharma', plan: 'Quarterly', expiry: 'Sep 12, 2026', days: 5, fee: '₹6,500', status: 'Expiring Soon' },
  { member: 'Rohan Kapoor', plan: 'Premium Monthly', expiry: 'Sep 14, 2026', days: 7, fee: '₹2,500', status: 'Active' },
  { member: 'Priya Nair', plan: 'Elite Annual', expiry: 'Sep 04, 2026', days: -3, fee: '₹18,000', status: 'Expired' },
]
export const pendingPayments: PendingPayment[] = [
  { member: 'Karan Malhotra', membership: 'Premium Annual', total: '₹24,000', paid: '₹12,000', pending: '₹12,000', due: 'Sep 09, 2026', status: 'Partially Paid' },
  { member: 'Sana Khan', membership: 'Monthly', total: '₹2,500', paid: '₹0', pending: '₹2,500', due: 'Sep 06, 2026', status: 'Overdue' },
  { member: 'Vikram Singh', membership: 'Quarterly', total: '₹6,500', paid: '₹0', pending: '₹6,500', due: 'Sep 15, 2026', status: 'Unpaid' },
]
export const recentPayments: RecentPayment[] = [
  { member: 'Meera Iyer', amount: '₹18,000', date: 'Sep 07, 2026', method: 'UPI', purpose: 'Membership Renewal', status: 'Paid' },
  { member: 'Aditya Rao', amount: '₹2,500', date: 'Sep 07, 2026', method: 'Card', purpose: 'New Membership', status: 'Paid' },
  { member: 'Tanvi Gupta', amount: '₹6,500', date: 'Sep 06, 2026', method: 'Cash', purpose: 'Membership Renewal', status: 'Paid' },
]
export const reminderSummary = [{ label: 'Scheduled', value: 12 }, { label: 'Sent Today', value: 8 }, { label: 'Delivered', value: 7 }, { label: 'Failed', value: 1 }]
