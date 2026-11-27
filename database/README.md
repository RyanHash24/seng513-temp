# FinClear Database Schema and Seed

## Instructions to run Schema and Seeding Scripts

### 1. Prepare the Environment

Ensure Git and Docker Desktop with Docker Compose is installed. Open Docker Desktop and run these commands from the repository root:

```bash
git clone https://csgit.ucalgary.ca/seng513f26/pg-8/seng513-202604-pg-8.git
cd seng513-202604-pg-8
cp .env.example .env
```

For instances where you already have checkout and .env, use them. Set the POSTGRES_PASSWORD in .env to whatever you’ve chosen for your local database password.

Moving along, use these following commands:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose exec database pg_isready -U seng513 -d seng513
```

Wait until pg_isready reports that is it currently accepting connections. Repeat that command if PostgreSQL is still starting. Ensure the PostgreSQL version is 15 or newer due to the Compose configuration using 15.

### 2. Create the schema / Load Development Seed

Use the following command:

```bash
docker compose exec -T database psql -U seng513 -d seng513 \
-v ON_ERROR_STOP=1 < database/schema.sql
```

Run this command before loading seed data. Then apply `database/migrations/001_signup_consents.sql` and `database/migrations/002_account_access.sql` using the same psql command (substitute the file path). See `ACCOUNT_ACCESS_SETUP.md` for the UUID compatibility check and active-trial demo.

To load the seed data, run the following command:

```bash
docker compose exec -T database psql -U seng513 -d seng513 \
-v ON_ERROR_STOP=1 < database/seed.sql
```

Records use fixed UUIDs, so the seed script uses the same IDs every time it runs. The schema supports the users, settings, bank connections, accounts, categories, transactions, monthly budgets, savings, goals and notifications. FKs (foreign keys) indicate relationships and prevent records from one user from being linked onto another user’s data. The seed uses historical August, September and October 2026 transactions, so select October 2026 when comparing the demo with the UI.

The four fictional users are trial user David Lee (david@example.com), premium user Morgan Watson (morgan@example.com), guest user Sarah Larson (no email address due to her guest profile use), and free user Alex Chen (alex@example.com). The shared development password is FinClearDemo!2026.

### 3. Verify the setup

Use the following command:

```bash
docker compose exec -T database psql -U seng513 -d seng513 \
  -v ON_ERROR_STOP=1 < database/verify.sql
```

The expected output is:

```text
All schema acceptance checks passed
```

The following October 2026 totals are expected:

- David’s planned spending: $3600
- David’s actual spending: $2040
- David’s remaining budget: $1560
- Morgan’s business income: $8400
- Morgan’s business expenses: $5150
- Morgan’s net business cash flow: $3250

Check the backend’s database connection using the following command:

```bash
curl http://localhost:3001/db-health
```

The expected output is:

```json
{"database":"connected"}
```

### 4. Stopping the Container

Use the following command:

```bash
docker compose down
```

This will shut down the backend and PostgreSQL containers.
