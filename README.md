# DevCatalyst Community CRM

A full-stack community event registration and CRM platform built for DevCatalyst-OSS Task 2.

## Phase 1-5 status

This repository implements the foundation and the complete Phase 1-5 workflows:

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
- Admin event CRUD and lifecycle status management
- Participant event discovery, registration, and cancellation
- Atomic duplicate, deadline, capacity, and publication rules
- Attendance outcomes and durable participant history

Dashboard analytics are planned for Phase 7. Realtime tables are configured for the Phase 8 client subscriptions.

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

Create a dedicated Supabase project, then apply every file in `supabase/migrations/` in filename order:

1. `0001_initial_schema.sql`
2. `0002_registration_rules.sql`
3. `20260905174458_review_hardening.sql`
4. `20260906040403_simplify_read_policies.sql`

All four migrations are required. The backend registration, cancellation, and concurrency-safe event update flows depend on the RPC functions created after the initial schema.

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
- `GET /api/v1/events` - participant-visible published events
- `POST /api/v1/events/{event_id}/register` - atomic participant registration
- `POST /api/v1/events/{event_id}/cancel` - safe participant cancellation
- `/api/v1/admin/events` - admin event CRUD and lifecycle management
- `PATCH /api/v1/admin/registrations/{registration_id}/status` - attendance management
- `GET /api/v1/me/registrations` - participant history
- `GET /api/v1/admin/participants/{participant_id}/history` - admin history view
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
npm ci
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

## Dedicated CRM project and review

A separate Supabase project, **DevCatalyst Community CRM**, was created in Mumbai (`ap-south-1`) on 2026-09-06. Its project reference is `dqsquaegyhqdoofqaqzn` and API URL is `https://dqsquaegyhqdoofqaqzn.supabase.co`. All four migrations above have been applied there. It is separate from BacktoBase Hacks.

The review fixed concurrent capacity edits, attendance restoration above capacity, cancellation overwriting finalized attendance, PATCH validation errors, auth-profile loading failures, and missing lifecycle controls. Events with any registration history cannot be deleted; use event cancellation to retain history. Final event states cannot be reopened through the API. Event cancellation closes registration but preserves each participant's existing attendance record.

All data writes go through FastAPI. Authenticated Supabase clients have scoped SELECT access for Realtime; they cannot bypass API rules with direct table writes. Roles are read from server-owned profiles. Privileged RPCs are executable only by the backend service role, and security-definer helpers live in the unexposed private schema.

The review workspace's ignored frontend and backend environment files are configured for the dedicated project. A live smoke test passed using real Supabase Auth sessions through FastAPI, covering event publication, duplicate/full registration rejection, cancellation/re-registration, capacity changes, attendance, history, and RBAC. Disposable test accounts and events were removed afterward. Security advisors reported no findings.

To rerun the live test against a dedicated test project, configure the backend environment, set `RUN_LIVE_SUPABASE=1`, and run `pytest tests/test_live_supabase.py` from `backend`. It creates and deletes only its own temporary accounts and events; it does not send signup emails. CI skips this credential-dependent test and runs the isolated regression suite instead.

Frontend dependencies are locked by `package-lock.json` and CI uses `npm ci`. Backend direct dependencies are pinned. CI runs backend regression tests, the frontend production build, and PostgreSQL migration/business-rule tests. The database tests use disposable fixtures and roll back; they do not send signup emails. These checks do not replace a browser login test with Supabase Auth and production Vercel configuration.

Before serving the app:

1. In the CRM project's API settings, copy the server-only secret/service-role key into `backend/.env` as `SUPABASE_SERVICE_ROLE_KEY`. Never commit it or put it in a Vite variable.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the same CRM project. A publishable key can be used in the existing ANON_KEY-named variables.
3. Configure Supabase Auth site/redirect URLs, sign up your own account, and promote only a trusted account with the SQL above.
4. Configure the two Vercel project roots and their environment variables; use the deployed frontend origin for backend CORS.

Realtime publication is enabled for all three tables. Frontend live subscriptions remain the planned Phase 8 work.
