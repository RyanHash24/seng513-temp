# FinClear
SENG 513 – Group 8

Web-Based Systems – Fall 2026

## Project Overview

Welcome to **FinClear**, our financial management application. This repository contains the frontend and backend for the full-stack project.

### Planned Tech Stack

The following stack is planned for implementation.

#### Frontend
- React Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- shadcn/ui Charts
- Zod
- React Query

#### Backend
- Node.js
- RESTful API
- node-postgres

#### Database
- PostgreSQL

#### Bank Data Integration
- Plaid API
- OAuth 2.0

#### Authentication and Security
- JWT-based authentication
- Password hashing
- HTTPS/TLS

## Getting Started with Docker

Docker Compose runs the backend and PostgreSQL database. The frontend runs separately with Vite.

### 1. Verify Docker is installed

```bash
docker --version
docker compose version
docker info
```

### 2. Clone the repository

```bash
git clone https://github.com/RyanHash24/seng513-temp.git
cd seng513-temp
```

### 3. Configure environment variables

Copy the template:

```bash
cp .env.example .env
```

Set a unique local database password in `.env`:

```dotenv
POSTGRES_PASSWORD=<your-password>
```

For stable local sessions, set `JWT_SECRET` to a random value of at least 32 bytes. Keep `.env` private and out of Git.

### 4. Start and initialize the database

Start PostgreSQL and wait for it to be ready:

```bash
docker compose config --quiet
docker compose up -d database
docker compose exec database pg_isready -U seng513 -d seng513
```

On a fresh database, apply the schema and all migrations:

```bash
docker compose exec -T database psql -U seng513 -d seng513 -v ON_ERROR_STOP=1 < database/schema.sql
for migration in database/migrations/*.sql; do
  docker compose exec -T database psql -U seng513 -d seng513 -v ON_ERROR_STOP=1 < "$migration"
done
```

For an existing database, back it up and confirm it uses the expected UUID-based schema before applying migrations. Do not reset or replace an existing database to resolve a schema mismatch.

### 5. Start the backend and frontend

Build and start the backend:

```bash
docker compose up -d --build backend
```

In another terminal, run the frontend:

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` requests to the backend at `http://localhost:3001`.

### 6. Verify the application

Check running containers:

```bash
docker compose ps
```

Test the backend:

```bash
curl http://localhost:3001/health
```

Expected result:

```json
{"status":"ok"}
```

Test database connectivity:

```bash
curl http://localhost:3001/db-health
```

Expected result:

```json
{"database":"connected"}
```

### 7. Stop the containers

```bash
docker compose down
```

This keeps the database volume. `docker compose down -v` removes the persisted database data.

### Production configuration

The repository currently has no `compose.prod.yaml`; `compose.yaml` is configured for development. Do not use it as a production deployment. Production requires HTTPS, production-grade secret storage, a configured email sender, a deployed `FRONTEND_ORIGIN`, and `NODE_ENV=production`.

## Password and Secrets Strategy

- Sensitive credentials belong in a local `.env` file, not in source code or committed configuration.
- `.env` is ignored by Git via `.gitignore`; `.env.example` documents the variables used by the app.
- Docker Compose reads `POSTGRES_PASSWORD` from `.env` and injects it into the backend and database containers.
- The backend connects to PostgreSQL using the Docker Compose service name and environment variables.
- Use separate production credentials and a secrets-management solution for a real deployment; do not reuse local credentials.
- If the database password changes after PostgreSQL initializes its persistent volume, update the password inside PostgreSQL too. Changing only `.env` is not enough.

## Account Access and Plaid

Authentication uses scrypt password hashes and HttpOnly JWT cookies. Email signup requires verification; password recovery uses one-time tokens. Google OAuth is optional. Unverified users cannot use protected Plaid or download routes, and backend routes enforce report permissions and bank-connection plan limits.

For local email verification and password recovery, set `DEV_AUTH_LINKS=true`; the backend logs development-only links. Never enable this setting in production. Real email delivery requires `RESEND_API_KEY` and `MAIL_FROM`.

Google sign-in requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`, with the same redirect URI registered with Google. The local example uses the frontend's Vite proxy at `http://localhost:5173/api/auth/google/callback`.

Plaid linking uses Sandbox by default. Configure `PLAID_CLIENT_ID`, the relevant Plaid secret, and a 64-character hexadecimal `PLAID_TOKEN_ENCRYPTION_KEY`. Production Plaid credentials are disabled unless `PLAID_PRODUCTION_ENABLED=true`. AWS settings are optional and only needed for S3-backed downloads.

The database schema and migrations are in `database/`. For a fresh database, apply `database/schema.sql` followed by migrations `001_signup_consents.sql` through `006_account_access.sql` in numeric order. Migrations `002`–`005` add Plaid support; `006` adds the account-access session, Google identity, and token schema. Back up existing databases and check schema compatibility before applying migrations.

## Development Checks

Run backend tests:

```bash
cd backend
npm ci
npm test
```

Build and lint the frontend:

```bash
cd frontend
npm ci
npm run build
npm run lint
```
