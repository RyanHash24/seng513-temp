# FinClear account access

The app combines the account-access flow from `main` with the UI and Plaid backend from `Nathaniel`. Authentication uses scrypt password hashes, HttpOnly JWT cookies, email verification, password recovery, optional Google OAuth, and plan-based permissions.

## Database

For a fresh database, apply `database/schema.sql`, then run migrations `001_signup_consents.sql` through `006_account_access.sql` in numeric order. Migrations `002`–`005` add Plaid support; `006` adds the session-version, Google identity, and one-time-token schema required by account access.

For an existing database, back it up and confirm it uses the expected UUID-based schema before applying migrations. Do not reset or replace an existing database to resolve a schema mismatch.

## Configuration

Copy `.env.example` to `.env` and set a random `JWT_SECRET` of at least 32 bytes. Keep `.env` out of Git. Configure `FRONTEND_ORIGIN` for the deployed app. For local development, `DEV_AUTH_LINKS=true` logs verification and recovery links; never enable it in production. Production email delivery requires `RESEND_API_KEY` and `MAIL_FROM`.

Google sign-in is optional and requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`, with the same redirect URI registered with Google. Plaid linking requires the appropriate Plaid credentials and `PLAID_TOKEN_ENCRYPTION_KEY`; production credentials are disabled unless `PLAID_PRODUCTION_ENABLED=true`. AWS settings are only needed for S3-backed downloads.

Unverified users cannot use account-data or Plaid routes. The backend also exposes verified-user permission checks for monthly reports. Keep authorization checks in backend routes; UI plan limits are not a security boundary.

## Verification

Run backend tests with `cd backend && npm test`. Run the frontend checks with `cd frontend && npm run build && npm run lint`.
