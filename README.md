# Iron Paradise Gym Management System

Part 1 foundation for a premium gym-management web application. This release provides a polished, responsive interface and a small Express API only; it deliberately contains no database, Supabase connection, authentication, payment processing, or gym business logic.

## Stack

- Frontend: React, TypeScript, Vite, React Router, Tailwind CSS
- Backend: Node.js, Express, TypeScript, CORS
- Future integration: Supabase PostgreSQL and Supabase Auth

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
```

## Setup

1. Copy `.env.example` to `.env` and set values when integrations are introduced. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
2. Install dependencies from the repository root:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

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

Completed: layout, responsive navigation, login placeholder, dashboard with centralized mock data, coming-soon routes, and API health endpoint.

Deferred to later parts: Supabase, authentication, database schema, memberships, payments, reminders, reports, and all production business workflows.
