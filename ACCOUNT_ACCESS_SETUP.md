# FinClear account access prototype

Based on the supplied snapshot of `feat/authentication`. Uses the existing Node/Express, PostgreSQL, scrypt passwords and HttpOnly JWT cookies. No change to the Plaid code or dependency manifests.

## Apply on your actual Git branch (Windows Command Prompt)

First commit/stash your own changes. Fetch and branch from the latest remote authentication branch:

```cmd
git fetch origin
git switch -c feat/account-access origin/feat/authentication
git apply --check C:\path\to\finclear-account-access.patch
git apply C:\path\to\finclear-account-access.patch
```

The patch is based on the ZIP, not a live remote checkout. If the check fails, reconcile the newer upstream changes manually. Do not overwrite your teammates' changes.

## Database and backend

Check the existing database before migrating:

```cmd
docker compose up -d database
docker compose exec database pg_isready -U seng513 -d seng513
docker compose exec database psql -U seng513 -d seng513 -c "\d users"
```

The authentication branch expects UUID user IDs. If your existing database uses BIGINT, stop here. Keep its data; back up and create a separate development database/Compose project (with a distinct project name and no explicitly named shared volume). Do not blindly change foreign keys or reset the old database. On a fresh UUID development database, run schema.sql, then migrations 001 and 002, then seed.sql. On an existing UUID database with the seed loaded, run the migrations, followed by demo_active_trial.sql. The demo script verifies only the exact known demo identities and creates a separate trial. Never use demo seeding in production.

```cmd
docker compose exec -T database psql -U seng513 -d seng513 -v ON_ERROR_STOP=1 < database/schema.sql
docker compose exec -T database psql -U seng513 -d seng513 -v ON_ERROR_STOP=1 < database/migrations/001_signup_consents.sql
docker compose exec -T database psql -U seng513 -d seng513 -v ON_ERROR_STOP=1 < database/migrations/002_account_access.sql
docker compose exec -T database psql -U seng513 -d seng513 -v ON_ERROR_STOP=1 < database/seed.sql
docker compose exec -T database psql -U seng513 -d seng513 -v ON_ERROR_STOP=1 < database/demo_active_trial.sql
docker compose up -d --build backend
```

Do not replace an existing .env; add the new settings from .env.example. For a local-only test, set FRONTEND_ORIGIN=http://localhost:5173 and DEV_AUTH_LINKS=true. Use a random JWT_SECRET of at least 32 bytes. Keep .env out of Git. `cd frontend`, `npm ci`, `npm run dev`; open http://localhost:5173.

## Test accounts

Shared seed password: `FinClearDemo!2026` (development only).

| Email | Expected effective plan |
|---|---|
| alex@example.com | Free |
| david@example.com | Free, expired trial |
| david.active@example.com | Active trial for 14 days from insertion |
| morgan@example.com | Premium |

Proposed limits (team must approve): Free 3 budget categories per budget, 2 active savings goals, 1 connected bank; Trial/Premium unlimited; monthly reports and business accounts reserved for Trial/Premium. Existing over-limit demo data stays visible; no deletion on expiry. Free additions blocked until below the limit. The client polls /api/auth/me every minute; JWTs expire after 15 minutes as before. The server reevaluates the plan on each authenticated request and persists expired roles. No payment flow or self-serve upgrade is implemented.

To simulate expiration of the separate active demo, run the following SQL in psql (development only):

```sql
UPDATE users SET trial_ends_at=now()-interval '1 minute' WHERE email='david.active@example.com';
```

Refresh the app or wait for the next session check. To repeat the active scenario, reset only the demo row:

```sql
UPDATE users SET access_role='trial', trial_ends_at=now()+interval '14 days' WHERE email='david.active@example.com';
```

## Verification and password recovery

New email registrations must verify before opening the workspace. Local mode: inspect `docker compose logs backend` for the development-only link, open it and confirm. Test resend, reset, invalid/expired/reused tokens and old JWT invalidation after reset. Verification links expire after 24 hours, reset links after 30 minutes; only token hashes are stored. In production configure RESEND_API_KEY and MAIL_FROM (verified sender), set DEV_AUTH_LINKS=false, FRONTEND_ORIGIN to the deployed HTTPS origin. Real email delivery has not been tested.

## Google OAuth

Create a Google Cloud OAuth Web application client and configure its consent screen/test users. Set the exact authorized redirect URI `http://localhost:5173/api/auth/google/callback` and the environment values GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI. Recreate backend. Sign up with a new Google email after acknowledging terms, then log out and test Google sign-in with the same account. Existing password accounts are deliberately not linked merely by matching email; a verified account-linking workflow is a future feature. Google OAuth has not been tested against real credentials.

## Integration boundaries

Financial screens are local prototypes. Their UI limits and account-specific browser storage are not a security boundary. The backend provides verified-user middleware, a report-access check, and `checkQuota(client,userId,resource,scope,budgetId)` for the future DB-backed write routes. Call quota checks and inserts in the same transaction, derive user ID from authenticated session, never from client input. The Plaid integration must call this helper before creating bank connections, and the actual report service must enforce permissions itself; its separate URL can bypass the preliminary frontend check. Dashboard/transaction fixtures are not real user financial data. Do not store real financial data in localStorage. A real billing/upgrade service and all DB-backed financial endpoints remain out of scope for this patch.

## Tests

`node --test backend/entitlements.test.js` passed two pure unit tests. `node --check` passed for backend JS files. `git diff --check` passed. Full npm install was blocked by missing cached dependencies; Docker/PostgreSQL and frontend builds were not available. On your machine run `cd backend && npm ci && npm test`, and `cd frontend && npm ci && npm run build && npm run lint` (in separate shells or return to repo root). Run the manual cases above before merging.
