# Iron Paradise Gym Management System

## Project

Iron Paradise Gym Management System is a professional management system for a single gym. Its roadmap and functional requirements are defined in [REQUIREMENTS.md](REQUIREMENTS.md).

## Development approach

- Build the system incrementally.
- Work on one clearly defined part at a time.
- Inspect existing code before making changes.
- Do not rewrite working code unnecessarily.
- Preserve the existing architecture unless there is a strong technical reason to change it.
- Do not start future parts unless explicitly requested.
- Keep frontend, backend, database, and business logic properly separated.
- Prefer reusable components and services.
- Avoid duplicated logic.
- Use TypeScript.
- Validate inputs.
- Keep security-sensitive logic on the backend.
- Never expose secrets.
- Run tests, type checks, and builds after significant changes.
- Keep Git commits small and meaningful.

## Technology stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS

### Backend

- Node.js
- Express
- TypeScript

### Database

- Supabase PostgreSQL

### Authentication

- Supabase Auth

Do not use Prisma unless explicitly requested later.

## Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.
- Never commit `.env` files.
- Use environment variables for secrets.
- Use backend authorization for sensitive operations.
- Use Supabase Row Level Security.
- Never rely only on frontend restrictions for security.
- Financial records must not be casually deleted.
- Preserve historical financial records.

## Current status

Parts 1 and 2 are complete. The project now has the Supabase database foundation; future work must follow [REQUIREMENTS.md](REQUIREMENTS.md) and must not begin Part 3 unless explicitly requested.

### Verified Part 1 implementation

- A React, TypeScript, Vite frontend in `frontend/`, styled with Tailwind CSS.
- A premium dark gym-management UI with responsive sidebar and topbar navigation.
- A non-functional login placeholder at `/login`.
- A dashboard at `/dashboard` using centralized mock data for membership, payment, renewal, and reminder summaries.
- Placeholder routes for members, membership plans, payments, renewals, reminders, reports, trainers, and settings.
- Reusable frontend components for buttons, cards, tables, fields, headers, empty states, statistics, and status badges.
- A Node.js, Express, TypeScript backend in `backend/` with `GET /api/health`.
- Separate TypeScript configurations and root scripts for development, type checking, and builds.
- A root `README.md` with setup and run instructions.
- A Supabase SQL migration at `supabase/migrations/001_initial_schema.sql` defining the database foundation, relationships, indexes, constraints, immutable history records, and deny-by-default Row Level Security.
- Browser-safe and server-only Supabase client factories. The server-only factory uses `SUPABASE_SERVICE_ROLE_KEY`; that key must never be exposed to the frontend.

### Not implemented in Part 1

- Authentication or authorization.
- Real business workflows, payments, reports, reminders, audit logging workflows, or API resources beyond health.
- RLS policies; they are intentionally deferred to Part 3 with owner/trainer authentication.

## Commands

From the repository root:

```bash
npm run dev
npm run typecheck
npm run build
```
