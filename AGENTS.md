# Running the app

This repo has three runnable pieces: a Python backend, a Next.js frontend, and a Next.js dashboard. The dashboard also depends on infra services (MySQL + Keycloak) started via Docker Compose.

## Backend (FastAPI, port 8000)

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt   # first time only
uvicorn main:app --reload --port 8000
```

## Frontend (Next.js, port 3000)

```bash
cd frontend
npm install   # first time only
npm run dev
```

Open http://localhost:3000. Talks to the backend at `http://localhost:8000` (override with `PYTHON_API_URL`).

## Dashboard (Next.js, port 3002)

Requires the infra services (MySQL + Keycloak) running first:

```bash
cd infra
npm run services:up      # starts mysql, keycloak, phpMyAdmin via docker compose
```

Then:

```bash
cd dashboard
npm install               # first time only
npm run db:generate       # generate Prisma client (first time / after schema changes)
npm run db:push           # sync Prisma schema to MySQL (first time / after schema changes)
npm run dev                # next dev -p 3002
```

Open http://localhost:3002. Auth is via Keycloak (config in `dashboard/.env`); DB connection via Prisma to MySQL.

To stop the infra services: `cd infra && npm run services:down`.
