
# FinClear
SENG 513 – Group 8

Web-Based Systems – Fall 2026

## Project Overview


Welcome to **FinClear**, our financial management application. This repository will contain both the frontend and backend for this full-stack project. 

### Planned Tech Stack
The following stack will be used for implementation

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

The easiest way to run the backend and database is with Docker. To get started, you need Docker Desktop installed and running before proceeding.

### 1. Verify Docker is installed

```bash
docker --version
docker compose version
docker info
```

### 2. Clone the repository

```bash
git clone https://csgit.ucalgary.ca/seng513f26/pg-8/seng513-202604-pg-8.git
cd seng513-202604-pg-8
```

### 3. Configure environment variables

- Copy the template file:

  ```bash
  cp .env.example .env
  ```

- Open `.env` and set a secure database password:

  ```dotenv
  POSTGRES_PASSWORD=<your-password>
  ```

  **Note:** Replace `<your-password>` with your chosen password.

### 4. Start the development environment

Run:

```bash
docker compose config --quiet
docker compose up -d --build
```

This will build the backend image and start both the backend and database.

### 5. Verify the application

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

Optional database readiness check:

```bash
docker compose exec database pg_isready -U seng513 -d seng513
```

### 6. Run the production configuration

Validate the production configuration:

```bash
docker compose -f compose.yaml -f compose.prod.yaml config --quiet
```

Start it:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

The production configuration sets `NODE_ENV=production` and enables automatic container restart policies.

### 7. Stop the containers

Development:

```bash
docker compose down
```

Production:

```bash
docker compose -f compose.yaml -f compose.prod.yaml down
```

## Password and Secrets Strategy

- Sensitive credentials are stored in a local `.env` file instead of being hardcoded in source code or committed configuration files.
- The `.env` file is ignored by Git via `.gitignore`, preventing the accidental exposure of passwords.
- The repository includes `.env.example`, so developers know which environment variables must be created locally.
- Docker Compose reads `POSTGRES_PASSWORD` from `.env` and injects it into the backend and database containers.
- The backend connects to PostgreSQL through the Docker Compose service names and environment variables.
- For a real production deployment, separate production credentials and a proper secrets-management solution should be used instead of the shared local `.env` file.
- If the database password is changed after PostgreSQL has initialized its persistent volume, the password must be updated inside PostgreSQL. Changing just `.env` won't be enough.
