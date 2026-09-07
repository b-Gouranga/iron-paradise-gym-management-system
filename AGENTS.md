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

Part 1 is complete. Part 2 has not been implemented. The project is at the foundation stage; future work must follow [REQUIREMENTS.md](REQUIREMENTS.md).

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

### Not implemented in Part 1

- Supabase configuration or database schema.
- Authentication or authorization.
- Real business workflows, payments, reports, reminders, audit logging, or API resources beyond health.
- An environment template file is not currently present, despite the README referring to one.

## Commands

From the repository root:

```bash
npm run dev
npm run typecheck
npm run build
```

