# DevCatalyst Community CRM

A full-stack community event registration and CRM platform built for DevCatalyst-OSS Task 2.

## Phase 1 status

This repository currently implements the project foundation:

- React + TypeScript + Vite frontend
- Python + FastAPI + Pydantic backend
- Supabase PostgreSQL schema for profiles, events, and registrations
- Supabase Auth integration
- `ADMIN` and `PARTICIPANT` roles
- Protected frontend routes
- Bearer-token authentication in FastAPI
- Admin authorization dependency
- Supabase Row Level Security policies
- Supabase Realtime publication for Task 2 data
- Vercel-ready frontend and backend structure

Event CRUD, registration flows, attendance management, participant history, and dashboard analytics are intentionally deferred to later phases.

## Architecture

```text
React + TypeScript + Vite
        |
        | Supabase Auth session + Bearer access token
        v
     FastAPI
        |
        | authenticated/authorized server operations
        v
Supabase
  |- Auth
  |- PostgreSQL
  `- Realtime
```

The frontend uses Supabase Auth for signup, login, logout, and session persistence. Protected application data is accessed through FastAPI. FastAPI validates the Supabase access token and reads the user's server-side profile before allowing protected operations.

## Repository structure

```text
.
|- frontend/                  React + TypeScript + Vite
|- backend/                   FastAPI application
|- supabase/migrations/       PostgreSQL schema and RLS
|- docs/                      Architecture / explanation notes
`- .github/workflows/         CI checks
```

## 1. Create the Supabase project

Create a Supabase project, then open **SQL Editor** and run:

`supabase/migrations/0001_initial_schema.sql`

The migration creates the complete Task 2 data model:

- `profiles`
- `events`
- `registrations`
- role/status enums
- auth-to-profile trigger
- constraints and indexes
- Row Level Security policies
- Realtime publication

Every new signup becomes a `PARTICIPANT`. Public signup never accepts an admin role.

To promote a trusted account to admin, use the Supabase SQL Editor after that user has signed up:

```sql
update public.profiles
set role = 'ADMIN'
where email = 'your-admin-email@example.com';
```

## 2. Backend environment

Copy `backend/.env.example` to `backend/.env` and provide the values from Supabase project settings.

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGINS=http://localhost:5173
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend or commit it.

## 3. Run FastAPI

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Useful endpoints:

- `GET /health` - public service health check
- `GET /api/v1/auth/me` - current authenticated user/profile
- `GET /api/v1/admin/test` - admin-only authorization check
- `GET /docs` - FastAPI Swagger documentation

## 4. Frontend environment

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

Then run:

```bash
cd frontend
npm install
npm run dev
```

## Authentication flow

```text
Signup/Login
    -> Supabase Auth authenticates credentials
    -> Supabase returns a session + access token
    -> React stores the Supabase-managed session
    -> React sends access token to FastAPI as Bearer token
    -> FastAPI validates token with Supabase Auth
    -> FastAPI reads public.profiles
    -> FastAPI checks role
    -> request is allowed or rejected
```

## Database model

### profiles

One row per Supabase Auth user. Stores application identity and role.

### events

Matches Task 2 event requirements: name, description, date/time, location or online link, registration deadline, capacity, and status.

### registrations

Connects participants to events and stores `REGISTERED`, `ATTENDED`, `ABSENT`, or `CANCELLED` state. A database unique constraint prevents duplicate participant/event rows.

## Why FastAPI is between React and the database

The frontend is not trusted to decide whether a user is an admin. FastAPI independently validates the token and role before protected server operations. Supabase RLS provides an additional database-level security layer.

## Deployment

The project is structured for two Vercel projects from the same repository:

- Frontend project root: `frontend`
- Backend project root: `backend`

Set the corresponding environment variables in each Vercel project. In production, set `VITE_API_BASE_URL` to the backend deployment URL and `CORS_ORIGINS` to the frontend deployment URL.

## Evaluation preparation

Read `docs/PHASE1_EXPLAINER.md`. It explains the Phase 1 architecture in simple terms you can use during the DevCatalyst review.
