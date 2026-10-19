# BrickArt admin dashboard (Next.js standalone).
# Build context: the repo root — the app depends on the sibling database/ package.
#   docker build -f dashboard/Dockerfile -t brickart/dashboard .
#   docker build -f dashboard/Dockerfile --target dbtools -t brickart/dbtools .

ARG NODE_VERSION=22-alpine
ARG PRISMA_VERSION=6.19.3

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
# openssl: Prisma's query engine; libc6-compat: native modules built for glibc
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ---------------------------------------------------------------------------
# Shared Prisma package: deps first (cached until its lockfile changes), then
# generate the client for this platform and compile dist/.
FROM base AS database
COPY database/package.json database/package-lock.json database/
RUN --mount=type=cache,target=/root/.npm \
    cd database && npm ci --ignore-scripts --no-audit --no-fund
COPY database/ database/
RUN cd database && npm run build

# ---------------------------------------------------------------------------
# One-off database jobs (seeds, prisma studio/db push by hand) — not deployed:
#   docker compose run --rm dbtools npm run db:seed
FROM database AS dbtools
# seed.mjs reads the supplier palette from the mosaic-generator folder
COPY mosaic-generator/seller_colors_full.csv mosaic-generator/
WORKDIR /app/database
CMD ["npx", "prisma", "--version"]

# ---------------------------------------------------------------------------
# App dependencies (cached until dashboard's lockfile changes). Only the shared
# package's manifest is needed here — the file:../database link is resolved later.
FROM base AS deps
COPY database/package.json database/
COPY dashboard/package.json dashboard/package-lock.json dashboard/
# npm would run the linked package's `prepare` (its build) here — that's done in
# the database stage instead, so drop the hook from this copy of the manifest.
RUN --mount=type=cache,target=/root/.npm \
    cd database && npm pkg delete scripts.prepare && \
    cd ../dashboard && npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=database /app/database database
COPY --from=deps /app/dashboard/node_modules dashboard/node_modules
COPY dashboard/ dashboard/
# .next/cache persists between builds (BuildKit cache mount) → faster rebuilds
RUN --mount=type=cache,target=/app/dashboard/.next/cache \
    cd dashboard && npm run build

# ---------------------------------------------------------------------------
FROM base AS runner
ARG PRISMA_VERSION
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME=0.0.0.0

# Prisma CLI for the entrypoint's migrations (standalone output doesn't ship it)
RUN --mount=type=cache,target=/root/.npm \
    npm install -g prisma@${PRISMA_VERSION} --no-audit --no-fund

# Standalone output mirrors the repo layout (traced from the root):
#   /app/dashboard/server.js, /app/node_modules, /app/database/...
COPY --from=builder --chown=node:node /app/dashboard/.next/standalone ./
COPY --from=builder --chown=node:node /app/dashboard/.next/static ./dashboard/.next/static
COPY --from=builder --chown=node:node /app/dashboard/public ./dashboard/public
# Schema (+ migrations, when there are any) for the entrypoint
COPY --chown=node:node database/prisma ./database/prisma
COPY --chmod=755 dashboard/entrypoint.sh /usr/local/bin/entrypoint.sh

USER node
WORKDIR /app/dashboard
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3002)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "server.js"]
