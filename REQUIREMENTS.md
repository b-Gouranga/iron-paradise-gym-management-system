# Iron Paradise Gym Management System — Functional Requirements

## 1. Product

### Name

Iron Paradise Gym Management System

### Purpose

A professional management system for a single gym.

The system manages:

- Members
- Membership plans
- Memberships
- Renewals
- Payments
- Pending payments
- Automated reminders
- Message history
- Reports
- Trainers
- Settings
- Audit history

The system does not include attendance or check-in, workout tracking, diet plans, body measurements, equipment management, payroll, or inventory. “Track member movement” means membership and payment activity/history, not physical attendance.

## 2. User roles

There are two roles: **owner/admin** and **trainer**.

### Owner/admin

Has full access and can manage members, membership plans and pricing, memberships, renewals, payments and payment history, trainers, reminders, settings, reports, and audit history.

### Trainer

Will have limited operational access. Trainers can view members, memberships, payment status, and relevant history; record payments; and process renewals.

Trainers cannot manage trainers, change membership-plan pricing, change critical reminder or system settings, or delete financial records.

All permissions must eventually be enforced server-side.

## 3. Members

Each member has a unique, sequential Member ID in the form `IP-00001`, `IP-00002`, `IP-00003`, and so on.

### Member fields

- `id`
- `member_code`
- `full_name`
- `phone`
- `email`
- `address`
- `date_of_birth`
- `joining_date`
- `notes`
- `status`
- `created_at`
- `updated_at`

`full_name`, `phone`, and `joining_date` are required.

Search must support name, phone, email, and Member ID. Available filters are All, Active, Expiring Soon, Expired, Payment Pending, and Payment Overdue.

Member details should eventually show personal information, current membership, payment summary, membership history, payment history, and reminder history.

## 4. Membership plans

Plans are reusable templates. Example plans are Monthly (1 month, ₹1,000), Quarterly (3 months, ₹2,700), Half-Yearly (6 months, ₹5,000), and Yearly (12 months, ₹9,000).

### Plan fields

- Name
- Duration value
- Duration unit
- Default fee
- Description
- Active/inactive status
- `created_at`
- `updated_at`

Changing a current plan price must never alter historical membership fees. Each membership must store its own actual fee separately.

## 5. Memberships and renewals

A membership represents a specific membership purchased by a member. It has a member, plan, start date, expiry date, actual fee, payment due date, and status.

Payment date and membership start date are different. Users must be able to select and edit the membership start date. The expiry date is calculated from the selected membership start date plus the plan duration.

For example, if a previous membership expires September 30 and payment is made October 5, the owner may choose October 5 or October 1 as the new start date. The new expiry must be calculated from that selected date.

Renewal delay is the new membership start date minus the previous membership expiry date. Historical memberships must never be overwritten: every renewal creates a new membership record.

## 6. Payments

Payments are individual transactions.

### Payment fields

- Member
- Membership
- Amount
- Payment date
- Payment method
- Purpose
- Notes
- `created_by`
- `created_at`

Supported payment methods are Cash, UPI, Card, Bank Transfer, and Other. Supported purposes are New Membership, Renewal, Partial Payment, Pending Fee, and Other.

Partial payments are supported. Pending amount is calculated as the membership actual fee minus the sum of all payments for that membership. For example, a ₹3,000 membership can be settled through three ₹1,000 payments.

Payment statuses are Unpaid, Partially Paid, Paid, and Overdue. Historical payments must remain preserved.

## 7. Automated reminders and message history

Automated reminders are a core feature. The eventual production system will send messages using a real notification provider such as WhatsApp or SMS. During development, use a mock notification provider and never represent mock messages as actually delivered through WhatsApp or SMS.

Default reminder types are:

- Seven days before membership expiry
- One day before membership expiry
- After membership expiry
- Payment due
- Payment overdue

Owners must eventually be able to enable or disable reminder types. Templates support `{{member_name}}`, `{{membership_plan}}`, `{{expiry_date}}`, `{{pending_amount}}`, `{{payment_due_date}}`, and `{{gym_name}}`.

Message history must store member, membership, reminder type, channel, message, scheduled time, sent time, status, provider message ID, and failure reason.

Statuses are Scheduled, Sent, Delivered, Failed, and Cancelled. Channels are WhatsApp and SMS.

Duplicates must be prevented: the same member, membership, and reminder stage must not create or send a duplicate reminder. The eventual scheduler must operate independently of the dashboard page being open.

## 8. Dashboard

Dashboard statistics:

- Total Members
- Active Members
- Expiring Soon
- Expired
- Pending Payments
- Revenue This Month

Dashboard sections are Upcoming Renewals, Pending Payments, Recent Payments, and Reminder Summary. The dashboard will eventually use real database data instead of mock data.

## 9. Reports

Reports must be calculated from actual database data and eventually support:

- Revenue reports: daily, weekly, monthly, and custom date range.
- Payment reports: Paid, Partially Paid, Unpaid, and Overdue.
- Membership reports: Active, Expired, and Expiring Soon.
- Renewal reports: renewals, late renewals, renewal delay, and average renewal delay.

## 10. Authentication

Use Supabase Auth. Eventually implement login, owner setup, trainer accounts, logout, forgot password, password reset, and secure sessions.

Profiles contain `id`, full name, email, phone, role, and active status. Roles are `owner` and `trainer`. Newly registered users must not automatically receive owner permissions.

## 11. Database

Use Supabase PostgreSQL; do not use Prisma.

Core tables eventually include:

- `profiles`
- `members`
- `membership_plans`
- `memberships`
- `payments`
- `reminder_settings`
- `message_templates`
- `reminders`
- `message_history`
- `audit_logs`

The database must use UUID primary keys where appropriate, foreign keys, unique constraints, NOT NULL constraints, CHECK constraints, useful indexes, and Row Level Security.

## 12. Audit history

Important operations must eventually be auditable, including member creation and updates, membership creation, renewal processing, payment recording, trainer changes, and settings changes. Audit logs must preserve historical information.

## 13. UI

The product should be a premium, modern gym SaaS interface using dark charcoal/black, white or light text, a red accent, green success states, yellow/orange warning states, and red expired/overdue states.

It must support desktop, tablet, and mobile layouts. Use reusable components, consistent spacing, accessible controls, loading states, empty states, error states, success feedback, and form validation.

## 14. Development phases

Development proceeds in this exact order:

1. Project foundation
2. Supabase database foundation
3. Supabase authentication and owner/trainer roles
4. Dashboard database integration
5. Members management
6. Membership plans
7. Membership and renewal system
8. Payment management
9. Automated reminders and message history
10. Reports
11. Trainer management and permissions
12. Settings
13. Security and audit logs
14. Full integration
15. Testing and bug fixing
16. Production deployment

Never automatically implement future phases. Only implement the phase explicitly requested.

## 15. Current Part 1 state

Verified current foundation state:

- React/Vite frontend with TypeScript and Tailwind CSS.
- Login placeholder, dashboard, sidebar, and topbar.
- Reusable UI components and centralized mock dashboard data.
- Routes for dashboard plus placeholder routes for all planned operational sections.
- Express backend with a `GET /api/health` endpoint.
- TypeScript configuration for frontend and backend.
- Root README with setup, development, build, and type-check instructions.

Part 1 has no Supabase database, authentication, live data, operational CRUD flows, reminders, reporting, or audit history. No `.env.example` file is currently present.
