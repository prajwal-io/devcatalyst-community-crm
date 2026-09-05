# Phase 1 Explainer

Use this document to understand and explain the foundation during the DevCatalyst review.

## What Phase 1 built

Phase 1 creates the base that every later Task 2 feature depends on: project structure, the complete database model, Supabase authentication, role-based access, FastAPI, and a minimal React authentication flow.

## One-line explanation of each part

1. **Project setup:** The repository is split into `frontend`, `backend`, and `supabase` so each responsibility is easy to understand and deploy.
2. **Supabase:** Supabase provides PostgreSQL, user authentication, and Realtime, which are the three database-side technologies required by Task 2.
3. **Database:** PostgreSQL stores profiles, events, and registrations with constraints that model the full Task 2 workflow.
4. **Authentication:** Supabase Auth validates email/password credentials and creates a secure session containing an access token.
5. **Profile creation:** A PostgreSQL trigger automatically creates a `profiles` row whenever Supabase Auth creates a user.
6. **Roles:** Every public signup defaults to `PARTICIPANT`, while trusted admins are promoted separately so users cannot make themselves admins.
7. **RLS:** Row Level Security is a database safety layer that controls which authenticated users may read or change rows.
8. **FastAPI:** FastAPI is the REST backend between the React application and protected application data/business logic.
9. **Pydantic:** Pydantic defines and validates the structured data returned by FastAPI, such as the authenticated user model.
10. **Bearer token:** React sends the Supabase access token in the `Authorization: Bearer ...` header on protected API calls.
11. **Token validation:** FastAPI asks Supabase Auth to validate that token and identify the real authenticated user.
12. **Authorization:** FastAPI reads the server-side profile and checks `ADMIN` or `PARTICIPANT` before allowing role-protected endpoints.
13. **Frontend route protection:** React route guards improve the user experience, but the backend remains the real security boundary.
14. **Realtime:** The core Task 2 tables are added to Supabase Realtime so later phases can subscribe to database changes.
15. **Vercel:** The frontend and backend are structured as separate Vercel projects pointing to the `frontend` and `backend` folders.

## Database explanation

### profiles

`profiles` extends Supabase's internal `auth.users` record with application-specific data: name, email, and role. The profile ID is the same UUID as the Auth user ID, making the relationship one-to-one.

### events

`events` already contains the fields required by Task 2:

- name
- description
- date/time (`starts_at`, optional `ends_at`)
- location and/or online link
- registration deadline
- capacity
- status
- admin creator

The database checks that capacity is positive, the event end is after its start, the registration deadline is not after the event begins, and at least a location or online link is supplied.

### registrations

`registrations` connects one participant to one event. Its status uses exactly the required attendance values: `REGISTERED`, `ATTENDED`, `ABSENT`, and `CANCELLED`.

A unique constraint on `(event_id, participant_id)` is the database-level protection against duplicate registration records. Later registration APIs will also validate deadlines and capacity before writing.

## Authentication flow to explain aloud

> A user signs up through Supabase Auth. Supabase securely handles the password and creates an Auth user. A database trigger creates our application profile with the PARTICIPANT role. Supabase then gives the frontend a session and access token. Whenever React calls a protected FastAPI endpoint, it sends that access token as a Bearer token. FastAPI validates the token with Supabase, loads the user's profile from PostgreSQL, checks the role, and only then runs the protected operation.

## First APIs

### `GET /health`

The first and simplest API. It does not need authentication and proves that the FastAPI service is running.

Response:

```json
{
  "status": "ok"
}
```

### `GET /api/v1/auth/me`

The first protected API. It requires a Supabase Bearer token, validates the caller, loads their profile, and returns their ID, name, email, and role.

### `GET /api/v1/admin/test`

The first role-protected API. Authentication alone is not enough: the resolved profile must have the `ADMIN` role.

## Concepts you should know

### API endpoint

An endpoint is a specific HTTP method and URL handled by the backend, such as `GET /health`.

### REST API

REST organizes backend operations around HTTP methods and URLs so the frontend and backend communicate through a clear contract.

### Request and response

A request is data sent to the server; a response is the status and data returned by the server.

### HTTP status codes

- `200` means success.
- `401` means the user is not authenticated or the token is invalid.
- `403` means the user is authenticated but not allowed to perform the action.
- `503` means a required backend service could not be reached.

### Dependency injection in FastAPI

`Depends(...)` lets shared logic such as authentication run before an endpoint. This prevents duplicating token-validation code in every route.

### Pydantic model

A Pydantic model describes the expected shape and type of API data and validates that data automatically.

### CORS

CORS tells the browser which frontend origins are allowed to call the FastAPI backend.

### JWT/access token

Supabase sessions contain an access token. The frontend proves who the user is by sending that token to the backend rather than sending a user ID or role that could be forged.

### Row Level Security

RLS applies access rules inside PostgreSQL. It is defense in depth: even though FastAPI performs authorization, database policies also restrict authenticated direct database access.

### Service-role key

The service-role key is a privileged server secret. It exists only in FastAPI and must never be put in Vite/frontend environment variables.

## Why this architecture is secure

The browser cannot grant itself admin privileges because public signup does not accept a role, the database creates participants by default, FastAPI retrieves the role from the server-side profile, and the service-role key never leaves the backend.

## What is intentionally not built yet

- Event CRUD API/UI
- Event publish/unpublish UI
- Participant event browsing
- Registration/cancellation
- Deadline/capacity enforcement in registration API
- Attendance management
- Participant history UI
- Admin dashboard analytics

The database is already shaped for these Task 2 requirements so later phases can build on the same schema without redesigning the foundation.
