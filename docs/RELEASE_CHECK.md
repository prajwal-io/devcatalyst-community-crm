# Release verification — 2026-09-06

Reviewed application revision: e473c15.

## Verified this pass

- Isolated backend suite: 26 passed, 1 credential-dependent test skipped.
- Opt-in live Supabase integration suite: 1 passed, using the dedicated CRM project. Disposable users, registrations, and events were cleaned up.
- Live checks cover default participant role despite user-supplied ADMIN metadata, admin route rejection for participants, draft restrictions, duplicate/full registration, cancellation/re-registration, capacity edits, attendance/history preservation, participant directory and dashboard responses.
- TypeScript and Vite production build passed. JavaScript transfer size: 139.89 kB gzip; CSS: 3.76 kB gzip.
- Production npm dependency audit: zero known vulnerabilities reported.
- Supabase migration history contains all five expected migration names.
- Supabase security advisor reports one warning: leaked-password protection disabled. No other advisor findings were returned.
- No .env files are tracked by Git.

These results are not a claim of exhaustive security coverage. This pass did not rerun every browser flow, the standalone PostgreSQL CI job, or a Python vulnerability audit. Dependency deprecation warnings remain. Final production browser and email-confirmation checks are pending deployment.

## Production deployment handoff

Vercel currently requires account sign-in in the connected browser. No production deployment was created during this pass.

1. Import prajwal-io/devcatalyst-community-crm into two Vercel projects with production branch main.
2. Backend root: backend. Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ENVIRONMENT=production, and CORS_ORIGINS to the exact frontend HTTPS origin. Keep the service-role key exclusively in backend environment settings.
3. Frontend root: frontend. Use Vite, npm ci, npm run build, and dist. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_API_BASE_URL to the backend HTTPS origin before building. Rebuild after environment changes.
4. Configure Supabase Auth Site URL and allowed redirect URLs for the deployed frontend. Review leaked-password protection availability in the project plan.
5. Verify backend /health, frontend deep-link refresh, signup/email confirmation, login/logout, participant registration/history, admin event/attendance/CRM flows, realtime refresh, and CORS rejection of untrusted origins.
6. Record both deployment URLs and successful production checks in README before marking Phase 10 complete.

Existing backend/api/index.py exports the FastAPI app; backend/vercel.json routes requests to it. The frontend rewrite supports client-side routes. Deployment behavior still needs validation on Vercel.

Reference: https://vercel.com/docs/frameworks/backend/fastapi
