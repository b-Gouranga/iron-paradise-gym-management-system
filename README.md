# Iron Paradise Gym Management System

Part 2 database foundation for a premium gym-management web application. The project now contains a Supabase PostgreSQL migration and centralized client configuration; the frontend remains a Part 1 mock-data interface, and authentication and operational workflows are still deferred.

## Stack

- Frontend: React, TypeScript, Vite, React Router, Tailwind CSS
- Backend: Node.js, Express, TypeScript, CORS
- Database: Supabase PostgreSQL (SQL migrations)
- Future authentication: Supabase Auth

## Structure

```text
frontend/                 React application
  src/components/         Reusable UI primitives
  src/layouts/            Shared application shell
  src/pages/              Route-level screens
  src/services/mockData.ts Centralized dashboard mock data
  src/types/              Shared UI data types
backend/                  Express API
  src/config/             Environment configuration
  src/controllers/        Request handlers
  src/routes/             API routes
  src/middleware/         Error handling
  src/services/database/  Server-only Supabase access
supabase/migrations/      Supabase PostgreSQL migrations
```

## Setup

1. Copy `.env.example` to `frontend/.env` and `backend/.env` as appropriate. Environment files are ignored by Git.
2. Install dependencies from the repository root:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

## Supabase setup

1. Create a Supabase project and collect its Project URL, browser-safe anon key, and server-only service-role key.
2. Add these values to local, uncommitted environment files:

```bash
# frontend/.env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# backend/.env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=4000
FRONTEND_URL=http://localhost:5173
```

Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend code or a `VITE_` variable.

3. Apply [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) with the Supabase SQL Editor, or from a linked Supabase CLI project:

```bash
supabase db push
```

The migration enables Row Level Security on every application table and intentionally adds no permissive policies. Browser clients are therefore denied database access until Part 3 defines authenticated owner/trainer policies. The backend service-role client is server-only and bypasses RLS.

## Run locally

Use two terminals:

```bash
npm run dev --prefix frontend
npm run dev --prefix backend
```

Or, after installing root dependencies:

```bash
npm run dev
```

The frontend is served by Vite (normally `http://localhost:5173`). The backend runs on port 4000 by default; check `http://localhost:4000/api/health` for the API health response.

## Checks

```bash
npm run typecheck
npm run build
```

## Current status

Parts 1–16 are implemented and verified. The system includes full authentication (Supabase Auth), RBAC (Owner vs Trainer), member management, membership tracking, renewals, payments, financial reporting, settings, audit logging, and automated reminders with both Mock Provider (for development/testing) and direct Meta WhatsApp Cloud API integration.

## WhatsApp Integration (Meta WhatsApp Cloud API)

Part 16 adds production-ready WhatsApp messaging directly using the **Meta WhatsApp Cloud API** (no Twilio, no third-party wrappers, no SMS fallback).

### Architecture

```text
Reminder Engine / Manual Action
         │
         ▼
Notification Service
         │
         ▼
WhatsApp Provider Factory
   ├── MockProvider (development / testing)
   └── MetaWhatsAppProvider (production)
            │
            ▼
   Meta WhatsApp Cloud API (Graph API v21.0 / configurable)
            │
            ▼
    Member WhatsApp Phone (+91 safe normalization)
            │
            ▼
   Meta Webhooks (sent, delivered, read, failed status sync)
```

### 1. Environment Configuration

To use the simulated mock provider (default for local development and CI testing):
```bash
# backend/.env
MESSAGING_PROVIDER=mock
```

To enable the live Meta WhatsApp Cloud API:
```bash
# backend/.env
MESSAGING_PROVIDER=meta
META_WHATSAPP_ACCESS_TOKEN=EAAG...             # Permanent or System User Access Token
META_WHATSAPP_PHONE_NUMBER_ID=109283746501928  # From WhatsApp App Dashboard
META_WHATSAPP_BUSINESS_ACCOUNT_ID=9827364510293 # WhatsApp Business Account ID
META_WHATSAPP_API_VERSION=v21.0                # Configurable Graph API version (default v21.0)
META_WHATSAPP_VERIFY_TOKEN=your-random-token   # Custom secret for Webhook verification challenge
META_WHATSAPP_APP_SECRET=your-meta-app-secret  # App Secret from App Settings > Basic for HMAC validation
```

### 2. Meta WhatsApp Pre-Approved Templates

Meta WhatsApp Cloud API requires pre-approved message templates for business-initiated conversations. The system maps the 5 gym reminder stages to standard Meta templates:

| Reminder Stage | Default Meta Template Name | Required Parameters (in order) |
|---|---|---|
| `membership_expiry_7_days` | `membership_expiry_reminder` | `{{1}}` Member Name, `{{2}}` Plan Name, `{{3}}` Expiry Date |
| `membership_expiry_1_day` | `membership_expiry_final` | `{{1}}` Member Name, `{{2}}` Plan Name, `{{3}}` Expiry Date |
| `membership_expired` | `membership_expired` | `{{1}}` Member Name, `{{2}}` Plan Name, `{{3}}` Expiry Date |
| `payment_due` | `payment_due_reminder` | `{{1}}` Member Name, `{{2}}` Plan Name, `{{3}}` Due Amount, `{{4}}` Due Date |
| `payment_overdue` | `payment_overdue_alert` | `{{1}}` Member Name, `{{2}}` Plan Name, `{{3}}` Overdue Amount, `{{4}}` Due Date |

Custom template names can be configured in database `message_templates` table or using `META_WHATSAPP_TEMPLATE_<STAGE>` environment variables.

### 3. Webhook Setup (Live Status Sync)

Meta WhatsApp sends real-time status callbacks (`sent`, `delivered`, `read`, `failed`):

1. **Webhook URL**: `https://<your-domain>/api/whatsapp/webhook`
2. **Verify Token**: Must match `META_WEBHOOK_VERIFY_TOKEN` (or `META_WHATSAPP_VERIFY_TOKEN`).
3. **Subscribed Webhook Fields**: Check `messages`.
4. **Signature Verification**: Every incoming webhook payload is cryptographically verified against `X-Hub-Signature-256` using HMAC-SHA256 with `META_APP_SECRET` (or `META_WHATSAPP_APP_SECRET`) when configured. Requests with invalid signatures are rejected with HTTP 401.

### 4. Member WhatsApp Opt-In & Privacy

- **Explicit Opt-In**: Reminders will only be dispatched to members who have `whatsapp_opt_in: true`. Consent is managed in the Member form modal and member details.
- **Safe Phone Normalization**: 10-digit Indian numbers default to country code `+91`. Stored database numbers remain intact (non-destructive). Invalid or unnormalizable numbers fail cleanly without guessing.
- **Zero Token Leakage**: Access tokens and webhook app secrets are never logged in console output, error responses, or database records.

### 5. Standalone Background Reminder Worker

Run the automated reminder worker independently of any frontend or browser timer:

```bash
npm run worker:reminders --prefix backend
```

This worker runs a scheduled scan, evaluates membership expiration and payment due dates, and dispatches pending reminders idempotently.

