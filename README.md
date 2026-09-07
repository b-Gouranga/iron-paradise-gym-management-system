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

Completed: layout, responsive navigation, login placeholder, dashboard with centralized mock data, coming-soon routes, API health endpoint, Supabase database migration, and server/browser Supabase client foundations.

Deferred to later parts: authentication, role policies, dashboard database integration, members and membership workflows, payments, reminders, reports, and all production business workflows.
