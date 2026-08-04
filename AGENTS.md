# Running the app

This repo has five runnable pieces: a Python backend, a Python `mosaic-generator` service, a Next.js frontend, a Next.js dashboard, and `brickmos` (a vendored third-party Lego-mosaic generator with an added HTTP service). The dashboard also depends on infra services (MySQL + Keycloak) started via Docker Compose.

For how an uploaded photo actually becomes a mosaic — every stage from decode to
bags, what's deliberately *not* done, and which knobs change the output — read
[docs/pipeline.md](docs/pipeline.md) before touching `mosaic-generator/`.

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

## mosaic-generator (FastAPI, port 8002)

Fast in-house mosaic service — same color/shading result as `brickmos` (33-color BrickLink palette, Euclidean-RGB nearest match, no flattening preprocessing) but with a vectorized matcher, so generation is a few milliseconds. Uses its own `venv`.

```bash
cd mosaic-generator
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt   # first time only
uvicorn main:app --reload --port 8002
```

Serves `POST /process` and `GET /pdf/{job_id}` (same shape as the backend, so the frontend can point at it via `PYTHON_API_URL`); docs at http://localhost:8002/docs.

Pipeline internals (stages, the 1×1 cap, palette/parts config, response shape, tuning knobs): [docs/pipeline.md](docs/pipeline.md).

## brickmos service (FastAPI, port 8001)

Vendored fork of [merschformann/brickmos](https://github.com/merschformann/brickmos) with an added FastAPI upload service. Note it uses its own `.venv` (not `venv`) and its deps are managed by `pyproject.toml`, not `requirements.txt`.

```bash
cd brickmos
source .venv/bin/activate
pip install -e ".[service]"   # first time only — installs brickmos + the "service" extra (fastapi, uvicorn, ...)
python run_service.py --port 8001 [--reload]
```

Serves `POST /process` and `GET /pdf/{job_id}` (mirrors the backend's API); interactive docs at http://localhost:8001/docs.

One-off CLI conversion (no service, just writes an output image + BrickLink parts list):

```bash
python run.py --image_file data/iron-man-portrait.jpg --output_directory=temp
```

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

## Validating changes

Both Next.js apps have Playwright installed for agent-driven validation. Once
you've made a change that touches a page, component, or route, **run it
through a real browser before calling the work done** — don't rely on `curl`
or on checking whether the dev server's port is open; neither one tells you
the page actually rendered or that an interaction actually works.

```bash
cd frontend && npx playwright test        # http://localhost:3000
cd dashboard && npx playwright test       # http://localhost:3002
```

Each app's `playwright.config.ts` reuses whatever dev server is already
running on its port, so you don't need to start one yourself if it's already
up. Starter coverage lives in `frontend/e2e/` and `dashboard/e2e/` — when your
change touches a specific page or flow, add or extend a spec for it (navigate,
interact, assert on the resulting DOM state) rather than only re-running the
existing smoke tests. Delete throwaway specs you added purely to eyeball a
one-off change; keep the ones worth running again.

The dashboard's `/dashboard/*` pages and most `/api/*` routes require a real
Keycloak session (`dashboard/src/middleware.ts`) that Playwright can't obtain
without live admin credentials — its coverage there is limited to public
routes and the login-redirect behavior. For an authenticated dashboard check,
say so explicitly rather than claiming the page was verified.
