export type Status = 'Active' | 'Inactive' | 'Cancelled' | 'Expiring Soon' | 'Expired' | 'Future' | 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Scheduled' | 'Delivered' | 'Failed'
export interface Renewal { member: string; plan: string; expiry: string; days: number; fee: string; status: Status }
export interface PendingPayment { member: string; membership: string; total: string; paid: string; pending: string; due: string; status: Status }
export interface RecentPayment { member: string; amount: string; date: string; method: string; purpose: string; status: Status }
